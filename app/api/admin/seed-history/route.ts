/**
 * POST /api/admin/seed-history
 *
 * Admin-only endpoint that populates historical market data (2024-01-01 to present).
 * Fetches OHLC candles, dividends, splits, and quarterly financials from Yahoo Finance.
 *
 * Steps (pass ?step=init|ohlc|financials or omit for status-only GET):
 *
 *   init       – Creates StockFetchProgress rows (pending) for all tickers.
 *                Run once before starting batch jobs.
 *
 *   ohlc       – Fetches 2024-2026 daily OHLC + dividends + splits for the next N
 *                pending tickers. Pass ?size=10 (default 10, max 25).
 *                Also records splits in StockSplit and dividends in StockDividend.
 *
 *   financials – Fetches quarterly income / balance-sheet / earnings for the next N
 *                pending tickers. Pass ?size=20 (default 20, max 50).
 *                Writes to StockQuarterlyStats with reportType Q1-Q4 / Annual.
 *
 * GET /api/admin/seed-history  – Returns progress counts (pending/done/failed per type).
 *
 * Workflow example:
 *   1. POST ?step=init
 *   2. Repeat: POST ?step=ohlc&size=10  until ohlcPending = 0
 *   3. Repeat: POST ?step=financials&size=20 until financialsPending = 0
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// ── constants ────────────────────────────────────────────────────────────────

const HISTORY_FROM = new Date('2024-01-01').getTime() / 1000; // unix seconds
const HISTORY_TO   = Math.floor(Date.now() / 1000);

// ── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  return user?.role === 'admin' ? user : null;
}

// ── Yahoo Finance fetchers ───────────────────────────────────────────────────

/**
 * Fetches daily OHLC candles + dividend and split events for a single ticker
 * between HISTORY_FROM and HISTORY_TO (2024-01-01 → today).
 */
async function fetchOHLC(ticker: string) {
  const safe = encodeURIComponent(ticker);
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${safe}`
    + `?interval=1d&period1=${HISTORY_FROM}&period2=${HISTORY_TO}&events=div%2Csplit`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const adjCloses: number[]  = result.indicators?.adjclose?.[0]?.adjclose ?? [];

  const candles = timestamps
    .map((ts, i) => ({
      date:     new Date(ts * 1000),
      open:     (q.open?.[i]   ?? 0) as number,
      high:     (q.high?.[i]   ?? 0) as number,
      low:      (q.low?.[i]    ?? 0) as number,
      close:    (q.close?.[i]  ?? 0) as number,
      adjClose: (adjCloses[i]  ?? null) as number | null,
      volume:   BigInt(Math.round((q.volume?.[i] ?? 0) as number)),
    }))
    .filter(c => c.open > 0 && c.close > 0);

  // Dividend events: { [timestamp]: { amount, date } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDivs: Record<string, any> = result.events?.dividends ?? {};
  const dividends = Object.values(rawDivs).map((d) => ({
    exDate: new Date((d.date as number) * 1000),
    amount: (d.amount as number) ?? 0,
  }));

  // Split events: { [timestamp]: { numerator, denominator, date } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSplits: Record<string, any> = result.events?.splits ?? {};
  const splits = Object.values(rawSplits).map((s) => ({
    date:  new Date((s.date as number) * 1000),
    ratio: ((s.numerator as number) / (s.denominator as number)) || 1,
  }));

  return { candles, dividends, splits };
}

interface QuarterData {
  periodEnd:         Date;
  reportType:        string;
  revenue:           number | null;
  netIncome:         number | null;
  eps:               number | null;
  epsEstimate:       number | null;
  epsSurprisePct:    number | null;
  operatingMargin:   number | null;
  bookValue:         number | null;
  debtToEquity:      number | null;
  currentRatio:      number | null;
  freeCashFlow:      number | null;
  operatingCashFlow: number | null;
  marketCap:         number | null;
  peRatio:           number | null;
  priceToBook:       number | null;
  dividendYield:     number | null;
}

/**
 * Fetches quarterly income statement, balance sheet, cash flow, earnings history,
 * and key stats for a single ticker from Yahoo Finance quoteSummary.
 */
async function fetchFinancials(ticker: string) {
  const safe    = encodeURIComponent(ticker);
  const modules = [
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
    'defaultKeyStatistics',
    'earningsHistory',
    'summaryDetail',
  ].join('%2C');

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${safe}?modules=${modules}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const r = data?.quoteSummary?.result?.[0];
  if (!r) return null;

  // ── Income statement (quarterly) ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incomeQtrs: any[] = r.incomeStatementHistory?.incomeStatementHistory ?? [];

  // ── Balance sheet (quarterly) ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const balanceQtrs: any[] = r.balanceSheetHistory?.balanceSheetStatements ?? [];

  // ── Cash flow (quarterly) ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cashQtrs: any[] = r.cashflowStatementHistory?.cashflowStatements ?? [];

  // ── Earnings history (actual vs estimate) ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const earningsHist: any[] = r.earningsHistory?.history ?? [];

  // ── Summary / key stats (latest snapshot) ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kStats: any   = r.defaultKeyStatistics ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: any  = r.summaryDetail ?? {};

  // Build a map from quarter-end timestamp → earnings surprise
  const surpriseByTs: Record<number, { epsEstimate: number; epsSurprisePct: number }> = {};
  for (const e of earningsHist) {
    const ts: number = e.quarter?.raw ?? 0;
    if (ts) {
      surpriseByTs[ts] = {
        epsEstimate:    e.epsEstimate?.raw    ?? 0,
        epsSurprisePct: e.surprisePercent?.raw ?? 0,
      };
    }
  }

  // Build a map from quarter-end timestamp → cash flow row
  const cashByTs: Record<number, { freeCashFlow: number; operatingCashFlow: number }> = {};
  for (const c of cashQtrs) {
    const ts: number = c.endDate?.raw ?? 0;
    if (ts) {
      const ops  = c.totalCashFromOperatingActivities?.raw ?? 0;
      const capex = Math.abs(c.capitalExpenditures?.raw ?? 0);
      cashByTs[ts] = { freeCashFlow: ops - capex, operatingCashFlow: ops };
    }
  }

  // Build a map from quarter-end timestamp → balance sheet row
  const balByTs: Record<number, { bookValue: number; debtToEquity: number; currentRatio: number }> = {};
  for (const b of balanceQtrs) {
    const ts: number = b.endDate?.raw ?? 0;
    if (ts) {
      const equity      = b.totalStockholderEquity?.raw ?? 0;
      const totalDebt   = (b.longTermDebt?.raw ?? 0) + (b.shortLongTermDebt?.raw ?? 0);
      const currentAssets = b.totalCurrentAssets?.raw ?? 0;
      const currentLiab   = b.totalCurrentLiabilities?.raw ?? 0;
      balByTs[ts] = {
        bookValue:    equity,
        debtToEquity: equity > 0 ? totalDebt / equity : 0,
        currentRatio: currentLiab > 0 ? currentAssets / currentLiab : 0,
      };
    }
  }

  // Shared summary-level fields (latest values, applied to all quarters)
  const marketCap:     number = summary.marketCap?.raw      ?? 0;
  const dividendYield: number = summary.dividendYield?.raw  ?? 0;
  const peRatio:       number = summary.trailingPE?.raw     ?? (kStats.trailingPE?.raw ?? 0);
  const priceToBook:   number = kStats.priceToBook?.raw     ?? 0;

  // Combine income statement quarters with their related data
  const quarters: QuarterData[] = incomeQtrs.map((inc): QuarterData | null => {
    const ts: number = inc.endDate?.raw ?? 0;
    const endDate    = ts ? new Date(ts * 1000) : null;
    if (!endDate) return null;

    // Derive Q1/Q2/Q3/Q4 from the quarter-end month
    const month = endDate.getMonth() + 1; // 1-12
    const reportType =
      month <= 3  ? 'Q1' :
      month <= 6  ? 'Q2' :
      month <= 9  ? 'Q3' : 'Q4';

    const surprise = surpriseByTs[ts];
    const cash     = cashByTs[ts];
    const bal      = balByTs[ts];

    return {
      periodEnd:        endDate,
      reportType,
      revenue:          inc.totalRevenue?.raw           ?? null,
      netIncome:        inc.netIncome?.raw               ?? null,
      eps:              inc.basicEPS?.raw                ?? null,
      epsEstimate:      surprise?.epsEstimate            ?? null,
      epsSurprisePct:   surprise?.epsSurprisePct         ?? null,
      operatingMargin:  inc.operatingIncome?.raw && inc.totalRevenue?.raw
                          ? inc.operatingIncome.raw / inc.totalRevenue.raw
                          : null,
      bookValue:        bal?.bookValue                   ?? null,
      debtToEquity:     bal?.debtToEquity                ?? null,
      currentRatio:     bal?.currentRatio                ?? null,
      freeCashFlow:     cash?.freeCashFlow               ?? null,
      operatingCashFlow:cash?.operatingCashFlow          ?? null,
      // Summary-level (latest; not quarter-specific from free API)
      marketCap:        marketCap    || null,
      peRatio:          peRatio      || null,
      priceToBook:      priceToBook  || null,
      dividendYield:    dividendYield || null,
    };
  }).filter((q): q is QuarterData => q !== null);

  return { quarters };
}

// ── Step handlers ─────────────────────────────────────────────────────────────

/** Step init: create StockFetchProgress rows for all tickers in the universe. */
async function stepInit() {
  const tickers = await prisma.stockUniverse.findMany({ select: { ticker: true } });
  let created = 0;

  for (const { ticker } of tickers) {
    for (const dataType of ['ohlc', 'quarterly'] as const) {
      await prisma.stockFetchProgress.upsert({
        where:  { ticker_dataType: { ticker, dataType } },
        update: {},  // keep existing status
        create: { ticker, dataType, status: 'pending' },
      });
      created++;
    }
  }

  return { initialized: tickers.length, progressRows: created };
}

/** Step ohlc: fetch OHLC + dividends + splits for the next `size` pending tickers. */
async function stepOHLC(size: number) {
  const pending = await prisma.stockFetchProgress.findMany({
    where:   { dataType: 'ohlc', status: 'pending' },
    orderBy: { ticker: 'asc' },
    take:    size,
  });

  let done = 0, failed = 0;

  for (const row of pending) {
    try {
      const data = await fetchOHLC(row.ticker);

      if (!data) {
        await prisma.stockFetchProgress.update({
          where:  { ticker_dataType: { ticker: row.ticker, dataType: 'ohlc' } },
          data:   { status: 'failed', errorMessage: 'No data returned', lastFetchedAt: new Date() },
        });
        failed++;
        await sleep(150);
        continue;
      }

      // Upsert OHLC candles
      for (const c of data.candles) {
        await prisma.stockDailyOHLC.upsert({
          where:  { ticker_date: { ticker: row.ticker, date: c.date } },
          update: { open: c.open, high: c.high, low: c.low, close: c.close, adjClose: c.adjClose, volume: c.volume },
          create: { ticker: row.ticker, date: c.date, open: c.open, high: c.high, low: c.low, close: c.close, adjClose: c.adjClose, volume: c.volume },
        });
      }

      // Upsert dividends
      for (const d of data.dividends) {
        await prisma.stockDividend.upsert({
          where:  { ticker_exDate: { ticker: row.ticker, exDate: d.exDate } },
          update: { amount: d.amount },
          create: { ticker: row.ticker, exDate: d.exDate, amount: d.amount },
        });
      }

      // Upsert splits
      for (const sp of data.splits) {
        await prisma.stockSplit.upsert({
          where:  { ticker_date: { ticker: row.ticker, date: sp.date } },
          update: { ratio: sp.ratio },
          create: { ticker: row.ticker, date: sp.date, ratio: sp.ratio },
        });
      }

      await prisma.stockFetchProgress.update({
        where:  { ticker_dataType: { ticker: row.ticker, dataType: 'ohlc' } },
        data:   { status: 'done', lastFetchedAt: new Date(), errorMessage: null },
      });
      done++;
    } catch (err) {
      await prisma.stockFetchProgress.update({
        where:  { ticker_dataType: { ticker: row.ticker, dataType: 'ohlc' } },
        data:   { status: 'failed', errorMessage: String(err), lastFetchedAt: new Date() },
      });
      failed++;
    }

    await sleep(150);
  }

  const remaining = await prisma.stockFetchProgress.count({ where: { dataType: 'ohlc', status: 'pending' } });
  return { done, failed, remaining };
}

/** Step financials: fetch quarterly stats for the next `size` pending tickers. */
async function stepFinancials(size: number) {
  const pending = await prisma.stockFetchProgress.findMany({
    where:   { dataType: 'quarterly', status: 'pending' },
    orderBy: { ticker: 'asc' },
    take:    size,
  });

  let done = 0, failed = 0;

  for (const row of pending) {
    try {
      const data = await fetchFinancials(row.ticker);

      if (!data || data.quarters.length === 0) {
        await prisma.stockFetchProgress.update({
          where:  { ticker_dataType: { ticker: row.ticker, dataType: 'quarterly' } },
          data:   { status: 'failed', errorMessage: 'No quarterly data', lastFetchedAt: new Date() },
        });
        failed++;
        await sleep(200);
        continue;
      }

      for (const q of data.quarters) {
        await prisma.stockQuarterlyStats.upsert({
          where: {
            ticker_periodEnd_reportType: {
              ticker:     row.ticker,
              periodEnd:  q.periodEnd,
              reportType: q.reportType,
            },
          },
          update: {
            revenue:          q.revenue,
            netIncome:        q.netIncome,
            eps:              q.eps,
            epsEstimate:      q.epsEstimate,
            epsSurprisePct:   q.epsSurprisePct,
            operatingMargin:  q.operatingMargin,
            bookValue:        q.bookValue,
            debtToEquity:     q.debtToEquity,
            currentRatio:     q.currentRatio,
            freeCashFlow:     q.freeCashFlow,
            operatingCashFlow:q.operatingCashFlow,
            marketCap:        q.marketCap,
            peRatio:          q.peRatio,
            priceToBook:      q.priceToBook,
            dividendYield:    q.dividendYield,
            fetchedAt:        new Date(),
          },
          create: {
            ticker:           row.ticker,
            periodEnd:        q.periodEnd,
            reportType:       q.reportType,
            revenue:          q.revenue,
            netIncome:        q.netIncome,
            eps:              q.eps,
            epsEstimate:      q.epsEstimate,
            epsSurprisePct:   q.epsSurprisePct,
            operatingMargin:  q.operatingMargin,
            bookValue:        q.bookValue,
            debtToEquity:     q.debtToEquity,
            currentRatio:     q.currentRatio,
            freeCashFlow:     q.freeCashFlow,
            operatingCashFlow:q.operatingCashFlow,
            marketCap:        q.marketCap,
            peRatio:          q.peRatio,
            priceToBook:      q.priceToBook,
            dividendYield:    q.dividendYield,
          },
        });
      }

      await prisma.stockFetchProgress.update({
        where:  { ticker_dataType: { ticker: row.ticker, dataType: 'quarterly' } },
        data:   { status: 'done', lastFetchedAt: new Date(), errorMessage: null },
      });
      done++;
    } catch (err) {
      await prisma.stockFetchProgress.update({
        where:  { ticker_dataType: { ticker: row.ticker, dataType: 'quarterly' } },
        data:   { status: 'failed', errorMessage: String(err), lastFetchedAt: new Date() },
      });
      failed++;
    }

    await sleep(200);
  }

  const remaining = await prisma.stockFetchProgress.count({ where: { dataType: 'quarterly', status: 'pending' } });
  return { done, failed, remaining };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const step = searchParams.get('step');
  const size = Math.min(parseInt(searchParams.get('size') ?? '10', 10), 50);

  try {
    if (step === 'init') {
      const r = await stepInit();
      return NextResponse.json({ step: 'init', ...r });
    }

    if (step === 'ohlc') {
      const r = await stepOHLC(Math.min(size, 25));
      return NextResponse.json({ step: 'ohlc', ...r });
    }

    if (step === 'financials') {
      const r = await stepFinancials(size);
      return NextResponse.json({ step: 'financials', ...r });
    }

    return NextResponse.json(
      { error: 'Pass ?step=init|ohlc|financials' },
      { status: 400 },
    );
  } catch (err) {
    console.error('[seed-history]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** GET – returns progress counts for both data types. */
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [ohlcDone, ohlcPending, ohlcFailed, qDone, qPending, qFailed, ohlcRows, qRows, divRows, splitRows] =
    await Promise.all([
      prisma.stockFetchProgress.count({ where: { dataType: 'ohlc',      status: 'done'    } }),
      prisma.stockFetchProgress.count({ where: { dataType: 'ohlc',      status: 'pending' } }),
      prisma.stockFetchProgress.count({ where: { dataType: 'ohlc',      status: 'failed'  } }),
      prisma.stockFetchProgress.count({ where: { dataType: 'quarterly', status: 'done'    } }),
      prisma.stockFetchProgress.count({ where: { dataType: 'quarterly', status: 'pending' } }),
      prisma.stockFetchProgress.count({ where: { dataType: 'quarterly', status: 'failed'  } }),
      prisma.stockDailyOHLC.count(),
      prisma.stockQuarterlyStats.count(),
      prisma.stockDividend.count(),
      prisma.stockSplit.count(),
    ]);

  return NextResponse.json({
    ohlc:      { done: ohlcDone, pending: ohlcPending, failed: ohlcFailed, totalRows: ohlcRows },
    quarterly: { done: qDone,    pending: qPending,    failed: qFailed,    totalRows: qRows    },
    dividends: { totalRows: divRows },
    splits:    { totalRows: splitRows },
  });
}
