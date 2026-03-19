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
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
          take: 1,
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
    const q = quarterlyStats[0] ?? null;
    return {
      ...s,
      stats: q ? {
        price:          q.price,
        priceChange:    q.priceChange,
        priceChangePct: q.priceChangePct,
        marketCap:      q.marketCapFmt ?? (q.marketCap ? formatMarketCap(q.marketCap) : null),
        peRatio:        q.peRatio      ? q.peRatio.toFixed(2) : null,
        eps:            q.eps          ? q.eps.toFixed(2)     : null,
        dividendYield:  q.dividendYield ? `${(q.dividendYield * 100).toFixed(2)}%` : null,
        week52High:     q.week52High,
        week52Low:      q.week52Low,
        fetchedAt:      q.fetchedAt,
      } : null,
    };
  });

  return NextResponse.json({ stocks, total, offset, limit });
}
