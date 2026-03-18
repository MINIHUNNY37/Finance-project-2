import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface StockQuote {
  price: number;
  change: number;
  changePct: number;
  marketCap: string;
  peRatio: string;
  week52Low: number;
  week52High: number;
  currency: string;
  shortName: string;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json({ error: 'No data returned' }, { status: 404 });
    }

    const meta = result.meta;
    const price: number = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
    const prevClose: number = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change = price - prevClose;
    const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;
    const marketCap: number | undefined = meta.marketCap;
    const peRatio: number | undefined = meta.trailingPE;
    const week52Low: number = meta.fiftyTwoWeekLow ?? 0;
    const week52High: number = meta.fiftyTwoWeekHigh ?? 0;

    const quote: StockQuote = {
      price,
      change,
      changePct,
      marketCap: marketCap != null ? formatMarketCap(marketCap) : 'N/A',
      peRatio: peRatio != null ? peRatio.toFixed(2) : 'N/A',
      week52Low,
      week52High,
      currency: meta.currency ?? 'USD',
      shortName: meta.longName ?? meta.shortName ?? symbol,
    };

    return NextResponse.json(quote);
  } catch (err) {
    console.error('Stock fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
