import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export interface NewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: number; // Unix timestamp (seconds)
  summary?: string;
  ticker?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickers = searchParams.get('tickers'); // comma-separated, e.g. "AAPL,TSLA"

  if (!tickers) {
    return NextResponse.json({ error: 'No tickers provided' }, { status: 400 });
  }

  const symbols = tickers
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 10); // cap at 10 tickers

  const allNews: NewsItem[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=8&enableFuzzyQuery=false&newsQueryTypes=article`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          next: { revalidate: 300 },
        });
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        const items = data?.news ?? [];
        for (const item of items) {
          const key = item.uuid ?? item.link ?? item.title;
          if (seen.has(key)) continue;
          seen.add(key);
          allNews.push({
            title: item.title ?? '',
            link: item.link ?? '',
            publisher: item.publisher ?? '',
            publishedAt: item.providerPublishTime ?? 0,
            summary: item.summary,
            ticker: symbol,
          });
        }
      } catch {
        // ignore per-ticker errors
      }
    })
  );

  // Sort by newest first
  allNews.sort((a, b) => b.publishedAt - a.publishedAt);

  return NextResponse.json({ news: allNews.slice(0, 40) });
}
