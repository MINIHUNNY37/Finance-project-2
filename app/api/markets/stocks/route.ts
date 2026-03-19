/**
 * GET /api/markets/stocks
 * Query params:
 *   search   – partial ticker or name match (optional)
 *   index    – "nasdaq100" | "sp500" | "all" (default "all")
 *   sector   – filter by sector (optional)
 *   limit    – default 50, max 200
 *   offset   – default 0
 *
 * Returns stocks from StockUniverse joined with StockKeyStats.
 * Used by the sidebar Stock Library panel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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

  const [stocks, total] = await Promise.all([
    prisma.stockUniverse.findMany({
      where,
      include: { stats: true },
      orderBy: { ticker: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.stockUniverse.count({ where }),
  ]);

  return NextResponse.json({ stocks, total, offset, limit });
}
