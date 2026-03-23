/**
 * POST /api/admin/seed-fin-tables
 *
 * Fetches quarterly financial data from Yahoo Finance and populates the five
 * custom financial tables with a full time-series per ticker.
 *
 * ── Table & key design ───────────────────────────────────────────────────────
 *
 *   fin_time        PK: reported_at (TIMESTAMPTZ)
 *                   A row is created ONLY when a real earnings quarter exists.
 *                   This is the event anchor that all fact tables reference.
 *
 *   fin_stock_info  PK: ticker
 *                   One row per company — static info (name, exchange, sector).
 *
 *   fin_valuation   PK: (ticker, reported_at)  FK→fin_stock_info + fin_time
 *   fin_quality     PK: (ticker, reported_at)  FK→fin_stock_info + fin_time
 *   fin_risk        PK: (ticker, reported_at)  FK→fin_stock_info + fin_time
 *
 *   The composite PK means you get one metrics row per company per earnings
 *   release date — a full historical record, not just the latest snapshot.
 *
 * ── Yahoo Finance modules used ───────────────────────────────────────────────
 *
 *   incomeStatementHistory    → revenue, net income, EBIT, interest expense
 *   balanceSheetHistory       → equity, total debt, cash, short-term debt
 *   cashflowStatementHistory  → CFO, capex (FCF), dividends paid, buybacks
 *   defaultKeyStatistics      → enterprise value, P/B ratio, trailing EPS
 *   summaryDetail             → trailing P/E, dividend yield, market cap
 *   financialData             → TTM margins, FCF, EBITDA, revenue growth
 *
 * ── Metrics computed ─────────────────────────────────────────────────────────
 *
 *   fin_valuation:
 *     per               = trailing P/E (TTM, latest quarter only)
 *     pbr               = price-to-book (latest)
 *     ev_ebit           = enterprise value / quarterly EBIT
 *     fcf_yield         = TTM FCF / market cap × 100  (latest)
 *     valuation_pct     = NULL — requires cross-sectional ranking
 *
 *   fin_quality:
 *     revenue_growth    = YoY quarterly revenue growth %
 *     operating_margin  = operating income / revenue × 100
 *     roe               = net income / shareholders' equity × 100
 *     roic              = operating income / invested capital × 100
 *     cfo_net_income    = CFO / net income  (cash conversion quality)
 *
 *   fin_risk:
 *     fcf               = quarterly free cash flow (USD)
 *     net_debt_ebitda   = (total debt − cash) / EBITDA
 *     interest_coverage = EBIT / interest expense
 *     cash_short_debt   = cash / short-term debt
 *     shareholder_yield = (dividends + buybacks) / market cap × 100  (latest)
 *
 * ── Query params (POST) ──────────────────────────────────────────────────────
 *   ?offset=0    skip N tickers (pagination)
 *   ?limit=30    process up to N tickers per call (max 50)
 *
 * ── GET ──────────────────────────────────────────────────────────────────────
 *   Returns row counts for each fin_ table and last 5 time events stored.
 *
 * ── Prerequisite ─────────────────────────────────────────────────────────────
 *   Run the migration 20260323100000_fin_tables_add_time.sql on your Neon DB
 *   before calling this endpoint for the first time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '@/auth';
import { prisma } from '@/lib/prisma';

// ── helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email);
}

// ── Yahoo Finance crumb auth ──────────────────────────────────────────────────
// The v10/quoteSummary endpoint requires a crumb token + session cookie.
// We fetch both once at the start of each POST call and reuse across all tickers.

interface YahooAuth {
  crumb:   string;
  cookies: string;
}

async function getYahooAuth(): Promise<YahooAuth | null> {
  try {
    // Step 1 — hit the main Yahoo Finance page to receive a session cookie
    const homeRes = await fetch('https://finance.yahoo.com/', {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    // Collect all Set-Cookie headers into a single cookie string
    const setCookies: string[] = homeRes.headers.getSetCookie
      ? homeRes.headers.getSetCookie()
      : [(homeRes.headers.get('set-cookie') ?? '')];
    const cookies = setCookies
      .map(c => c.split(';')[0])   // keep only name=value, drop attributes
      .filter(Boolean)
      .join('; ');

    // Step 2 — exchange the session cookie for a crumb token
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie':          cookies,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!crumbRes.ok) return null;

    const crumb = (await crumbRes.text()).trim();
    // Sanity check — a valid crumb is a short alphanumeric string, not an HTML page
    if (!crumb || crumb.length > 50 || crumb.includes('<')) return null;

    return { crumb, cookies };
  } catch {
    return null;
  }
}

function nullIfZero(v: number): number | null {
  return v === 0 || !isFinite(v) ? null : v;
}

function pct(numerator: number, denominator: number): number | null {
  if (!denominator || !isFinite(denominator) || !isFinite(numerator)) return null;
  const v = (numerator / denominator) * 100;
  return isFinite(v) ? v : null;
}

function ratio(numerator: number, denominator: number): number | null {
  if (!denominator || !isFinite(denominator) || !isFinite(numerator)) return null;
  const v = numerator / denominator;
  return isFinite(v) ? v : null;
}

// ── Quarter label ─────────────────────────────────────────────────────────────

function quarterLabel(date: Date): string {
  const month = date.getUTCMonth() + 1;
  const year  = date.getUTCFullYear();
  const q     = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  return `${q}_${year}`;
}

// ── Per-quarter metrics ───────────────────────────────────────────────────────

interface QuarterMetrics {
  reportedAt:       Date;
  eventType:        string;

  // fin_valuation
  per:              number | null;   // trailing P/E — only meaningful for latest quarter
  pbr:              number | null;   // price-to-book — only meaningful for latest
  evEbit:           number | null;   // EV / quarterly EBIT
  fcfYield:         number | null;   // TTM FCF / market cap (latest)

  // fin_quality
  revenueGrowth:    number | null;   // YoY quarterly %
  operatingMargin:  number | null;   // %
  roe:              number | null;   // %
  roic:             number | null;   // %
  cfoCoverage:      number | null;   // CFO / net income

  // fin_risk
  quarterFcf:       number | null;   // quarterly FCF (USD)
  netDebtEbitda:    number | null;   // (debt − cash) / EBITDA
  interestCoverage: number | null;   // EBIT / interest expense
  cashShortDebt:    number | null;   // cash / short-term debt
  shareholderYield: number | null;   // (dividends + buybacks) / mktcap × 100 (latest)
}

// ── Read metrics from StockQuarterlyStats (no external API calls) ─────────────
//
// Yahoo Finance's quoteSummary endpoint is blocked from Vercel IPs (HTTP 429).
// StockQuarterlyStats already holds all the data we need — it is populated by:
//   • seed-markets ?step=2  → reportType="snapshot" (price + basic valuation)
//   • seed-history ?step=financials → reportType=Q1/Q2/Q3/Q4 (full financials)
//
// We map StockQuarterlyStats columns → QuarterMetrics and use periodEnd as the
// reported_at timestamp for fin_time.

async function buildQuarterMetrics(ticker: string): Promise<QuarterMetrics[]> {
  const rows = await prisma.stockQuarterlyStats.findMany({
    where:   { ticker },
    orderBy: { periodEnd: 'asc' },   // oldest first so YoY growth look-back works
  });

  if (rows.length === 0) return [];

  // Build revenue map for YoY growth: periodEnd ms → revenue
  const revenueByTime: Record<number, number> = {};
  for (const r of rows) {
    if (r.revenue) revenueByTime[r.periodEnd.getTime()] = r.revenue;
  }

  return rows.map((r, i): QuarterMetrics => {
    const marketCap     = r.marketCap    ?? 0;
    const revenue       = r.revenue      ?? 0;
    const netIncome     = r.netIncome    ?? 0;
    const bookValue     = r.bookValue    ?? 0;   // stockholders' equity (stored by seed-history)
    const fcf           = r.freeCashFlow ?? 0;
    const cfo           = r.operatingCashFlow ?? 0;
    const dividendYield = r.dividendYield ?? 0;  // decimal, e.g. 0.0052

    // ── fin_valuation ─────────────────────────────────────────────────────────
    const per      = nullIfZero(r.peRatio    ?? 0);
    const pbr      = nullIfZero(r.priceToBook ?? 0);
    // EV not stored → ev_ebit stays null until seed-history populates it
    const evEbit   = null;
    const fcfYield = (marketCap > 0 && fcf !== 0) ? pct(fcf, marketCap) : null;

    // ── fin_quality ───────────────────────────────────────────────────────────
    // YoY revenue growth: find same quarter ~1 year earlier
    let revenueGrowth: number | null = null;
    if (revenue !== 0) {
      const oneYearAgo = r.periodEnd.getTime() - 365 * 24 * 3600 * 1000;
      const priorEntry = Object.entries(revenueByTime)
        .map(([t, v]) => ({ t: Number(t), v }))
        .filter(e => Math.abs(e.t - oneYearAgo) < 46 * 24 * 3600 * 1000)
        .sort((a, b) => Math.abs(a.t - oneYearAgo) - Math.abs(b.t - oneYearAgo))[0];
      if (priorEntry && priorEntry.v !== 0) {
        revenueGrowth = pct(revenue - priorEntry.v, Math.abs(priorEntry.v));
      }
    }

    // operatingMargin is stored as a decimal (e.g. 0.31) — convert to %
    const operatingMargin = r.operatingMargin != null
      ? (Math.abs(r.operatingMargin) < 2 ? r.operatingMargin * 100 : r.operatingMargin)
      : null;

    // ROE = net income / equity (book value)
    const roe  = bookValue !== 0 && netIncome !== 0 ? pct(netIncome, bookValue) : null;

    // ROIC requires invested capital breakdown (not stored) → null for now
    const roic = null;

    // Cash conversion quality = CFO / net income
    const cfoCoverage = netIncome !== 0 && cfo !== 0 ? ratio(cfo, netIncome) : null;

    // ── fin_risk ──────────────────────────────────────────────────────────────
    // debtToEquity is stored as a ratio, net_debt_ebitda needs EBITDA → null
    const netDebtEbitda    = null;
    const interestCoverage = null;   // interest expense not stored in StockQuarterlyStats
    const cashShortDebt    = null;   // cash / short-term debt — not stored separately

    // Shareholder yield ≈ dividend yield (buyback component not stored)
    const shareholderYield = dividendYield > 0 ? dividendYield * 100 : null;

    return {
      reportedAt:       r.periodEnd,
      eventType:        r.reportType === 'snapshot'
                          ? `snapshot_${r.periodEnd.toISOString().split('T')[0]}`
                          : `${r.reportType}_${r.periodEnd.getUTCFullYear()}`,
      per,
      pbr,
      evEbit,
      fcfYield,
      revenueGrowth,
      operatingMargin,
      roe,
      roic,
      cfoCoverage,
      quarterFcf:       nullIfZero(fcf),
      netDebtEbitda,
      interestCoverage,
      cashShortDebt,
      shareholderYield,
    };
  });
}

// ── Upsert helpers (raw SQL — fin_* tables are not Prisma models) ─────────────

async function upsertFinTime(reportedAt: Date, eventType: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_time" ("reported_at", "event_type")
     VALUES ($1, $2)
     ON CONFLICT ("reported_at") DO UPDATE SET "event_type" = EXCLUDED."event_type"`,
    reportedAt,
    eventType,
  );
}

async function upsertFinStockInfo(
  ticker: string,
  name: string,
  exchange: string,
  sector: string | null,
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_stock_info" ("ticker", "company_name", "exchange", "sector")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("ticker") DO UPDATE SET
       "company_name" = EXCLUDED."company_name",
       "exchange"     = EXCLUDED."exchange",
       "sector"       = EXCLUDED."sector"`,
    ticker,
    name,
    exchange,
    sector ?? null,
  );
}

async function upsertFinValuation(ticker: string, q: QuarterMetrics) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_valuation"
       ("ticker","reported_at","per","pbr","ev_ebit","fcf_yield","valuation_percentile")
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT ("ticker","reported_at") DO UPDATE SET
       "per"                  = EXCLUDED."per",
       "pbr"                  = EXCLUDED."pbr",
       "ev_ebit"              = EXCLUDED."ev_ebit",
       "fcf_yield"            = EXCLUDED."fcf_yield",
       "valuation_percentile" = EXCLUDED."valuation_percentile"`,
    ticker,
    q.reportedAt,
    q.per,
    q.pbr,
    q.evEbit,
    q.fcfYield,
    null,   // valuation_percentile requires cross-sectional ranking — computed separately
  );
}

async function upsertFinQuality(ticker: string, q: QuarterMetrics) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_quality"
       ("ticker","reported_at","revenue_growth","operating_margin","roe","roic","cfo_net_income")
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT ("ticker","reported_at") DO UPDATE SET
       "revenue_growth"   = EXCLUDED."revenue_growth",
       "operating_margin" = EXCLUDED."operating_margin",
       "roe"              = EXCLUDED."roe",
       "roic"             = EXCLUDED."roic",
       "cfo_net_income"   = EXCLUDED."cfo_net_income"`,
    ticker,
    q.reportedAt,
    q.revenueGrowth,
    q.operatingMargin,
    q.roe,
    q.roic,
    q.cfoCoverage,
  );
}

async function upsertFinRisk(ticker: string, q: QuarterMetrics) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_risk"
       ("ticker","reported_at","fcf","net_debt_ebitda","interest_coverage","cash_short_debt","shareholder_yield")
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT ("ticker","reported_at") DO UPDATE SET
       "fcf"               = EXCLUDED."fcf",
       "net_debt_ebitda"   = EXCLUDED."net_debt_ebitda",
       "interest_coverage" = EXCLUDED."interest_coverage",
       "cash_short_debt"   = EXCLUDED."cash_short_debt",
       "shareholder_yield" = EXCLUDED."shareholder_yield"`,
    ticker,
    q.reportedAt,
    q.quarterFcf,
    q.netDebtEbitda,
    q.interestCoverage,
    q.cashShortDebt,
    q.shareholderYield,
  );
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const offset = Math.max(0,  parseInt(searchParams.get('offset') ?? '0',  10));
  const limit  = Math.min(50, parseInt(searchParams.get('limit')  ?? '30', 10));

  const stocks = await prisma.stockUniverse.findMany({
    skip:    offset,
    take:    limit,
    orderBy: { ticker: 'asc' },
    select:  { ticker: true, name: true, exchange: true, sector: true },
  });

  let done   = 0;
  let failed = 0;
  let totalQuarters = 0;
  const errors: { ticker: string; reason: string }[] = [];

  for (const stock of stocks) {
    try {
      const quarters = await buildQuarterMetrics(stock.ticker);

      if (quarters.length === 0) {
        failed++;
        errors.push({ ticker: stock.ticker, reason: 'no quarterly data returned' });
        await sleep(200);
        continue;
      }

      // 1. Upsert stock master row (once per ticker)
      await upsertFinStockInfo(
        stock.ticker,
        stock.name,
        stock.exchange,
        stock.sector ?? null,
      );

      // 2. For each quarter that has a real earnings release date:
      //    create a fin_time row (only if it doesn't already exist), then
      //    write the fact rows for valuation / quality / risk.
      for (const q of quarters) {
        await upsertFinTime(q.reportedAt, q.eventType);
        await upsertFinValuation(stock.ticker, q);
        await upsertFinQuality(stock.ticker, q);
        await upsertFinRisk(stock.ticker, q);
        totalQuarters++;
      }

      done++;
    } catch (err) {
      failed++;
      errors.push({ ticker: stock.ticker, reason: String(err) });
    }

    // no sleep needed — reading from our own DB, no external rate limit
  }

  const totalUniverse = await prisma.stockUniverse.count();

  return NextResponse.json({
    done,
    failed,
    totalQuarters,
    offset,
    limit,
    batchSize:     stocks.length,
    totalUniverse,
    remaining:     Math.max(0, totalUniverse - offset - stocks.length),
    ...(errors.length > 0 && { errors }),
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Row counts for each fin_ table
  const [timeCount, stockInfoCount, valuationCount, qualityCount, riskCount] =
    await Promise.all([
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_time"'),
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_stock_info"'),
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_valuation"'),
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_quality"'),
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_risk"'),
    ]).catch(() => [null, null, null, null, null]);

  // Most recent fin_time events (last 5)
  const recentEvents = await prisma
    .$queryRawUnsafe<{ reported_at: Date; event_type: string }[]>(
      `SELECT "reported_at", "event_type"
       FROM "fin_time"
       ORDER BY "reported_at" DESC
       LIMIT 5`,
    )
    .catch(() => []);

  return NextResponse.json({
    rowCounts: {
      fin_time:       Number(timeCount?.[0]?.count       ?? 0),
      fin_stock_info: Number(stockInfoCount?.[0]?.count  ?? 0),
      fin_valuation:  Number(valuationCount?.[0]?.count  ?? 0),
      fin_quality:    Number(qualityCount?.[0]?.count    ?? 0),
      fin_risk:       Number(riskCount?.[0]?.count       ?? 0),
    },
    recentEvents: recentEvents.map(e => ({
      reportedAt: e.reported_at,
      eventType:  e.event_type,
    })),
    note: 'POST ?offset=0&limit=30 to seed a batch. Repeat with increasing offset until remaining=0.',
  });
}
