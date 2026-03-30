/**
 * POST /api/admin/fetch-company-metrics
 *
 * Fetches the 8 remaining metrics from Yahoo Finance that couldn't be derived
 * from the old StockQuarterlyStats schema, and stores them in CompanyMetricValue.
 *
 * Metrics fetched:
 *   quality_roe               → financialData.returnOnEquity
 *   quality_roic              → NOPAT / InvestedCapital (income + balance sheet)
 *   valuation_ev_ebit         → enterpriseValue / ebit (income statement)
 *   risk_net_debt_ebitda      → (totalDebt - totalCash) / ebitda
 *   risk_interest_coverage    → ebit / interestExpense (income statement)
 *   risk_cash_short_debt      → totalCash / shortTermDebt (balance sheet)
 *   risk_shareholder_yield    → (dividendsPaid + repurchaseOfStock) / marketCap
 *   valuation_percentile      → PE percentile rank in own quarterly history
 *
 * Also refreshes already-migrated snapshot metrics with fresh Yahoo data.
 *
 * Query params:
 *   ?step=fetch&offset=0&limit=20  – batch through active companies
 *
 * GET  – returns progress counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAILS = ['minjune043010@gmail.com'];

// ── Types ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YahooAny = any;

// ── Helpers ───────────────────────────────────────────────────────────────────

function raw(v: YahooAny): number | null {
  if (v == null) return null;
  const n = typeof v === 'object' ? v?.raw : Number(v);
  return isFinite(n) ? n : null;
}

function safeDivide(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

// ── Yahoo Finance fetch (raw API, no npm package) ─────────────────────────────

async function fetchYahooModules(ticker: string): Promise<YahooAny | null> {
  const safe = encodeURIComponent(ticker);
  const modules = [
    'price',
    'financialData',
    'defaultKeyStatistics',
    'summaryDetail',
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
  ].join('%2C');

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${safe}?modules=${modules}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data: YahooAny = await res.json();
    return data?.quoteSummary?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── GET: progress ─────────────────────────────────────────────────────────────

export async function GET() {
  const [companyCount, metricValueCount, periodCount] = await Promise.all([
    prisma.company.count(),
    prisma.companyMetricValue.count(),
    prisma.companyPeriod.count(),
  ]);
  return NextResponse.json({ companyCount, metricValueCount, periodCount });
}

// ── POST: fetch metrics ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit  = parseInt(searchParams.get('limit')  ?? '20', 10);

  // Load metric definitions (lookup by code)
  const metricDefs = await prisma.companyMetricDefinition.findMany();
  const defByCode  = Object.fromEntries(metricDefs.map(d => [d.code, d]));

  // Load active companies in batch
  const companies = await prisma.company.findMany({
    where:   { isActive: true },
    orderBy: { ticker: 'asc' },
    skip:    offset,
    take:    limit,
  });
  const totalActive = await prisma.company.count({ where: { isActive: true } });

  let processed           = 0;
  let metricValuesCreated = 0;
  const errors: string[] = [];

  for (const company of companies) {
    try {
      const r = await fetchYahooModules(company.ticker);

      if (!r) {
        errors.push(`${company.ticker}: fetch failed`);
        processed++;
        continue;
      }

      const pr:  YahooAny = r.price                ?? {};
      const fd:  YahooAny = r.financialData         ?? {};
      const dks: YahooAny = r.defaultKeyStatistics  ?? {};
      const sd:  YahooAny = r.summaryDetail         ?? {};
      const ish: YahooAny = r.incomeStatementHistory?.incomeStatementHistory?.[0] ?? {};
      const bsh: YahooAny = r.balanceSheetHistory?.balanceSheetHistory?.[0]       ?? {};
      const cfh: YahooAny = r.cashflowStatementHistory?.cashflowStatementHistory?.[0] ?? {};

      // ── Find or create snapshot period ─────────────────────────────────────
      const today   = new Date();
      const snapKey = `SNAP-${today.toISOString().slice(0, 10)}`;

      // Reset isLatest on old snapshots
      await prisma.companyPeriod.updateMany({
        where: { companyId: company.id, periodType: 'snapshot', isLatest: true },
        data:  { isLatest: false },
      });
      const snapPeriod = await prisma.companyPeriod.upsert({
        where:  { companyId_periodKey: { companyId: company.id, periodKey: snapKey } },
        update: { isLatest: true },
        create: {
          companyId:   company.id,
          periodKey:   snapKey,
          periodType:  'snapshot',
          periodLabel: `Snapshot ${today.toISOString().slice(0, 10)}`,
          endDate:     today,
          isLatest:    true,
        },
      });

      // ── Compute metrics ────────────────────────────────────────────────────

      // 1. ROE
      const roe = raw(fd.returnOnEquity);

      // 2. ROIC = NOPAT / InvestedCapital
      const ebit         = raw(ish.ebit);
      const incomeTax    = raw(ish.incomeTaxExpense);
      const pretaxIncome = raw(ish.incomeBeforeTax);
      const taxRate      = (incomeTax != null && pretaxIncome != null && pretaxIncome !== 0)
        ? Math.max(0, Math.min(0.5, incomeTax / pretaxIncome))
        : 0.21;
      const nopat        = ebit != null ? ebit * (1 - taxRate) : null;
      const longTermDebt = raw(bsh.longTermDebt)  ?? 0;
      const shortTermDebt2 = raw(bsh.shortLongTermDebt) ?? 0;
      const totalEquity  = raw(bsh.totalStockholderEquity);
      const cashBS       = raw(bsh.cash);
      const investedCap  = totalEquity != null
        ? longTermDebt + shortTermDebt2 + totalEquity - (cashBS ?? 0)
        : null;
      const roic = safeDivide(nopat, investedCap);

      // 3. EV/EBIT
      const enterpriseValue = raw(dks.enterpriseValue);
      const evEbit = (enterpriseValue != null && ebit != null && ebit > 0)
        ? enterpriseValue / ebit
        : null;

      // 4. Net Debt / EBITDA
      const ebitda        = raw(fd.ebitda);
      const totalDebt     = raw(fd.totalDebt);
      const totalCash     = raw(fd.totalCash);
      const netDebt       = (totalDebt != null && totalCash != null) ? totalDebt - totalCash : null;
      const netDebtEbitda = safeDivide(netDebt, ebitda);

      // 5. Interest Coverage = EBIT / |Interest Expense|
      const interestExpense  = raw(ish.interestExpense);
      const interestCoverage = (ebit != null && interestExpense != null && interestExpense !== 0)
        ? ebit / Math.abs(interestExpense)
        : null;

      // 6. Cash / Short-term Debt
      const shortTermDebt    = raw(bsh.shortLongTermDebt);
      const cashShortDebt    = (totalCash != null && shortTermDebt != null && shortTermDebt > 0)
        ? totalCash / shortTermDebt
        : null;

      // 7. Shareholder Yield = (|dividendsPaid| + |repurchaseOfStock|) / marketCap
      const dividendsPaid    = raw(cfh.dividendsPaid);
      const repurchaseStock  = raw(cfh.repurchaseOfStock);
      const marketCap        = raw(pr.marketCap);
      const totalReturn      = (dividendsPaid    != null ? Math.abs(dividendsPaid)   : 0)
                             + (repurchaseStock  != null ? Math.abs(repurchaseStock) : 0);
      const shareholderYield = (totalReturn > 0 && marketCap != null && marketCap > 0)
        ? totalReturn / marketCap
        : raw(sd.dividendYield); // fallback to just dividend yield

      // 8. Valuation Percentile — PE rank in own quarterly history
      const peHistRows = await prisma.companyMetricValue.findMany({
        where: {
          period: { companyId: company.id, periodType: { not: 'snapshot' } },
          definition: { code: 'valuation_pe' },
          numericValue: { not: null, gt: 0, lt: 200 },
        },
        select: { numericValue: true },
      });
      const trailingPE = raw(sd.trailingPE) ?? raw(dks.trailingPE);
      let valuationPercentile: number | null = null;
      if (trailingPE != null && peHistRows.length >= 2) {
        const allPEs = peHistRows.map(r2 => r2.numericValue as number);
        const below  = allPEs.filter(v => v <= trailingPE).length;
        valuationPercentile = (below / allPEs.length) * 100;
      }

      // Refreshed snapshot metrics
      const currentPE  = trailingPE;
      const currentPB  = raw(dks.priceToBook);
      const fcf        = raw(fd.freeCashflow);
      const fcfYield   = (fcf != null && marketCap != null && marketCap > 0)
        ? fcf / marketCap : null;
      const opMargin    = raw(fd.operatingMargins);
      const revGrowth   = raw(fd.revenueGrowth);
      const ocf         = raw(fd.operatingCashflow);
      const netIncome   = raw(fd.netIncomeToCommon);
      const cfoNetIncome = (ocf != null && netIncome != null && netIncome !== 0)
        ? ocf / Math.abs(netIncome) : null;

      // ── Store metric values ────────────────────────────────────────────────

      const metricsToStore: { code: string; value: number | null }[] = [
        { code: 'valuation_pe',             value: currentPE },
        { code: 'valuation_pb',             value: currentPB },
        { code: 'valuation_fcf_yield',      value: fcfYield },
        { code: 'valuation_ev_ebit',        value: evEbit },
        { code: 'valuation_percentile',     value: valuationPercentile },
        { code: 'quality_revenue_growth',   value: revGrowth },
        { code: 'quality_operating_margin', value: opMargin },
        { code: 'quality_roe',              value: roe },
        { code: 'quality_roic',             value: roic },
        { code: 'quality_cfo_net_income',   value: cfoNetIncome },
        { code: 'risk_fcf',                 value: fcf },
        { code: 'risk_net_debt_ebitda',     value: netDebtEbitda },
        { code: 'risk_interest_coverage',   value: interestCoverage },
        { code: 'risk_cash_short_debt',     value: cashShortDebt },
        { code: 'risk_shareholder_yield',   value: shareholderYield },
      ];

      for (const m of metricsToStore) {
        if (m.value == null) continue;
        const def = defByCode[m.code];
        if (!def) continue;
        await prisma.companyMetricValue.upsert({
          where: {
            periodId_metricDefinitionId: {
              periodId:           snapPeriod.id,
              metricDefinitionId: def.id,
            },
          },
          update: { numericValue: m.value, source: 'yahoo-finance' },
          create: {
            periodId:           snapPeriod.id,
            metricDefinitionId: def.id,
            numericValue:       m.value,
            source:             'yahoo-finance',
          },
        });
        metricValuesCreated++;
      }

      processed++;

      // Throttle to avoid Yahoo rate limits
      await new Promise(r2 => setTimeout(r2, 250));
    } catch (err) {
      errors.push(`${company.ticker}: ${String(err).slice(0, 80)}`);
      processed++;
    }
  }

  const nextOffset = offset + limit;
  const done       = nextOffset >= totalActive;

  return NextResponse.json({
    processed,
    metricValuesCreated,
    errors: errors.slice(0, 10),
    progress: `${Math.min(nextOffset, totalActive)}/${totalActive}`,
    nextOffset,
    done,
  });
}
