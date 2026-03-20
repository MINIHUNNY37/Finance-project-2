/**
 * GET /api/stocks/[ticker]/flashcard
 *
 * Returns all data needed to render the 5-page stock flashcard:
 *   Page 1 – Summary (price, fair value, quality/health score, macro sensitivity)
 *   Page 2 – Valuation (PE history, peer comparison, historical percentile)
 *   Page 3 – Financial Health (ratios, OCF/FCF trends, traffic-light signals)
 *   Page 4 – Earnings Quality (margins, ROE, cash-flow quality, history charts)
 *   Page 5 – Macro Sensitivity (sector-based factor ratings)
 *
 * All computations are derived from existing StockQuarterlyStats rows.
 * No new DB tables required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

type Signal = 'Strong' | 'Average' | 'Weak';
type Sensitivity = 'High' | 'Medium' | 'Low';
type Direction = 'Positive' | 'Negative' | 'Neutral';

interface MacroFactor {
  name: string;
  sensitivity: Sensitivity;
  direction: Direction;
  note: string;
}

export interface FlashcardResponse {
  ticker: string;
  name: string;
  sector: string | null;
  exchange: string;
  industry: string | null;

  summary: {
    currentPrice: number | null;
    priceChange: number | null;
    priceChangePct: number | null;
    estimatedFairValue: number | null;
    discountPct: number | null;       // positive = stock trading below fair value
    qualityScore: number;             // 0–10
    healthScore: number;              // 0–10
    macroSensitivity: Sensitivity;
    summaryLines: string[];
  };

  valuation: {
    currentPE: number | null;
    currentPB: number | null;
    fiveYearAvgPE: number | null;
    industryAvgPE: number | null;
    historicalPercentile: number | null; // 0–100, lower = cheaper vs own history
    peHistory: { period: string; value: number }[];
    peers: { name: string; ticker: string; pe: number }[];
  };

  health: {
    currentRatio: number | null;
    debtToEquity: number | null;
    latestFCF: number | null;
    latestOCF: number | null;
    ocfTrend: { period: string; value: number }[];
    fcfTrend: { period: string; value: number }[];
    signals: {
      interestCoverage: Signal;
      netDebtEBITDA: Signal;
      fcfConsistency: 'Consistent' | 'Volatile' | 'Declining';
      liquidity: Signal;
    };
  };

  earnings: {
    revenueGrowth: number | null;
    operatingMargin: number | null;
    roe: number | null;
    cfoToNetIncomeRatio: number | null;
    fcfMargin: number | null;
    history: {
      period: string;
      revenue: number | null;
      operatingProfit: number | null;
      netIncome: number | null;
      ocf: number | null;
      fcf: number | null;
    }[];
    insights: string[];
  };

  macro: {
    factors: MacroFactor[];
    basis: string;
  };
}

// ── Macro sensitivity profiles by sector ─────────────────────────────────────
// Ratings are heuristic based on typical sector characteristics.

const MACRO_PROFILES: Record<string, MacroFactor[]> = {
  'Technology': [
    { name: 'Interest Rates',  sensitivity: 'High',   direction: 'Negative', note: 'Growth stocks hit hard by rate rises — higher discount rates compress valuations' },
    { name: 'USD Strength',    sensitivity: 'High',   direction: 'Negative', note: 'Large overseas revenue base means a strong USD shrinks reported earnings' },
    { name: 'Oil Price',       sensitivity: 'Low',    direction: 'Neutral',  note: 'Energy is a small cost component; limited direct exposure' },
    { name: 'VIX (Volatility)',sensitivity: 'High',   direction: 'Negative', note: 'Risk-off periods disproportionately sell high-multiple tech names' },
    { name: 'CPI Inflation',   sensitivity: 'Medium', direction: 'Negative', note: 'Input costs (wages, cloud infra) rise but pricing power often offsets' },
    { name: 'Credit Spreads',  sensitivity: 'High',   direction: 'Negative', note: 'Wide spreads signal risk aversion; growth stocks underperform' },
  ],
  'Financials': [
    { name: 'Interest Rates',  sensitivity: 'High',   direction: 'Positive', note: 'Higher rates expand net interest margins for banks and insurers' },
    { name: 'USD Strength',    sensitivity: 'Low',    direction: 'Neutral',  note: 'Mostly domestic operations; limited FX exposure for US banks' },
    { name: 'Oil Price',       sensitivity: 'Low',    direction: 'Negative', note: 'Energy loan books take losses in oil downturns' },
    { name: 'VIX (Volatility)',sensitivity: 'High',   direction: 'Negative', note: 'Credit risk rises, trading losses spike in volatility events' },
    { name: 'CPI Inflation',   sensitivity: 'Medium', direction: 'Positive', note: 'Moderate inflation supports loan growth and rate hikes' },
    { name: 'Credit Spreads',  sensitivity: 'High',   direction: 'Negative', note: 'Wide spreads signal loan defaults and balance sheet stress' },
  ],
  'Energy': [
    { name: 'Interest Rates',  sensitivity: 'Medium', direction: 'Negative', note: 'Capital-intensive sector; higher rates raise project financing costs' },
    { name: 'USD Strength',    sensitivity: 'High',   direction: 'Negative', note: 'Oil is USD-priced; a strong dollar reduces volume for foreign buyers' },
    { name: 'Oil Price',       sensitivity: 'High',   direction: 'Positive', note: 'Revenue directly tracks oil price; primary earnings driver' },
    { name: 'VIX (Volatility)',sensitivity: 'Medium', direction: 'Negative', note: 'Selloffs hit cyclicals; oil demand outlook weakens' },
    { name: 'CPI Inflation',   sensitivity: 'High',   direction: 'Positive', note: 'Energy is a major CPI component; companies benefit as input prices rise' },
    { name: 'Credit Spreads',  sensitivity: 'Medium', direction: 'Negative', note: 'High-yield energy firms vulnerable to refinancing risk' },
  ],
  'Healthcare': [
    { name: 'Interest Rates',  sensitivity: 'Low',    direction: 'Neutral',  note: 'Defensive sector with stable cash flows; limited rate sensitivity' },
    { name: 'USD Strength',    sensitivity: 'Medium', direction: 'Negative', note: 'Global pharma revenue impacted; overseas sales translate at lower rates' },
    { name: 'Oil Price',       sensitivity: 'Low',    direction: 'Neutral',  note: 'Negligible direct exposure' },
    { name: 'VIX (Volatility)',sensitivity: 'Low',    direction: 'Positive', note: 'Safe-haven flows benefit defensive healthcare stocks in selloffs' },
    { name: 'CPI Inflation',   sensitivity: 'Medium', direction: 'Positive', note: 'Healthcare pricing often indexed; companies pass costs to payers' },
    { name: 'Credit Spreads',  sensitivity: 'Low',    direction: 'Neutral',  note: 'Investment-grade balance sheets; low refinancing risk' },
  ],
  'Consumer Discretionary': [
    { name: 'Interest Rates',  sensitivity: 'High',   direction: 'Negative', note: 'Higher rates reduce consumer borrowing and discretionary spending' },
    { name: 'USD Strength',    sensitivity: 'Medium', direction: 'Negative', note: 'Global brands face weaker overseas revenue translation' },
    { name: 'Oil Price',       sensitivity: 'High',   direction: 'Negative', note: 'High oil raises transport and input costs; squeezes consumer wallets' },
    { name: 'VIX (Volatility)',sensitivity: 'High',   direction: 'Negative', note: 'Consumer confidence drops in volatile markets; spending deferred' },
    { name: 'CPI Inflation',   sensitivity: 'High',   direction: 'Negative', note: 'Rising prices reduce real purchasing power for discretionary items' },
    { name: 'Credit Spreads',  sensitivity: 'High',   direction: 'Negative', note: 'Tight consumer credit limits big-ticket purchase financing' },
  ],
  'Consumer Staples': [
    { name: 'Interest Rates',  sensitivity: 'Low',    direction: 'Neutral',  note: 'Non-cyclical demand; limited sensitivity to rate cycles' },
    { name: 'USD Strength',    sensitivity: 'Medium', direction: 'Negative', note: 'Global brands translate overseas revenue at weaker rates' },
    { name: 'Oil Price',       sensitivity: 'Low',    direction: 'Negative', note: 'Packaging and logistics costs rise slightly' },
    { name: 'VIX (Volatility)',sensitivity: 'Low',    direction: 'Positive', note: 'Defensive inflows during risk-off; demand is inelastic' },
    { name: 'CPI Inflation',   sensitivity: 'Medium', direction: 'Negative', note: 'Input costs rise; pricing power partially offsets but margins compress' },
    { name: 'Credit Spreads',  sensitivity: 'Low',    direction: 'Positive', note: 'Strong balance sheets treated as safe havens' },
  ],
  'Industrials': [
    { name: 'Interest Rates',  sensitivity: 'Medium', direction: 'Negative', note: 'Capital-intensive; rate rises increase project and equipment financing costs' },
    { name: 'USD Strength',    sensitivity: 'High',   direction: 'Negative', note: 'Export-oriented; strong dollar makes US goods less competitive globally' },
    { name: 'Oil Price',       sensitivity: 'High',   direction: 'Negative', note: 'Fuel is a major operating cost for transport and manufacturing' },
    { name: 'VIX (Volatility)',sensitivity: 'Medium', direction: 'Negative', note: 'Cyclical sector hit by recession fears during volatility spikes' },
    { name: 'CPI Inflation',   sensitivity: 'Medium', direction: 'Negative', note: 'Raw material and labour costs rise; margin pressure unless passed on' },
    { name: 'Credit Spreads',  sensitivity: 'Medium', direction: 'Negative', note: 'Moderate refinancing exposure; capex plans pulled back in stress' },
  ],
  'Materials': [
    { name: 'Interest Rates',  sensitivity: 'Medium', direction: 'Negative', note: 'Capital-intensive mining and chemicals; higher rates compress margins' },
    { name: 'USD Strength',    sensitivity: 'High',   direction: 'Negative', note: 'Commodities priced in USD; strong dollar suppresses global demand' },
    { name: 'Oil Price',       sensitivity: 'High',   direction: 'Positive', note: 'Mining and chemicals benefit from broad commodity price inflation' },
    { name: 'VIX (Volatility)',sensitivity: 'Medium', direction: 'Negative', note: 'Cyclical; commodity demand falls on global growth fears' },
    { name: 'CPI Inflation',   sensitivity: 'High',   direction: 'Positive', note: 'Materials are the source of inflation; sector benefits directly' },
    { name: 'Credit Spreads',  sensitivity: 'Medium', direction: 'Negative', note: 'Leveraged balance sheets in mining are sensitive to refinancing risk' },
  ],
  'Real Estate': [
    { name: 'Interest Rates',  sensitivity: 'High',   direction: 'Negative', note: 'Cap rates move with risk-free rates; rising rates compress property values' },
    { name: 'USD Strength',    sensitivity: 'Low',    direction: 'Neutral',  note: 'Primarily domestic; limited FX exposure' },
    { name: 'Oil Price',       sensitivity: 'Low',    direction: 'Neutral',  note: 'Indirect exposure through operating costs' },
    { name: 'VIX (Volatility)',sensitivity: 'Medium', direction: 'Negative', note: 'Risk-off flows hurt REIT valuations and financing availability' },
    { name: 'CPI Inflation',   sensitivity: 'High',   direction: 'Negative', note: 'Rising rates to fight inflation directly pressure real estate' },
    { name: 'Credit Spreads',  sensitivity: 'High',   direction: 'Negative', note: 'REIT refinancing depends on debt markets; spreads critically matter' },
  ],
  'Utilities': [
    { name: 'Interest Rates',  sensitivity: 'High',   direction: 'Negative', note: 'Utilities trade like bonds; rising rates make their yields less attractive' },
    { name: 'USD Strength',    sensitivity: 'Low',    direction: 'Neutral',  note: 'Predominantly domestic regulated businesses' },
    { name: 'Oil Price',       sensitivity: 'Medium', direction: 'Negative', note: 'Fuel costs for gas utilities and power plants rise with oil' },
    { name: 'VIX (Volatility)',sensitivity: 'Low',    direction: 'Positive', note: 'Defensive safe-haven flows during market stress' },
    { name: 'CPI Inflation',   sensitivity: 'Medium', direction: 'Negative', note: 'Regulated pricing lags actual cost inflation; margins compressed' },
    { name: 'Credit Spreads',  sensitivity: 'Medium', direction: 'Negative', note: 'Heavily debt-financed; wider spreads raise rollover costs' },
  ],
  'Communication Services': [
    { name: 'Interest Rates',  sensitivity: 'Medium', direction: 'Negative', note: 'Growth-oriented platforms sensitive to rate-driven multiple compression' },
    { name: 'USD Strength',    sensitivity: 'Medium', direction: 'Negative', note: 'Global ad and subscription revenue hurt by FX translation' },
    { name: 'Oil Price',       sensitivity: 'Low',    direction: 'Neutral',  note: 'Minimal direct energy cost exposure for digital platforms' },
    { name: 'VIX (Volatility)',sensitivity: 'High',   direction: 'Negative', note: 'Ad budgets cut during uncertainty; streaming growth slows' },
    { name: 'CPI Inflation',   sensitivity: 'Low',    direction: 'Neutral',  note: 'Digital ad pricing resilient; subscription fees sticky' },
    { name: 'Credit Spreads',  sensitivity: 'High',   direction: 'Negative', note: 'Large-cap platforms well-funded; smaller players vulnerable' },
  ],
};

const DEFAULT_MACRO_PROFILE: MacroFactor[] = [
  { name: 'Interest Rates',  sensitivity: 'Medium', direction: 'Negative', note: 'Higher rates generally increase discount rates for equities' },
  { name: 'USD Strength',    sensitivity: 'Medium', direction: 'Negative', note: 'Stronger USD reduces overseas earnings when translated back' },
  { name: 'Oil Price',       sensitivity: 'Low',    direction: 'Neutral',  note: 'Indirect cost exposure through supply chain' },
  { name: 'VIX (Volatility)',sensitivity: 'Medium', direction: 'Negative', note: 'Risk-off periods tend to reduce equity valuations broadly' },
  { name: 'CPI Inflation',   sensitivity: 'Medium', direction: 'Negative', note: 'Persistent inflation raises costs and prompts tighter policy' },
  { name: 'Credit Spreads',  sensitivity: 'Medium', direction: 'Negative', note: 'Wide spreads signal systemic stress; equities typically fall' },
];

// ── Scoring helpers ───────────────────────────────────────────────────────────

function computeQualityScore(
  operatingMargin: number | null,
  revenueGrowth: number | null,
  fcfPositive: boolean,
  roe: number | null,
): number {
  let score = 0;
  if (operatingMargin != null) {
    if (operatingMargin >= 0.25)      score += 3;
    else if (operatingMargin >= 0.15) score += 2;
    else if (operatingMargin >= 0.05) score += 1;
  }
  if (revenueGrowth != null) {
    if (revenueGrowth >= 0.20)      score += 3;
    else if (revenueGrowth >= 0.10) score += 2;
    else if (revenueGrowth >= 0)    score += 1;
  }
  if (fcfPositive) score += 2;
  if (roe != null) {
    if (roe >= 0.20)      score += 2;
    else if (roe >= 0.10) score += 1;
  }
  return Math.min(score, 10);
}

function computeHealthScore(
  currentRatio: number | null,
  debtToEquity: number | null,
  fcfValues: number[],
): number {
  let score = 0;
  if (currentRatio != null) {
    if (currentRatio >= 2)          score += 3;
    else if (currentRatio >= 1)     score += 2;
    else if (currentRatio >= 0.5)   score += 1;
  }
  if (debtToEquity != null) {
    if (debtToEquity <= 0.5)        score += 3;
    else if (debtToEquity <= 1.5)   score += 2;
    else if (debtToEquity <= 3)     score += 1;
  }
  const positiveFCF = fcfValues.filter(v => v > 0).length;
  if (fcfValues.length > 0) {
    if (positiveFCF === fcfValues.length)          score += 2;
    else if (positiveFCF >= fcfValues.length / 2)  score += 1;
  }
  if (fcfValues.length > 0 && fcfValues[0] > 0)   score += 2;
  return Math.min(score, 10);
}

function fcfConsistency(fcfValues: number[]): 'Consistent' | 'Volatile' | 'Declining' {
  if (fcfValues.length < 2) return 'Consistent';
  const allPos = fcfValues.every(v => v > 0);
  if (!allPos) return 'Volatile';
  const isDecline = fcfValues[0] < fcfValues[fcfValues.length - 1] * 0.8;
  return isDecline ? 'Declining' : 'Consistent';
}

function overallMacroSensitivity(factors: MacroFactor[]): Sensitivity {
  const scores = { High: 3, Medium: 2, Low: 1 };
  const avg = factors.reduce((s, f) => s + scores[f.sensitivity], 0) / factors.length;
  if (avg >= 2.5) return 'High';
  if (avg >= 1.5) return 'Medium';
  return 'Low';
}

function formatPeriod(date: Date): string {
  return date.toISOString().split('T')[0].slice(0, 7); // "YYYY-MM"
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  // 1. Fetch company info + all historical quarterly stats
  const stock = await prisma.stockUniverse.findUnique({
    where: { ticker: symbol },
    include: {
      quarterlyStats: {
        orderBy: { periodEnd: 'desc' },
        // up to 20 rows: covers ~5 years of quarters + recent snapshots
        take: 20,
      },
    },
  });

  if (!stock) {
    return NextResponse.json({ error: 'Ticker not found in library' }, { status: 404 });
  }

  const allStats = stock.quarterlyStats;

  // Separate snapshot (latest price data) from quarterly (financials)
  const snapshot   = allStats.find(r => r.reportType === 'snapshot') ?? null;
  const quarterlies = allStats.filter(r => ['Q1','Q2','Q3','Q4','Annual'].includes(r.reportType));

  const latest = quarterlies[0] ?? snapshot;

  // 2. Peer PE data — all stocks in same sector, latest snapshot
  const peerRows = stock.sector
    ? await prisma.stockQuarterlyStats.findMany({
        where: {
          reportType: 'snapshot',
          stock: { sector: stock.sector },
          peRatio: { not: null, gt: 0, lt: 200 }, // exclude outliers
        },
        select: {
          ticker: true,
          peRatio: true,
          stock: { select: { name: true } },
        },
        orderBy: { fetchedAt: 'desc' },
        take: 50,
      })
    : [];

  // Deduplicate peers by ticker (keep latest)
  const seenTickers = new Set<string>();
  const uniquePeers = peerRows.filter(p => {
    if (seenTickers.has(p.ticker)) return false;
    seenTickers.add(p.ticker);
    return true;
  });

  const peerPEs = uniquePeers
    .filter(p => p.ticker !== symbol && p.peRatio != null)
    .map(p => ({ name: p.stock.name, ticker: p.ticker, pe: p.peRatio as number }))
    .sort((a, b) => a.pe - b.pe)
    .slice(0, 8); // up to 8 peers

  const industryAvgPE = peerPEs.length > 0
    ? peerPEs.reduce((s, p) => s + p.pe, 0) / peerPEs.length
    : null;

  // ── Page 1: Summary ─────────────────────────────────────────────────────────

  const currentPrice    = snapshot?.price ?? null;
  const priceChange     = snapshot?.priceChange ?? null;
  const priceChangePct  = snapshot?.priceChangePct ?? null;
  const currentPE       = snapshot?.peRatio ?? latest?.peRatio ?? null;
  const latestEPS       = latest?.eps ?? null;
  const latestBookValue = latest?.bookValue ?? null;

  // Fair value: EPS × industry-avg PE (fallback: 5-year avg PE)
  const fiveYearAvgPE = quarterlies.length > 0
    ? quarterlies.filter(q => q.peRatio != null && q.peRatio > 0 && q.peRatio < 200)
        .reduce((s, q, _, a) => s + (q.peRatio as number) / a.length, 0) || null
    : null;

  const valuationPE = industryAvgPE ?? fiveYearAvgPE ?? 15;
  const estimatedFairValue = latestEPS != null && latestEPS > 0
    ? latestEPS * valuationPE
    : (latestBookValue != null && latestEPS != null && latestEPS > 0
        ? Math.sqrt(22.5 * latestEPS * latestBookValue) // Graham Number fallback
        : null);

  const discountPct = estimatedFairValue != null && currentPrice != null && estimatedFairValue > 0
    ? ((estimatedFairValue - currentPrice) / estimatedFairValue) * 100
    : null;

  // Revenue growth: compare latest quarterly to 4 quarters ago
  const latestRevenue = latest?.revenue ?? null;
  const yearAgoQ = quarterlies[Math.min(3, quarterlies.length - 1)] ?? null;
  const yearAgoRevenue = yearAgoQ?.revenue ?? null;
  const revenueGrowth = latestRevenue != null && yearAgoRevenue != null && yearAgoRevenue !== 0
    ? (latestRevenue - yearAgoRevenue) / Math.abs(yearAgoRevenue)
    : null;

  // ROE = net income / book value (rough proxy)
  const latestNetIncome = latest?.netIncome ?? null;
  const roe = latestNetIncome != null && latestBookValue != null && latestBookValue !== 0
    ? latestNetIncome / Math.abs(latestBookValue)
    : null;

  const fcfValues = quarterlies
    .map(q => q.freeCashFlow)
    .filter((v): v is number => v != null);

  const qualityScore = computeQualityScore(
    latest?.operatingMargin ?? null,
    revenueGrowth,
    fcfValues.length > 0 && fcfValues[0] > 0,
    roe,
  );

  const healthScore = computeHealthScore(
    latest?.currentRatio ?? null,
    latest?.debtToEquity ?? null,
    fcfValues,
  );

  const macroProfile = MACRO_PROFILES[stock.sector ?? ''] ?? DEFAULT_MACRO_PROFILE;
  const macroSensitivity = overallMacroSensitivity(macroProfile);

  // Dynamic summary lines
  const summaryLines: string[] = [];
  if (currentPE != null && industryAvgPE != null) {
    const pePct = ((industryAvgPE - currentPE) / industryAvgPE) * 100;
    summaryLines.push(
      pePct >= 5
        ? `Trading at a ${Math.abs(pePct).toFixed(0)}% P/E discount to sector average`
        : pePct <= -5
        ? `Trading at a ${Math.abs(pePct).toFixed(0)}% P/E premium to sector average`
        : `P/E ratio broadly in line with sector average (${industryAvgPE.toFixed(1)}x)`,
    );
  }
  if (fcfValues.length >= 2) {
    const allPos = fcfValues.slice(0, 4).every(v => v > 0);
    summaryLines.push(
      allPos
        ? 'Positive free cash flow across recent quarters'
        : 'Free cash flow has been negative or inconsistent — monitor carefully',
    );
  }
  summaryLines.push(
    `${macroSensitivity} sensitivity to macro factors — most exposed to ${
      macroProfile.sort((a, b) => ({ High: 3, Medium: 2, Low: 1 }[b.sensitivity]) - ({ High: 3, Medium: 2, Low: 1 }[a.sensitivity]))[0]?.name ?? 'interest rates'
    }`,
  );

  // ── Page 2: Valuation ────────────────────────────────────────────────────────

  // PE history — deduplicated quarterly rows, oldest → newest for chart
  const peHistory = [...quarterlies]
    .filter(q => q.peRatio != null && q.peRatio > 0 && q.peRatio < 200)
    .reverse()
    .map(q => ({ period: formatPeriod(new Date(q.periodEnd)), value: q.peRatio as number }));

  // Historical percentile: where does the current PE sit in its own history?
  const historicalPercentile = currentPE != null && peHistory.length >= 2
    ? (peHistory.filter(p => p.value <= currentPE).length / peHistory.length) * 100
    : null;

  // ── Page 3: Financial Health ──────────────────────────────────────────────────

  const ocfTrend = [...quarterlies]
    .filter(q => q.operatingCashFlow != null)
    .reverse()
    .map(q => ({ period: formatPeriod(new Date(q.periodEnd)), value: q.operatingCashFlow as number }));

  const fcfTrend = [...quarterlies]
    .filter(q => q.freeCashFlow != null)
    .reverse()
    .map(q => ({ period: formatPeriod(new Date(q.periodEnd)), value: q.freeCashFlow as number }));

  const currentRatio = latest?.currentRatio ?? null;
  const debtToEquity = latest?.debtToEquity ?? null;

  const interestCoverageSignal: Signal =
    latest?.operatingMargin != null && latest.operatingMargin >= 0.20 ? 'Strong'
    : latest?.operatingMargin != null && latest.operatingMargin >= 0.05 ? 'Average'
    : 'Weak';

  const netDebtSignal: Signal =
    debtToEquity == null ? 'Average'
    : debtToEquity <= 0.5 ? 'Strong'
    : debtToEquity <= 1.5 ? 'Average'
    : 'Weak';

  const liquiditySignal: Signal =
    currentRatio == null ? 'Average'
    : currentRatio >= 2 ? 'Strong'
    : currentRatio >= 1 ? 'Average'
    : 'Weak';

  // ── Page 4: Earnings Quality ─────────────────────────────────────────────────

  const cfoToNetIncomeRatio =
    latest?.operatingCashFlow != null && latestNetIncome != null && latestNetIncome !== 0
      ? latest.operatingCashFlow / Math.abs(latestNetIncome)
      : null;

  const fcfMargin =
    latest?.freeCashFlow != null && latestRevenue != null && latestRevenue !== 0
      ? latest.freeCashFlow / latestRevenue
      : null;

  // Build per-quarter history (oldest → newest)
  const earningsHistory = [...quarterlies]
    .reverse()
    .map(q => ({
      period:         formatPeriod(new Date(q.periodEnd)),
      revenue:        q.revenue ?? null,
      operatingProfit: q.revenue != null && q.operatingMargin != null
        ? q.revenue * q.operatingMargin
        : null,
      netIncome:      q.netIncome ?? null,
      ocf:            q.operatingCashFlow ?? null,
      fcf:            q.freeCashFlow ?? null,
    }));

  const earningsInsights: string[] = [];
  if (cfoToNetIncomeRatio != null) {
    earningsInsights.push(
      cfoToNetIncomeRatio >= 1.0
        ? 'Cash flow is tracking or exceeding reported profits — high earnings quality'
        : cfoToNetIncomeRatio >= 0.6
        ? 'Cash conversion is reasonable; profits broadly backed by cash'
        : 'Earnings are growing faster than cash flow — worth investigating accruals',
    );
  }
  if (fcfMargin != null) {
    earningsInsights.push(
      fcfMargin >= 0.20
        ? 'Very high FCF margin — business generates significant cash relative to revenue'
        : fcfMargin >= 0.10
        ? 'Healthy FCF margin; solid cash generation'
        : fcfMargin >= 0
        ? 'Thin FCF margin — monitor capital expenditure trends'
        : 'Negative FCF — company is consuming more cash than it generates',
    );
  }
  if (revenueGrowth != null) {
    earningsInsights.push(
      revenueGrowth >= 0.15
        ? `Strong revenue growth of ${(revenueGrowth * 100).toFixed(1)}% year-over-year`
        : revenueGrowth >= 0
        ? `Moderate revenue growth of ${(revenueGrowth * 100).toFixed(1)}% year-over-year`
        : `Revenue contracted ${(Math.abs(revenueGrowth) * 100).toFixed(1)}% — watch for trend reversal`,
    );
  }

  // ── Assemble response ─────────────────────────────────────────────────────────

  const response: FlashcardResponse = {
    ticker: symbol,
    name: stock.name,
    sector: stock.sector,
    exchange: stock.exchange,
    industry: stock.industry,

    summary: {
      currentPrice,
      priceChange,
      priceChangePct,
      estimatedFairValue,
      discountPct,
      qualityScore,
      healthScore,
      macroSensitivity,
      summaryLines,
    },

    valuation: {
      currentPE,
      currentPB: snapshot?.priceToBook ?? latest?.priceToBook ?? null,
      fiveYearAvgPE: fiveYearAvgPE ?? null,
      industryAvgPE,
      historicalPercentile,
      peHistory,
      peers: peerPEs,
    },

    health: {
      currentRatio,
      debtToEquity,
      latestFCF: latest?.freeCashFlow ?? null,
      latestOCF: latest?.operatingCashFlow ?? null,
      ocfTrend,
      fcfTrend,
      signals: {
        interestCoverage: interestCoverageSignal,
        netDebtEBITDA:    netDebtSignal,
        fcfConsistency:   fcfConsistency(fcfValues),
        liquidity:        liquiditySignal,
      },
    },

    earnings: {
      revenueGrowth,
      operatingMargin:      latest?.operatingMargin ?? null,
      roe,
      cfoToNetIncomeRatio,
      fcfMargin,
      history:              earningsHistory,
      insights:             earningsInsights,
    },

    macro: {
      factors: macroProfile,
      basis:   'Based on sector-level analysis of historical rate cycles, commodity shocks, and volatility events. Individual stock behaviour may vary.',
    },
  };

  return NextResponse.json(response);
}
