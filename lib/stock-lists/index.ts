export type { StockEntry } from './nasdaq100';
export { NASDAQ100 } from './nasdaq100';
export { SP500 } from './sp500';

/** All unique companies across both indices (NASDAQ-100 union S&P500) */
import { NASDAQ100 } from './nasdaq100';
import { SP500 } from './sp500';
import type { StockEntry } from './nasdaq100';

export function getAllStocks(): { stock: StockEntry; isNasdaq100: boolean; isSP500: boolean }[] {
  const nasdaq100Tickers = new Set(NASDAQ100.map(s => s.ticker));
  const sp500Tickers    = new Set(SP500.map(s => s.ticker));

  const map = new Map<string, { stock: StockEntry; isNasdaq100: boolean; isSP500: boolean }>();

  for (const s of NASDAQ100) {
    map.set(s.ticker, { stock: s, isNasdaq100: true, isSP500: sp500Tickers.has(s.ticker) });
  }
  for (const s of SP500) {
    if (!map.has(s.ticker)) {
      map.set(s.ticker, { stock: s, isNasdaq100: nasdaq100Tickers.has(s.ticker), isSP500: true });
    } else {
      map.get(s.ticker)!.isSP500 = true;
    }
  }

  return Array.from(map.values());
}
