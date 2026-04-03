/**
 * GET /api/markets/stocks
 * Query params:
 *   search   – partial ticker or name match (optional)
 *   index    – "nasdaq100" | "sp500" | "all" (default "all")
 *   sector   – filter by sector (optional)
 *   limit    – default 50, max 200
 *   offset   – default 0
 *
 * Returns stocks from StockUniverse joined with the latest StockQuarterlyStats.
 * The response shape preserves a `stats` field for Sidebar compatibility.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

function formatFinancialVal(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toFixed(2)}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const index  = searchParams.get('index')  ?? 'all';
  const sector = searchParams.get('sector') ?? '';
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50',  10), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { ticker: { contains: search.toUpperCase() } },
      { name:   { contains: search, mode: 'insensitive' } },
    ];
  }
  if (index === 'nasdaq100') where.isNasdaq100 = true;
  if (index === 'sp500')     where.isSP500     = true;
  if (sector)                where.sector      = sector;

  const [rawStocks, total] = await Promise.all([
    prisma.stockUniverse.findMany({
      where,
      include: {
        quarterlyStats: {
          orderBy: { periodEnd: 'desc' },
          take: 10, // grab enough to find both a snapshot and a quarterly row
        },
      },
      orderBy: { ticker: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.stockUniverse.count({ where }),
  ]);

  // Map to a `stats` shape the Sidebar expects (same fields as old StockKeyStats)
  const stocks = rawStocks.map(({ quarterlyStats, ...s }) => {
    const snapshot = quarterlyStats.find(r => r.reportType === 'snapshot') ?? null;
    const quarterly = quarterlyStats.find(r => ['Q1','Q2','Q3','Q4'].includes(r.reportType)) ?? null;
    // Merge: price fields from snapshot, financials from quarterly (fallback to the other if one is missing)
    const q = snapshot ?? quarterly;
    const f = quarterly ?? snapshot;
    return {
      ...s,
      stats: q ? {
        // Price snapshot (from snapshot row)
        price:            q.price,
        priceChange:      q.priceChange,
        priceChangePct:   q.priceChangePct,
        week52High:       q.week52High,
        week52Low:        q.week52Low,
        // Valuation (prefer quarterly, snapshot has marketCap/peRatio too)
        marketCap:        f?.marketCapFmt ?? (f?.marketCap ? formatMarketCap(f.marketCap) : null),
        peRatio:          f?.peRatio      ? f.peRatio.toFixed(2)      : null,
        priceToBook:      f?.priceToBook  ? f.priceToBook.toFixed(2)  : null,
        // Income statement (from quarterly row)
        revenue:          f?.revenue      ? formatFinancialVal(f.revenue)      : null,
        netIncome:        f?.netIncome    ? formatFinancialVal(f.netIncome)    : null,
        eps:              f?.eps          ? `$${f.eps.toFixed(2)}`             : null,
        epsEstimate:      f?.epsEstimate  ? `$${f.epsEstimate.toFixed(2)}`     : null,
        epsSurprisePct:   f?.epsSurprisePct != null
          ? `${f.epsSurprisePct >= 0 ? '+' : ''}${f.epsSurprisePct.toFixed(1)}%`
          : null,
        // Balance sheet (from quarterly row)
        bookValue:        f?.bookValue    ? `$${f.bookValue.toFixed(2)}`       : null,
        debtToEquity:     f?.debtToEquity ? f.debtToEquity.toFixed(2)          : null,
        currentRatio:     f?.currentRatio ? f.currentRatio.toFixed(2)          : null,
        // Cash flow (from quarterly row)
        freeCashFlow:     f?.freeCashFlow      ? formatFinancialVal(f.freeCashFlow)      : null,
        operatingCashFlow: f?.operatingCashFlow ? formatFinancialVal(f.operatingCashFlow) : null,
        // Returns / yield (from quarterly row)
        operatingMargin:  f?.operatingMargin
          ? `${(f.operatingMargin * 100).toFixed(1)}%`
          : null,
        dividendYield:    f?.dividendYield
          ? `${(f.dividendYield * 100).toFixed(2)}%`
          : null,
        // Period metadata (from whichever financial row we used)
        periodEnd:        f?.periodEnd ?? q.periodEnd,
        reportType:       f?.reportType ?? q.reportType,
        fetchedAt:        f?.fetchedAt  ?? q.fetchedAt,
      } : null,
    };
  });

  return NextResponse.json({ stocks, total, offset, limit });
}
