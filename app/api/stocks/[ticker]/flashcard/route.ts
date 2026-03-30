/**
 * GET /api/stocks/[ticker]/flashcard
 *
 * Returns structured data for the 3-section stock analysis flashcard:
 *   - Valuation  (PER, PBR, EV/EBIT, FCF Yield, Valuation Percentile)
 *   - Quality    (Revenue Growth, Operating Margin, ROE, ROIC, CFO/Net Income)
 *   - Risk       (FCF, Net Debt/EBITDA, Interest Coverage, Cash/ST Debt, Shareholder Yield)
 *
 * Primary source: Company + CompanyPeriod + CompanyMetricValue (new schema)
 * Fallback:       StockQuarterlyStats (legacy schema) if company not in new tables
 *
 * Query params:
 *   ?periodId=<id>   – select a specific period (defaults to latest snapshot)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetricItem {
  code:         string;
  label:        string;
  unitType:     string;
  numericValue: number | null;
  displayValue: string;
  description:  string;
}

export interface PeriodInfo {
  id:         string;
  label:      string;
  periodType: string;
  endDate:    string | null;
}

export interface FlashcardResponse {
  ticker:   string;
  name:     string;
  sector:   string | null;
  exchange: string | null;
  industry: string | null;
  currency: string;

  price:          number | null;
  priceChange:    number | null;
  priceChangePct: number | null;

  selectedPeriod:  PeriodInfo;
  availablePeriods: PeriodInfo[];

  metrics: {
    valuation: MetricItem[];
    quality:   MetricItem[];
    risk:      MetricItem[];
  };
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtMetric(value: number | null, unitType: string): string {
  if (value == null) return '—';
  switch (unitType) {
    case 'ratio':     return `${value.toFixed(2)}x`;
    case 'percent':   return `${(value * 100).toFixed(1)}%`;
    case 'currency':  return formatBig(value);
    case 'percentile': return `${value.toFixed(0)}th pct`;
    default:           return value.toFixed(2);
  }
}

function formatBig(v: number): string {
  const abs  = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

// ── New-schema handler ────────────────────────────────────────────────────────

async function handleNewSchema(
  ticker: string,
  requestedPeriodId: string | null,
): Promise<FlashcardResponse | null> {
  const company = await prisma.company.findUnique({ where: { ticker } });
  if (!company) return null;

  // Gather all periods that have metric values
  const periods = await prisma.companyPeriod.findMany({
    where:   { companyId: company.id },
    orderBy: [{ periodType: 'asc' }, { endDate: 'desc' }],
  });

  if (periods.length === 0) return null;

  // Prefer: requested period → latest snapshot → most recent period
  const preferredPeriod =
    (requestedPeriodId ? periods.find(p => p.id === requestedPeriodId) : null)
    ?? periods.find(p => p.periodType === 'snapshot' && p.isLatest)
    ?? periods.find(p => p.isLatest)
    ?? periods[0];

  // Load metric definitions (ordered)
  const metricDefs = await prisma.companyMetricDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  // Load metric values for selected period
  const metricValues = await prisma.companyMetricValue.findMany({
    where:   { periodId: preferredPeriod.id },
    include: { definition: true },
  });

  const valueByCode = Object.fromEntries(
    metricValues.map(mv => [mv.definition.code, mv]),
  );

  function toMetricItem(code: string): MetricItem | null {
    const def = metricDefs.find(d => d.code === code);
    if (!def) return null;
    const mv  = valueByCode[code];
    const val = mv?.numericValue ?? null;
    return {
      code:         def.code,
      label:        def.label,
      unitType:     def.unitType,
      numericValue: val,
      displayValue: fmtMetric(val, def.unitType),
      description:  def.description ?? '',
    };
  }

  const valuationCodes = ['valuation_pe', 'valuation_pb', 'valuation_ev_ebit', 'valuation_fcf_yield', 'valuation_percentile'];
  const qualityCodes   = ['quality_revenue_growth', 'quality_operating_margin', 'quality_roe', 'quality_roic', 'quality_cfo_net_income'];
  const riskCodes      = ['risk_fcf', 'risk_net_debt_ebitda', 'risk_interest_coverage', 'risk_cash_short_debt', 'risk_shareholder_yield'];

  const valuation = valuationCodes.map(toMetricItem).filter(Boolean) as MetricItem[];
  const quality   = qualityCodes.map(toMetricItem).filter(Boolean) as MetricItem[];
  const risk      = riskCodes.map(toMetricItem).filter(Boolean) as MetricItem[];

  // If all three categories are empty, this company has no metric data yet
  const hasData = valuation.some(m => m.numericValue != null)
               || quality.some(m => m.numericValue != null)
               || risk.some(m => m.numericValue != null);
  if (!hasData) return null;

  // Price from snapshot
  const latestSnap = periods.find(p => p.periodType === 'snapshot' && p.isLatest);
  let price: number | null = null;
  let priceChange: number | null = null;
  let priceChangePct: number | null = null;
  if (latestSnap) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _snapValues = await prisma.companyMetricValue.findMany({
      where:   { periodId: latestSnap.id },
      include: { definition: true },
    });
    // Try to get price from StockQuarterlyStats (new schema doesn't store price directly yet)
    const stockSnap = await prisma.stockQuarterlyStats.findFirst({
      where:   { ticker, reportType: 'snapshot' },
      orderBy: { fetchedAt: 'desc' },
    }).catch(() => null);
    price          = stockSnap?.price ?? null;
    priceChange    = stockSnap?.priceChange ?? null;
    priceChangePct = stockSnap?.priceChangePct ?? null;
  }

  const availablePeriods: PeriodInfo[] = periods.map(p => ({
    id:         p.id,
    label:      p.periodLabel,
    periodType: p.periodType,
    endDate:    p.endDate?.toISOString().slice(0, 10) ?? null,
  }));

  return {
    ticker:   company.ticker,
    name:     company.name,
    sector:   company.sector ?? null,
    exchange: company.exchange ?? null,
    industry: company.industry ?? null,
    currency: company.currency,

    price,
    priceChange,
    priceChangePct,

    selectedPeriod: {
      id:         preferredPeriod.id,
      label:      preferredPeriod.periodLabel,
      periodType: preferredPeriod.periodType,
      endDate:    preferredPeriod.endDate?.toISOString().slice(0, 10) ?? null,
    },
    availablePeriods,

    metrics: { valuation, quality, risk },
  };
}

// ── Legacy fallback handler ───────────────────────────────────────────────────

async function handleLegacy(ticker: string): Promise<FlashcardResponse | null> {
  const stock = await prisma.stockUniverse.findUnique({
    where:   { ticker },
    include: {
      quarterlyStats: {
        orderBy: { periodEnd: 'desc' },
        take: 20,
      },
    },
  });
  if (!stock) return null;

  const allStats   = stock.quarterlyStats;
  const snapshot   = allStats.find(r => r.reportType === 'snapshot') ?? null;
  const quarterlies = allStats.filter(r => ['Q1','Q2','Q3','Q4','Annual'].includes(r.reportType));
  const latest     = quarterlies[0] ?? snapshot;

  const toV = (v: number | null, unit: string, label: string, code: string, desc = ''): MetricItem => ({
    code,
    label,
    unitType:     unit,
    numericValue: v,
    displayValue: fmtMetric(v, unit),
    description:  desc,
  });

  // Valuation
  const currentPE  = snapshot?.peRatio ?? latest?.peRatio ?? null;
  const currentPB  = snapshot?.priceToBook ?? latest?.priceToBook ?? null;
  const marketCap  = snapshot?.marketCap ?? null;
  const fcfYield   = (latest?.freeCashFlow != null && marketCap != null && marketCap > 0)
    ? latest.freeCashFlow / marketCap : null;

  // Historical percentile
  const peHistory = quarterlies.filter(q => q.peRatio != null && q.peRatio > 0 && q.peRatio < 200);
  const historicalPercentile = (currentPE != null && peHistory.length >= 2)
    ? (peHistory.filter(p => (p.peRatio as number) <= currentPE).length / peHistory.length) * 100
    : null;

  // Quality
  const latestRevenue   = latest?.revenue ?? null;
  const yearAgoRevenue  = quarterlies[Math.min(3, quarterlies.length - 1)]?.revenue ?? null;
  const revenueGrowth   = (latestRevenue != null && yearAgoRevenue != null && yearAgoRevenue !== 0)
    ? (latestRevenue - yearAgoRevenue) / Math.abs(yearAgoRevenue) : null;
  const operatingMargin = latest?.operatingMargin ?? null;
  const latestNetIncome = latest?.netIncome ?? null;
  const bookValue       = latest?.bookValue ?? null;
  const roe             = (latestNetIncome != null && bookValue != null && bookValue !== 0)
    ? latestNetIncome / Math.abs(bookValue) : null;
  const cfoNetIncome    = (latest?.operatingCashFlow != null && latestNetIncome != null && latestNetIncome !== 0)
    ? latest.operatingCashFlow / Math.abs(latestNetIncome) : null;

  // Risk
  const fcf = latest?.freeCashFlow ?? null;

  // Synthetic period
  const syntheticPeriod: PeriodInfo = {
    id:         'legacy',
    label:      'Latest Available',
    periodType: 'legacy',
    endDate:    latest?.periodEnd?.toISOString().slice(0, 10) ?? null,
  };

  return {
    ticker:   stock.ticker,
    name:     stock.name,
    sector:   stock.sector ?? null,
    exchange: stock.exchange,
    industry: stock.industry ?? null,
    currency: 'USD',

    price:          snapshot?.price ?? null,
    priceChange:    snapshot?.priceChange ?? null,
    priceChangePct: snapshot?.priceChangePct ?? null,

    selectedPeriod:   syntheticPeriod,
    availablePeriods: [syntheticPeriod],

    metrics: {
      valuation: [
        toV(currentPE,             'ratio',      'P/E Ratio',          'valuation_pe',          'Price relative to earnings per share'),
        toV(currentPB,             'ratio',      'P/B Ratio',          'valuation_pb',          'Price relative to book value'),
        toV(null,                  'ratio',      'EV / EBIT',          'valuation_ev_ebit',     'Enterprise value relative to operating income'),
        toV(fcfYield,              'percent',    'FCF Yield',          'valuation_fcf_yield',   'Free cash flow as % of market cap'),
        toV(historicalPercentile,  'percentile', 'Valuation Percentile','valuation_percentile', 'PE percentile in own history — lower is cheaper'),
      ],
      quality: [
        toV(revenueGrowth,  'percent',  'Revenue Growth',    'quality_revenue_growth',   'Year-over-year revenue growth rate'),
        toV(operatingMargin,'percent',  'Operating Margin',  'quality_operating_margin', 'Operating income as % of revenue'),
        toV(roe,            'percent',  'ROE',               'quality_roe',              'Net income as % of shareholders equity'),
        toV(null,           'percent',  'ROIC',              'quality_roic',             'NOPAT / invested capital'),
        toV(cfoNetIncome,   'ratio',    'CFO / Net Income',  'quality_cfo_net_income',   'Cash flow quality — higher means earnings are well-backed by cash'),
      ],
      risk: [
        toV(fcf,  'currency', 'Free Cash Flow',       'risk_fcf',               'Annual free cash flow (operating cash flow minus capex)'),
        toV(null, 'ratio',    'Net Debt / EBITDA',    'risk_net_debt_ebitda',   'Financial leverage — lower is safer'),
        toV(null, 'ratio',    'Interest Coverage',    'risk_interest_coverage', 'EBIT / interest expense — higher means easier debt service'),
        toV(null, 'ratio',    'Cash / ST Debt',       'risk_cash_short_debt',   'Cash vs short-term debt obligations'),
        toV(null, 'percent',  'Shareholder Yield',    'risk_shareholder_yield', 'Dividends + buybacks as % of market cap'),
      ],
    },
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker }  = await params;
  const symbol      = ticker.toUpperCase();
  const periodId    = req.nextUrl.searchParams.get('periodId');

  // Try new schema first
  const newResult = await handleNewSchema(symbol, periodId);
  if (newResult) return NextResponse.json(newResult);

  // Fall back to legacy
  const legacy = await handleLegacy(symbol);
  if (legacy) return NextResponse.json(legacy);

  return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
}
