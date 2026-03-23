/**
 * POST /api/admin/fetch-live
 *
 * Admin-only endpoint that fetches live market data from Yahoo Finance for all
 * companies in the stock universe and persists each run as a dated snapshot.
 *
 * Data source: Yahoo Finance quoteSummary (price + summaryDetail +
 *              defaultKeyStatistics + financialData modules)
 *
 * Storage: StockQuarterlyStats with reportType = "snapshot"
 *   Composite PK  →  (ticker, periodEnd, reportType)
 *   periodEnd     →  today's date (UTC midnight)
 *
 * Calling this endpoint once per day therefore builds a complete time-series:
 *   AAPL + 2026-03-23 + "snapshot"
 *   AAPL + 2026-03-24 + "snapshot"  …and so on
 *
 * Query params (POST):
 *   ?offset=0   – skip N tickers (for pagination across the full universe)
 *   ?limit=50   – process up to N tickers per call (max 100)
 *
 * GET /api/admin/fetch-live
 *   Returns snapshot counts per date for the last 7 calendar days so you can
 *   verify coverage without querying the DB directly.
 *
 * Typical workflow to refresh all ~600 tickers:
 *   POST ?offset=0&limit=100
 *   POST ?offset=100&limit=100
 *   POST ?offset=200&limit=100
 *   … (repeat until remaining = 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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

function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

// ── Yahoo Finance fetcher ────────────────────────────────────────────────────

interface LiveQuote {
  price:             number | null;
  priceChange:       number | null;
  priceChangePct:    number | null;
  marketCap:         number | null;
  marketCapFmt:      string | null;
  peRatio:           number | null;
  priceToBook:       number | null;
  week52High:        number | null;
  week52Low:         number | null;
  eps:               number | null;
  dividendYield:     number | null;
  revenue:           number | null;
  netIncome:         number | null;
  operatingMargin:   number | null;
  freeCashFlow:      number | null;
  operatingCashFlow: number | null;
  debtToEquity:      number | null;
  currentRatio:      number | null;
  bookValue:         number | null;
}

/**
 * Calls Yahoo Finance quoteSummary with four modules to get a rich snapshot
 * of current price, valuation, and fundamental data for one ticker.
 *
 * Modules used:
 *   price               – regularMarketPrice, change, marketCap, 52-week range
 *   summaryDetail       – trailingPE, dividendYield, 52-week range
 *   defaultKeyStatistics – trailingEps, priceToBook, bookValue
 *   financialData       – revenue, netIncome, margins, cash flow, leverage
 */
async function fetchLiveQuote(ticker: string): Promise<LiveQuote | null> {
  const safe    = encodeURIComponent(ticker);
  const modules = [
    'price',
    'summaryDetail',
    'defaultKeyStatistics',
    'financialData',
  ].join('%2C');

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${safe}?modules=${modules}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const r = data?.quoteSummary?.result?.[0];
  if (!r) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const price:   any = r.price               ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: any = r.summaryDetail        ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kStats:  any = r.defaultKeyStatistics ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fin:     any = r.financialData        ?? {};

  const regularPrice: number = price.regularMarketPrice?.raw ?? 0;
  const mktCap:       number = price.marketCap?.raw           ?? 0;

  // debtToEquity from Yahoo is expressed as a percentage (e.g. 186.2 = 1.862×)
  const rawDE = fin.debtToEquity?.raw;
  const debtToEquity = rawDE != null ? rawDE / 100 : null;

  return {
    price:             regularPrice || null,
    priceChange:       price.regularMarketChange?.raw             ?? null,
    priceChangePct:    price.regularMarketChangePercent?.raw != null
                         ? price.regularMarketChangePercent.raw * 100
                         : null,
    marketCap:         mktCap       || null,
    marketCapFmt:      mktCap       ? formatMarketCap(mktCap) : null,

    // P/E: prefer summary (trailing), fall back to key-stats
    peRatio:           (summary.trailingPE?.raw ?? kStats.trailingPE?.raw) || null,
    priceToBook:       kStats.priceToBook?.raw                     ?? null,
    week52High:        (summary.fiftyTwoWeekHigh?.raw ?? price.fiftyTwoWeekHigh?.raw) || null,
    week52Low:         (summary.fiftyTwoWeekLow?.raw  ?? price.fiftyTwoWeekLow?.raw)  || null,
    eps:               kStats.trailingEps?.raw                     ?? null,
    dividendYield:     summary.dividendYield?.raw                  ?? null,

    // Income statement (TTM from financialData)
    revenue:           fin.totalRevenue?.raw                       ?? null,
    netIncome:         fin.netIncomeToCommon?.raw                  ?? null,
    operatingMargin:   fin.operatingMargins?.raw                   ?? null,

    // Cash flow (TTM)
    freeCashFlow:      fin.freeCashflow?.raw                       ?? null,
    operatingCashFlow: fin.operatingCashflow?.raw                  ?? null,

    // Balance sheet
    debtToEquity,
    currentRatio:      fin.currentRatio?.raw                       ?? null,
    bookValue:         kStats.bookValue?.raw                       ?? null,
  };
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const offset = Math.max(0,   parseInt(searchParams.get('offset') ?? '0',   10));
  const limit  = Math.min(100, parseInt(searchParams.get('limit')  ?? '50',  10));

  // Load this batch of tickers from the universe
  const stocks = await prisma.stockUniverse.findMany({
    skip:    offset,
    take:    limit,
    orderBy: { ticker: 'asc' },
    select:  { ticker: true },
  });

  // Use UTC midnight today as the snapshot date (idempotent — re-running today
  // overwrites the same row; running tomorrow creates a new row)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let fetched = 0;
  let failed  = 0;
  const errors: { ticker: string; reason: string }[] = [];

  for (const { ticker } of stocks) {
    try {
      const q = await fetchLiveQuote(ticker);

      if (!q || q.price === null) {
        failed++;
        errors.push({ ticker, reason: 'no data returned' });
        await sleep(150);
        continue;
      }

      await prisma.stockQuarterlyStats.upsert({
        where: {
          ticker_periodEnd_reportType: {
            ticker,
            periodEnd:  today,
            reportType: 'snapshot',
          },
        },
        update: {
          price:             q.price,
          priceChange:       q.priceChange,
          priceChangePct:    q.priceChangePct,
          marketCap:         q.marketCap,
          marketCapFmt:      q.marketCapFmt,
          peRatio:           q.peRatio,
          priceToBook:       q.priceToBook,
          week52High:        q.week52High,
          week52Low:         q.week52Low,
          eps:               q.eps,
          dividendYield:     q.dividendYield,
          revenue:           q.revenue,
          netIncome:         q.netIncome,
          operatingMargin:   q.operatingMargin,
          freeCashFlow:      q.freeCashFlow,
          operatingCashFlow: q.operatingCashFlow,
          debtToEquity:      q.debtToEquity,
          currentRatio:      q.currentRatio,
          bookValue:         q.bookValue,
          fetchedAt:         new Date(),
        },
        create: {
          ticker,
          periodEnd:         today,
          reportType:        'snapshot',
          price:             q.price,
          priceChange:       q.priceChange,
          priceChangePct:    q.priceChangePct,
          marketCap:         q.marketCap,
          marketCapFmt:      q.marketCapFmt,
          peRatio:           q.peRatio,
          priceToBook:       q.priceToBook,
          week52High:        q.week52High,
          week52Low:         q.week52Low,
          eps:               q.eps,
          dividendYield:     q.dividendYield,
          revenue:           q.revenue,
          netIncome:         q.netIncome,
          operatingMargin:   q.operatingMargin,
          freeCashFlow:      q.freeCashFlow,
          operatingCashFlow: q.operatingCashFlow,
          debtToEquity:      q.debtToEquity,
          currentRatio:      q.currentRatio,
          bookValue:         q.bookValue,
        },
      });

      fetched++;
    } catch (err) {
      failed++;
      errors.push({ ticker, reason: String(err) });
    }

    // Polite rate-limit: ~150 ms between requests (~6–7 req/s)
    await sleep(150);
  }

  const totalUniverse = await prisma.stockUniverse.count();

  return NextResponse.json({
    date:          today.toISOString().split('T')[0],
    fetched,
    failed,
    offset,
    limit,
    batchSize:     stocks.length,
    totalUniverse,
    remaining:     Math.max(0, totalUniverse - offset - stocks.length),
    ...(errors.length > 0 && { errors }),
  });
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [totalTickers, recentSnapshots] = await Promise.all([
    prisma.stockUniverse.count(),
    prisma.stockQuarterlyStats.groupBy({
      by:      ['periodEnd'],
      where:   { reportType: 'snapshot' },
      _count:  { ticker: true },
      orderBy: { periodEnd: 'desc' },
      take:    7,
    }),
  ]);

  return NextResponse.json({
    totalTickers,
    // Last 7 dates that have at least one snapshot stored
    recentSnapshots: recentSnapshots.map(r => ({
      date:  r.periodEnd.toISOString().split('T')[0],
      count: r._count.ticker,
    })),
    note: 'POST ?offset=0&limit=100 to fetch a batch. Repeat with increasing offset until remaining=0.',
  });
}
