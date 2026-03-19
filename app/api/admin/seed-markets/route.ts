/**
 * POST /api/admin/seed-markets
 *
 * Admin-only endpoint that populates the market universe tables and builds
 * the pre-organised template maps for NASDAQ-100 and S&P 500.
 *
 * Steps (pass ?step=1|2|3 or omit to run all):
 *   1 – Upsert StockUniverse rows from static lists (fast, no external calls)
 *   2 – Fetch key stats + 30-day OHLC from Yahoo Finance (slow, batched)
 *       Pass ?offset=0&limit=50 to paginate through stocks
 *   3 – Build & save TemplateMap from DB (runs after step 2 completes)
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAllStocks } from '@/lib/stock-lists';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, Folder, ScenarioMap } from '@/app/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

function sectorIcon(sector: string): string {
  const m: Record<string, string> = {
    'Technology': '💻',
    'Communication Services': '📺',
    'Consumer Discretionary': '🛒',
    'Consumer Staples': '🛒',
    'Healthcare': '🏥',
    'Financials': '💰',
    'Industrials': '🏭',
    'Energy': '⚡',
    'Materials': '⛏️',
    'Real Estate': '🏗️',
    'Utilities': '🔋',
  };
  return m[sector] ?? '🏢';
}

function sectorColor(sector: string): string {
  const m: Record<string, string> = {
    'Technology': '#3B82F6',
    'Communication Services': '#06B6D4',
    'Consumer Discretionary': '#F59E0B',
    'Consumer Staples': '#10B981',
    'Healthcare': '#EC4899',
    'Financials': '#F97316',
    'Industrials': '#8B5CF6',
    'Energy': '#EF4444',
    'Materials': '#6366F1',
    'Real Estate': '#14B8A6',
    'Utilities': '#84CC16',
  };
  return m[sector] ?? '#6B7280';
}

/** Fetch quote + OHLC from Yahoo Finance for a single ticker */
async function fetchYahoo(ticker: string) {
  const safe = encodeURIComponent(ticker);
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${safe}?interval=1d&range=1mo`;

  const res = await fetch(chartUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta;
  const price: number       = meta.regularMarketPrice ?? 0;
  const prevClose: number   = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const change              = price - prevClose;
  const changePct           = prevClose ? (change / prevClose) * 100 : 0;
  const marketCap: number   = meta.marketCap ?? 0;
  const peRatio: number     = meta.trailingPE ?? 0;
  const week52High: number  = meta.fiftyTwoWeekHigh ?? 0;
  const week52Low: number   = meta.fiftyTwoWeekLow ?? 0;
  const shortName: string   = meta.longName ?? meta.shortName ?? ticker;

  // OHLC candles
  const timestamps: number[]  = result.timestamp ?? [];
  const ohlc = result.indicators?.quote?.[0] ?? {};
  const opens: number[]   = ohlc.open   ?? [];
  const highs: number[]   = ohlc.high   ?? [];
  const lows: number[]    = ohlc.low    ?? [];
  const closes: number[]  = ohlc.close  ?? [];
  const volumes: number[] = ohlc.volume ?? [];

  const candles = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000),
      open:   opens[i]   ?? 0,
      high:   highs[i]   ?? 0,
      low:    lows[i]    ?? 0,
      close:  closes[i]  ?? 0,
      volume: BigInt(Math.round(volumes[i] ?? 0)),
    }))
    .filter(c => c.open > 0 && c.close > 0);

  return {
    shortName,
    price,
    change,
    changePct,
    marketCap: marketCap ? formatMarketCap(marketCap) : 'N/A',
    marketCapRaw: marketCap,
    peRatio: peRatio ? peRatio.toFixed(2) : 'N/A',
    week52High,
    week52Low,
    candles,
  };
}

// ─── step 1: upsert StockUniverse ───────────────────────────────────────────

async function stepPopulateUniverse() {
  const stocks = getAllStocks();
  let upserted = 0;
  for (const { stock, isNasdaq100, isSP500 } of stocks) {
    await prisma.stockUniverse.upsert({
      where: { ticker: stock.ticker },
      update: {
        name: stock.name,
        exchange: stock.exchange,
        sector: stock.sector,
        industry: stock.industry,
        isNasdaq100,
        isSP500,
      },
      create: {
        ticker: stock.ticker,
        name: stock.name,
        exchange: stock.exchange,
        sector: stock.sector,
        industry: stock.industry,
        country: 'US',
        isNasdaq100,
        isSP500,
      },
    });
    upserted++;
  }
  return { upserted, total: stocks.length };
}

// ─── step 2: fetch stats + OHLC ─────────────────────────────────────────────

async function stepFetchData(offset: number, limit: number) {
  const stocks = await prisma.stockUniverse.findMany({
    skip: offset,
    take: limit,
    orderBy: { ticker: 'asc' },
  });

  let fetched = 0, failed = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const stock of stocks) {
    try {
      const data = await fetchYahoo(stock.ticker);
      if (!data) { failed++; continue; }

      // Upsert latest snapshot into StockQuarterlyStats (reportType="snapshot")
      const peRatioNum = data.peRatio !== 'N/A' ? parseFloat(data.peRatio) : null;
      await prisma.stockQuarterlyStats.upsert({
        where: { ticker_periodEnd_reportType: { ticker: stock.ticker, periodEnd: today, reportType: 'snapshot' } },
        update: {
          price:          data.price,
          priceChange:    data.change,
          priceChangePct: data.changePct,
          marketCap:      data.marketCapRaw || null,
          marketCapFmt:   data.marketCap !== 'N/A' ? data.marketCap : null,
          peRatio:        peRatioNum,
          week52High:     data.week52High || null,
          week52Low:      data.week52Low  || null,
          fetchedAt:      new Date(),
        },
        create: {
          ticker:         stock.ticker,
          periodEnd:      today,
          reportType:     'snapshot',
          price:          data.price,
          priceChange:    data.change,
          priceChangePct: data.changePct,
          marketCap:      data.marketCapRaw || null,
          marketCapFmt:   data.marketCap !== 'N/A' ? data.marketCap : null,
          peRatio:        peRatioNum,
          week52High:     data.week52High || null,
          week52Low:      data.week52Low  || null,
        },
      });

      // Upsert OHLC candles
      for (const c of data.candles) {
        await prisma.stockDailyOHLC.upsert({
          where: { ticker_date: { ticker: stock.ticker, date: c.date } },
          update: { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume },
          create: { ticker: stock.ticker, date: c.date, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume },
        });
      }

      fetched++;
    } catch {
      failed++;
    }

    // Polite rate-limit: ~120ms between calls (~8 req/s)
    await sleep(120);
  }

  return { fetched, failed, total: stocks.length, offset, limit };
}

// ─── step 3: build template map ──────────────────────────────────────────────

async function stepBuildTemplate() {
  const stocks = await prisma.stockUniverse.findMany({
    include: {
      quarterlyStats: {
        orderBy: { periodEnd: 'desc' },
        take: 1,
      },
    },
    orderBy: { ticker: 'asc' },
  });

  const now = new Date().toISOString();
  const COLS = 10;
  const SPACING_X = 200;
  const SPACING_Y = 180;

  // ── Build entities ──
  const entities: Entity[] = stocks.map((s, i) => {
    const stats = s.quarterlyStats[0] ?? null;
    const statistics = [
      { id: uuidv4(), name: 'Price',          value: stats?.price          ? `$${stats.price.toFixed(2)}`              : 'N/A' },
      { id: uuidv4(), name: 'Market Cap',     value: stats?.marketCapFmt   ?? (stats?.marketCap ? formatMarketCap(stats.marketCap) : 'N/A') },
      { id: uuidv4(), name: 'P/E Ratio',      value: stats?.peRatio        ? stats.peRatio.toFixed(2)                  : 'N/A' },
      { id: uuidv4(), name: 'EPS (TTM)',      value: stats?.eps             ? `$${stats.eps.toFixed(2)}`               : 'N/A' },
      { id: uuidv4(), name: 'Dividend Yield', value: stats?.dividendYield  ? `${(stats.dividendYield * 100).toFixed(2)}%` : 'N/A' },
    ];

    const col = i % COLS;
    const row = Math.floor(i / COLS);

    return {
      id:           uuidv4(),
      name:         s.name,
      icon:         sectorIcon(s.sector ?? ''),
      subtitle:     `${s.ticker} · ${s.exchange}`,
      description:  `${s.sector ?? 'N/A'} — ${s.industry ?? 'N/A'}`,
      subItems:     [],
      statistics,
      color:        sectorColor(s.sector ?? ''),
      country:      s.country,
      position:     { x: 100 + col * SPACING_X, y: 100 + row * SPACING_Y },
      locked:       false,
      fixedSize:    false,
      hidden:       false,
      createdBy:    'system',
      createdAt:    now,
      updatedAt:    now,
      ticker:         s.ticker,
      livePrice:      stats?.price           ?? undefined,
      priceChange:    stats?.priceChange     ?? undefined,
      priceChangePct: stats?.priceChangePct  ?? undefined,
      marketCap:      stats?.marketCapFmt    ?? (stats?.marketCap ? formatMarketCap(stats.marketCap) : undefined),
      peRatio:        stats?.peRatio         ? stats.peRatio.toFixed(2) : undefined,
      week52Low:      stats?.week52Low       ?? undefined,
      week52High:     stats?.week52High      ?? undefined,
      sector:         s.sector               ?? undefined,
    };
  });

  // Build a ticker→entityId lookup
  const tickerToEntityId = new Map<string, string>(
    stocks.map((s, i) => [s.ticker, entities[i].id])
  );

  // ── Build folders ──
  const nasdaqEntityIds = stocks
    .filter(s => s.isNasdaq100)
    .map(s => tickerToEntityId.get(s.ticker)!)
    .filter(Boolean);

  const sp500EntityIds = stocks
    .filter(s => s.isSP500)
    .map(s => tickerToEntityId.get(s.ticker)!)
    .filter(Boolean);

  const folders: Folder[] = [
    {
      id:        uuidv4(),
      name:      'NASDAQ-100',
      color:     '#3B82F6',
      entityIds: nasdaqEntityIds,
      createdBy: 'system',
      createdAt: now,
    },
    {
      id:        uuidv4(),
      name:      'S&P 500',
      color:     '#10B981',
      entityIds: sp500EntityIds,
      createdBy: 'system',
      createdAt: now,
    },
  ];

  // Assign folderId on entities (use primary index: nasdaq100 first, else sp500)
  const nasdaq100Set = new Set(stocks.filter(s => s.isNasdaq100).map(s => s.ticker));
  const sp500Set     = new Set(stocks.filter(s => s.isSP500).map(s => s.ticker));
  for (const entity of entities) {
    if (!entity.ticker) continue;
    if (nasdaq100Set.has(entity.ticker)) {
      entity.folderId = folders[0].id;
    } else if (sp500Set.has(entity.ticker)) {
      entity.folderId = folders[1].id;
    }
  }

  const map: ScenarioMap = {
    id:           uuidv4(),
    name:         'NASDAQ-100 & S&P 500 — Market Universe',
    description:  'Pre-populated map of all NASDAQ-100 and S&P 500 companies with live stats. Use as a starting point for your own scenario maps.',
    entities,
    relationships: [],
    folders,
    geoEvents:    [],
    connectionFolders: [],
    geoEventFolders:   [],
    ownerId:      'system',
    sharedWith:   [],
    mapType:      'plain',
    createdAt:    now,
    updatedAt:    now,
  };

  // Save or replace the template
  const existing = await prisma.templateMap.findFirst({
    where: { category: 'markets' },
  });

  if (existing) {
    await prisma.templateMap.update({
      where: { id: existing.id },
      data:  { data: JSON.stringify(map), updatedAt: new Date() },
    });
  } else {
    await prisma.templateMap.create({
      data: {
        name:        map.name,
        description: map.description,
        category:    'markets',
        data:        JSON.stringify(map),
        isActive:    true,
      },
    });
  }

  return {
    entityCount:  entities.length,
    nasdaqCount:  nasdaqEntityIds.length,
    sp500Count:   sp500EntityIds.length,
    folderCount:  folders.length,
  };
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin check
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const step   = searchParams.get('step');          // "1" | "2" | "3" | null (all)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit  = parseInt(searchParams.get('limit')  ?? '50', 10);

  try {
    if (!step || step === '1') {
      const r1 = await stepPopulateUniverse();
      if (step === '1') return NextResponse.json({ step: 1, ...r1 });
    }

    if (!step || step === '2') {
      const r2 = await stepFetchData(offset, Math.min(limit, 100));
      if (step === '2') return NextResponse.json({ step: 2, ...r2 });
    }

    if (!step || step === '3') {
      const r3 = await stepBuildTemplate();
      if (step === '3') return NextResponse.json({ step: 3, ...r3 });
    }

    // All steps completed (small universe only — for large sets use step=2 with pagination)
    return NextResponse.json({ ok: true, message: 'Seed complete. Run step=2 with pagination for full data fetch.' });
  } catch (err) {
    console.error('[seed-markets]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** GET — returns seeding status (counts from DB) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [universeCount, statsCount, ohlcCount, templateCount] = await Promise.all([
    prisma.stockUniverse.count(),
    prisma.stockQuarterlyStats.count(),
    prisma.stockDailyOHLC.count(),
    prisma.templateMap.count({ where: { category: 'markets' } }),
  ]);

  return NextResponse.json({ universeCount, statsCount, ohlcCount, templateCount });
}
