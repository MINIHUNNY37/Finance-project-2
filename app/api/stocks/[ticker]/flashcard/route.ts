import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FORMULA_VERSION, normalizeStoredPercent } from '@/lib/company-storage';

type MetricGroupKey = 'valuation' | 'quality' | 'risk';
export type SummaryCardTone = 'good' | 'fair' | 'weak' | 'neutral';

export interface MetricItem {
  code: string;
  label: string;
  unitType: string;
  numericValue: number | null;
  displayValue: string;
  description: string;
}

export interface PeriodInfo {
  id: string;
  label: string;
  periodType: string;
  endDate: string | null;
}

export interface SummaryCard {
  id: MetricGroupKey;
  title: string;
  statusLabel: string;
  tone: SummaryCardTone;
  metrics: MetricItem[];
}

export interface SummaryHighlight {
  label: string;
  value: string;
}

export interface FlashcardResponse {
  ticker: string;
  name: string;
  sector: string | null;
  exchange: string | null;
  industry: string | null;
  currency: string;
  price: number | null;
  priceChange: number | null;
  priceChangePct: number | null;
  selectedPeriod: PeriodInfo;
  availablePeriods: PeriodInfo[];
  summary: {
    cards: SummaryCard[];
    highlights: SummaryHighlight[];
  };
  metrics: Record<MetricGroupKey, MetricItem[]>;
}

type MetricValueLike = {
  numericValue: number | null;
  textValue?: string | null;
};

type FactValueLike = {
  code: string;
  label: string;
  unitType: string;
  numericValue: number | null;
  textValue?: string | null;
};

const METRIC_GROUPS: Record<MetricGroupKey, string[]> = {
  valuation: [
    'valuation_pe',
    'valuation_pb',
    'valuation_ev_ebit',
    'valuation_fcf_yield',
    'valuation_percentile',
  ],
  quality: [
    'quality_revenue_growth',
    'quality_operating_margin',
    'quality_roe',
    'quality_roic',
    'quality_cfo_net_income',
  ],
  risk: [
    'risk_fcf',
    'risk_net_debt_ebitda',
    'risk_interest_coverage',
    'risk_cash_short_debt',
    'risk_shareholder_yield',
  ],
};

const SUMMARY_CARD_CONFIG: Record<MetricGroupKey, { title: string; metricCodes: string[]; labels: Record<SummaryCardTone, string> }> = {
  valuation: {
    title: 'Valuation',
    metricCodes: ['valuation_pe', 'valuation_fcf_yield'],
    labels: {
      good: 'Attractive',
      fair: 'Mixed',
      weak: 'Expensive',
      neutral: 'Limited data',
    },
  },
  quality: {
    title: 'Quality',
    metricCodes: ['quality_roic', 'quality_roe'],
    labels: {
      good: 'Strong',
      fair: 'Balanced',
      weak: 'Fragile',
      neutral: 'Limited data',
    },
  },
  risk: {
    title: 'Risk',
    metricCodes: ['risk_net_debt_ebitda', 'risk_interest_coverage'],
    labels: {
      good: 'Contained',
      fair: 'Watch',
      weak: 'Elevated',
      neutral: 'Limited data',
    },
  },
};

const SCREENING_FIELD_BY_CODE: Record<string, keyof NonNullable<Awaited<ReturnType<typeof prisma.companyScreeningSnapshot.findFirst>>>> = {
  valuation_pe: 'per',
  valuation_pb: 'pbr',
  valuation_ev_ebit: 'evEbit',
  valuation_fcf_yield: 'fcfYield',
  valuation_percentile: 'valuationPercentile',
  quality_revenue_growth: 'revenueGrowth',
  quality_operating_margin: 'operatingMargin',
  quality_roe: 'roe',
  quality_roic: 'roic',
  quality_cfo_net_income: 'cfoNetIncomeRatio',
  risk_fcf: 'fcf',
  risk_net_debt_ebitda: 'netDebtEbitda',
  risk_interest_coverage: 'interestCoverage',
  risk_cash_short_debt: 'cashShortTermDebtRatio',
  risk_shareholder_yield: 'shareholderYield',
};

function normalizeRatioValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.abs(value) > 2 ? value / 100 : value;
}

function validNumber(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? value : null;
}

function positiveRatio(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }

  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

function positivePercent(numerator: number | null, denominator: number | null) {
  const ratio = positiveRatio(numerator, denominator);
  return ratio == null ? null : ratio * 100;
}

function toIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function typeRank(periodType: string) {
  if (periodType === 'snapshot') return 0;
  if (periodType === 'ttm') return 1;
  if (periodType === 'quarterly') return 2;
  if (periodType === 'annual') return 3;
  return 4;
}

function comparePeriods(
  a: { periodType: string; isLatest: boolean; periodEndDate: Date | null; endDate: Date | null; asOfDate: Date | null; updatedAt: Date },
  b: { periodType: string; isLatest: boolean; periodEndDate: Date | null; endDate: Date | null; asOfDate: Date | null; updatedAt: Date },
) {
  const rankDiff = typeRank(a.periodType) - typeRank(b.periodType);
  if (rankDiff !== 0) return rankDiff;

  if (a.isLatest !== b.isLatest) {
    return a.isLatest ? -1 : 1;
  }

  const aDate = a.periodEndDate ?? a.endDate ?? a.asOfDate ?? a.updatedAt;
  const bDate = b.periodEndDate ?? b.endDate ?? b.asOfDate ?? b.updatedAt;
  return bDate.getTime() - aDate.getTime();
}

function ordinalSuffix(value: number) {
  const rounded = Math.round(value);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;

  if (mod10 === 1 && mod100 !== 11) return `${rounded}st`;
  if (mod10 === 2 && mod100 !== 12) return `${rounded}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${rounded}rd`;
  return `${rounded}th`;
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(abs >= 100 ? 0 : 2)}`;
}

function formatNumber(value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatMetricDisplay(code: string, unitType: string, numericValue: number | null, textValue?: string | null) {
  if (textValue) return textValue;
  if (numericValue == null || !Number.isFinite(numericValue)) return 'N/A';

  if (code === 'valuation_percentile') {
    return `${ordinalSuffix(numericValue)} pct`;
  }

  if (unitType === 'currency') {
    return formatCompactCurrency(numericValue);
  }

  if (unitType === 'percent') {
    return `${numericValue.toFixed(1)}%`;
  }

  if (unitType === 'ratio') {
    return `${numericValue.toFixed(2)}x`;
  }

  return formatNumber(numericValue);
}

function metricEvaluation(code: string, value: number | null): SummaryCardTone {
  if (value == null || !Number.isFinite(value)) {
    return 'neutral';
  }

  const higherBetter: Record<string, { good: number; fair: number }> = {
    valuation_fcf_yield: { good: 5, fair: 2 },
    quality_revenue_growth: { good: 10, fair: 0 },
    quality_operating_margin: { good: 20, fair: 10 },
    quality_roe: { good: 15, fair: 8 },
    quality_roic: { good: 12, fair: 6 },
    quality_cfo_net_income: { good: 1, fair: 0.7 },
    risk_interest_coverage: { good: 5, fair: 2 },
    risk_cash_short_debt: { good: 1.5, fair: 1 },
    risk_shareholder_yield: { good: 4, fair: 1.5 },
  };

  const lowerBetter: Record<string, { good: number; fair: number }> = {
    valuation_pe: { good: 15, fair: 30 },
    valuation_pb: { good: 3, fair: 6 },
    valuation_ev_ebit: { good: 12, fair: 25 },
    valuation_percentile: { good: 35, fair: 70 },
    risk_net_debt_ebitda: { good: 2, fair: 4 },
  };

  if (higherBetter[code]) {
    const { good, fair } = higherBetter[code];
    if (value >= good) return 'good';
    if (value >= fair) return 'fair';
    return 'weak';
  }

  if (lowerBetter[code]) {
    const { good, fair } = lowerBetter[code];
    if (value <= good) return 'good';
    if (value <= fair) return 'fair';
    return 'weak';
  }

  if (code === 'risk_fcf') {
    return value > 0 ? 'good' : 'weak';
  }

  return 'neutral';
}

function aggregateTone(metrics: MetricItem[]): SummaryCardTone {
  const validMetrics = metrics.filter((metric) => metric.numericValue != null && Number.isFinite(metric.numericValue));
  if (validMetrics.length === 0) return 'neutral';

  const scoreMap: Record<SummaryCardTone, number> = {
    good: 2,
    fair: 1,
    weak: 0,
    neutral: 1,
  };

  const average =
    validMetrics.reduce((sum, metric) => sum + scoreMap[metricEvaluation(metric.code, metric.numericValue)], 0) /
    validMetrics.length;

  if (average >= 1.5) return 'good';
  if (average >= 0.75) return 'fair';
  return 'weak';
}

function buildMetricItem(
  definition: { code: string; label: string; unitType: string; description: string },
  value: MetricValueLike | null | undefined,
): MetricItem {
  const numericValue = value?.numericValue ?? null;
  const textValue = value?.textValue ?? null;

  return {
    code: definition.code,
    label: definition.label,
    unitType: definition.unitType,
    numericValue,
    displayValue: formatMetricDisplay(definition.code, definition.unitType, numericValue, textValue),
    description: definition.description,
  };
}

function buildMetricGroups(
  metricDefinitions: Map<string, { code: string; label: string; unitType: string; description: string }>,
  metricValues: Map<string, MetricValueLike>,
) {
  const metrics = {
    valuation: [] as MetricItem[],
    quality: [] as MetricItem[],
    risk: [] as MetricItem[],
  };

  for (const group of Object.keys(METRIC_GROUPS) as MetricGroupKey[]) {
    metrics[group] = METRIC_GROUPS[group]
      .map((code) => {
        const definition = metricDefinitions.get(code);
        if (!definition) return null;
        return buildMetricItem(definition, metricValues.get(code));
      })
      .filter((item): item is MetricItem => item != null);
  }

  return metrics;
}

function buildSummaryCards(metricGroups: Record<MetricGroupKey, MetricItem[]>) {
  return (Object.keys(SUMMARY_CARD_CONFIG) as MetricGroupKey[]).map((group) => {
    const config = SUMMARY_CARD_CONFIG[group];
    const metricMap = new Map(metricGroups[group].map((metric) => [metric.code, metric]));
    const metrics = config.metricCodes
      .map((code) => metricMap.get(code))
      .filter((metric): metric is MetricItem => metric != null);
    const tone = aggregateTone(metrics);

    return {
      id: group,
      title: config.title,
      tone,
      statusLabel: config.labels[tone],
      metrics,
    };
  });
}

function buildHighlights(
  selectedPeriod: PeriodInfo,
  factValues: Map<string, FactValueLike>,
  metricValues: Map<string, MetricValueLike>,
): SummaryHighlight[] {
  const highlights: SummaryHighlight[] = [
    { label: 'Selected Period', value: selectedPeriod.label },
  ];

  const factCodes = ['market_cap', 'revenue', 'free_cash_flow', 'share_price'] as const;
  for (const code of factCodes) {
    const fact = factValues.get(code);
    if (!fact) continue;

    const value = formatMetricDisplay(code, fact.unitType, fact.numericValue, fact.textValue);
    if (value === 'N/A') continue;
    highlights.push({ label: fact.label, value });
    if (highlights.length >= 4) {
      return highlights;
    }
  }

  const shareholderYield = metricValues.get('risk_shareholder_yield');
  if (shareholderYield) {
    const value = formatMetricDisplay('risk_shareholder_yield', 'percent', shareholderYield.numericValue, shareholderYield.textValue);
    if (value !== 'N/A') {
      highlights.push({ label: 'Shareholder Yield', value });
    }
  }

  return highlights.slice(0, 5);
}

function selectPriceHeader(
  latestLegacySnapshot: { price: number | null; priceChange: number | null; priceChangePct: number | null } | null,
  latestDailyPrices: Array<{ close: number | null; adjustedClose: number | null }>,
  latestSnapshotFacts: Map<string, FactValueLike>,
) {
  if (latestLegacySnapshot?.price != null) {
    return latestLegacySnapshot;
  }

  const latestClose = latestDailyPrices[0]?.close ?? latestDailyPrices[0]?.adjustedClose ?? latestSnapshotFacts.get('share_price')?.numericValue ?? null;
  const previousClose = latestDailyPrices[1]?.close ?? latestDailyPrices[1]?.adjustedClose ?? null;
  const priceChange = latestClose != null && previousClose != null ? latestClose - previousClose : null;
  const priceChangePct = priceChange != null && previousClose != null && previousClose !== 0 ? (priceChange / previousClose) * 100 : null;

  return {
    price: latestClose,
    priceChange,
    priceChangePct,
  };
}

function buildLegacyPeriodId(reportType: string, periodEnd: Date) {
  return `${reportType}:${periodEnd.toISOString().slice(0, 10)}`;
}

function legacyPeriodLabel(reportType: string, periodEnd: Date) {
  if (reportType === 'snapshot') return 'Latest Snapshot';
  if (reportType === 'Annual') return `FY ${periodEnd.getUTCFullYear()}`;
  return `${reportType} ${periodEnd.getUTCFullYear()}`;
}

function buildLegacyMetricValues(
  selectedRow: {
    reportType: string;
    price: number | null;
    marketCap: number | null;
    peRatio: number | null;
    priceToBook: number | null;
    revenue: number | null;
    netIncome: number | null;
    bookValue: number | null;
    debtToEquity: number | null;
    operatingCashFlow: number | null;
    freeCashFlow: number | null;
    operatingMargin: number | null;
    dividendYield: number | null;
  },
  latestSnapshot: {
    price: number | null;
    marketCap: number | null;
    peRatio: number | null;
    dividendYield: number | null;
  } | null,
  comparableRow: {
    revenue: number | null;
  } | null,
  peHistory: number[],
) {
  const sharePrice = validNumber(latestSnapshot?.price ?? selectedRow.price);
  const marketCap = validNumber(latestSnapshot?.marketCap ?? selectedRow.marketCap);
  const sharesOutstanding = positiveRatio(marketCap, sharePrice);
  const bookValuePerShare = validNumber(selectedRow.bookValue);
  const totalEquity = bookValuePerShare != null && sharesOutstanding != null ? bookValuePerShare * sharesOutstanding : null;
  const totalDebt = selectedRow.debtToEquity != null && totalEquity != null ? selectedRow.debtToEquity * totalEquity : null;
  const operatingMarginRatio = normalizeRatioValue(selectedRow.operatingMargin);
  const operatingIncome = selectedRow.revenue != null && operatingMarginRatio != null ? selectedRow.revenue * operatingMarginRatio : null;
  const investedCapital = totalEquity != null || totalDebt != null ? (totalEquity ?? 0) + (totalDebt ?? 0) : null;
  const currentPe = validNumber(latestSnapshot?.peRatio ?? selectedRow.peRatio);
  const valuationPercentile =
    currentPe != null && peHistory.length >= 2
      ? (peHistory.filter((value) => value <= currentPe).length / peHistory.length) * 100
      : null;
  const revenueGrowth =
    selectedRow.revenue != null && comparableRow?.revenue != null && comparableRow.revenue !== 0
      ? ((selectedRow.revenue - comparableRow.revenue) / Math.abs(comparableRow.revenue)) * 100
      : null;
  const roe =
    selectedRow.netIncome != null && totalEquity != null && totalEquity > 0
      ? (selectedRow.netIncome / totalEquity) * 100
      : null;
  const roic =
    operatingIncome != null && investedCapital != null && investedCapital > 0
      ? ((operatingIncome * 0.79) / investedCapital) * 100
      : null;
  const cfoNetIncome =
    selectedRow.operatingCashFlow != null && selectedRow.netIncome != null && selectedRow.netIncome > 0
      ? selectedRow.operatingCashFlow / selectedRow.netIncome
      : null;
  const fcfYield = positivePercent(validNumber(selectedRow.freeCashFlow), marketCap);
  const dividendYield = normalizeStoredPercent(latestSnapshot?.dividendYield ?? selectedRow.dividendYield ?? null);

  const metricValues = new Map<string, MetricValueLike>([
    ['valuation_pe', { numericValue: currentPe }],
    ['valuation_pb', { numericValue: validNumber(selectedRow.priceToBook) }],
    [
      'valuation_ev_ebit',
      {
        numericValue: marketCap != null && totalDebt != null && operatingIncome != null && operatingIncome > 0
          ? (marketCap + totalDebt) / operatingIncome
          : null,
      },
    ],
    ['valuation_fcf_yield', { numericValue: fcfYield }],
    ['valuation_percentile', { numericValue: valuationPercentile }],
    ['quality_revenue_growth', { numericValue: revenueGrowth }],
    ['quality_operating_margin', { numericValue: operatingMarginRatio == null ? null : operatingMarginRatio * 100 }],
    ['quality_roe', { numericValue: roe }],
    ['quality_roic', { numericValue: roic }],
    ['quality_cfo_net_income', { numericValue: cfoNetIncome }],
    ['risk_fcf', { numericValue: validNumber(selectedRow.freeCashFlow) }],
    ['risk_net_debt_ebitda', { numericValue: null }],
    ['risk_interest_coverage', { numericValue: null }],
    ['risk_cash_short_debt', { numericValue: null }],
    ['risk_shareholder_yield', { numericValue: dividendYield }],
  ]);

  const factValues = new Map<string, FactValueLike>([
    { code: 'share_price', label: 'Share Price', unitType: 'currency', numericValue: sharePrice },
    { code: 'market_cap', label: 'Market Cap', unitType: 'currency', numericValue: marketCap },
    { code: 'revenue', label: 'Revenue', unitType: 'currency', numericValue: validNumber(selectedRow.revenue) },
    { code: 'free_cash_flow', label: 'Free Cash Flow', unitType: 'currency', numericValue: validNumber(selectedRow.freeCashFlow) },
  ].map((fact) => [fact.code, fact]));

  return { metricValues, factValues };
}

async function handleNewSchema(ticker: string, requestedPeriodId: string | null): Promise<FlashcardResponse | null> {
  const company = await prisma.company.findUnique({
    where: { ticker },
  });
  if (!company) return null;

  const [periods, metricDefinitionsList, latestScreeningSnapshot, latestLegacySnapshot, latestDailyPrices] = await Promise.all([
    prisma.companyPeriod.findMany({
      where: {
        companyId: company.id,
        metrics: {
          some: {
            formulaVersion: FORMULA_VERSION,
          },
        },
      },
      select: {
        id: true,
        periodLabel: true,
        periodType: true,
        periodEndDate: true,
        endDate: true,
        asOfDate: true,
        isLatest: true,
        updatedAt: true,
      },
    }),
    prisma.companyMetricDefinition.findMany({
      where: {
        category: {
          in: ['valuation', 'quality', 'risk'],
        },
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        code: true,
        label: true,
        unitType: true,
        description: true,
      },
    }),
    prisma.companyScreeningSnapshot.findFirst({
      where: {
        companyId: company.id,
        snapshotType: 'latest',
        formulaVersion: FORMULA_VERSION,
      },
      orderBy: { asOfDate: 'desc' },
    }),
    prisma.stockQuarterlyStats.findFirst({
      where: {
        ticker,
        reportType: 'snapshot',
      },
      orderBy: { periodEnd: 'desc' },
      select: {
        price: true,
        priceChange: true,
        priceChangePct: true,
      },
    }),
    prisma.companyDailyPrice.findMany({
      where: { companyId: company.id },
      orderBy: { date: 'desc' },
      take: 2,
      select: {
        close: true,
        adjustedClose: true,
      },
    }),
  ]);

  if (periods.length === 0) return null;

  const sortedPeriods = [...periods].sort(comparePeriods);
  const latestSnapshotPeriod = sortedPeriods.find((period) => period.periodType === 'snapshot' && period.isLatest)
    ?? sortedPeriods.find((period) => period.periodType === 'snapshot')
    ?? null;

  const selectedPeriod =
    (requestedPeriodId ? sortedPeriods.find((period) => period.id === requestedPeriodId) : null)
    ?? latestSnapshotPeriod
    ?? sortedPeriods.find((period) => period.isLatest)
    ?? sortedPeriods[0];

  const periodIdsToLoad = [...new Set([selectedPeriod.id, latestSnapshotPeriod?.id].filter((value): value is string => Boolean(value)))];

  const [metricValues, factValues] = await Promise.all([
    prisma.companyMetricValue.findMany({
      where: {
        periodId: {
          in: periodIdsToLoad,
        },
        formulaVersion: FORMULA_VERSION,
      },
      include: {
        definition: {
          select: {
            code: true,
          },
        },
      },
    }),
    prisma.companyFactValue.findMany({
      where: {
        periodId: {
          in: periodIdsToLoad,
        },
      },
      include: {
        definition: {
          select: {
            code: true,
            label: true,
            unitType: true,
          },
        },
      },
    }),
  ]);

  const metricDefinitions = new Map(metricDefinitionsList.map((definition) => [definition.code, definition]));

  const selectedMetricValues = new Map<string, MetricValueLike>();
  const selectedFactValues = new Map<string, FactValueLike>();
  const latestSnapshotFacts = new Map<string, FactValueLike>();

  for (const value of metricValues) {
    if (value.periodId !== selectedPeriod.id) continue;
    selectedMetricValues.set(value.definition.code, {
      numericValue: value.numericValue,
      textValue: value.textValue,
    });
  }

  for (const value of factValues) {
    const mapped: FactValueLike = {
      code: value.definition.code,
      label: value.definition.label,
      unitType: value.definition.unitType,
      numericValue: value.numericValue,
      textValue: value.textValue,
    };

    if (value.periodId === selectedPeriod.id) {
      selectedFactValues.set(value.definition.code, mapped);
    }

    if (latestSnapshotPeriod && value.periodId === latestSnapshotPeriod.id) {
      latestSnapshotFacts.set(value.definition.code, mapped);
    }
  }

  const useLatestSnapshotScreening =
    latestScreeningSnapshot != null &&
    latestSnapshotPeriod != null &&
    selectedPeriod.id === latestSnapshotPeriod.id &&
    selectedPeriod.periodType === 'snapshot';

  const activeMetricValues = new Map<string, MetricValueLike>();
  if (useLatestSnapshotScreening && latestScreeningSnapshot) {
    for (const code of Object.values(METRIC_GROUPS).flat()) {
      const field = SCREENING_FIELD_BY_CODE[code];
      const rawValue = field ? latestScreeningSnapshot[field] : null;
      activeMetricValues.set(code, { numericValue: typeof rawValue === 'number' ? rawValue : null });
    }
  } else {
    for (const [code, value] of selectedMetricValues.entries()) {
      activeMetricValues.set(code, value);
    }
  }

  const metrics = buildMetricGroups(metricDefinitions, activeMetricValues);
  const hasMetricData = Object.values(metrics)
    .flat()
    .some((metric) => metric.numericValue != null || metric.displayValue !== 'N/A');
  if (!hasMetricData) return null;

  const selectedPeriodInfo: PeriodInfo = {
    id: selectedPeriod.id,
    label: selectedPeriod.periodLabel,
    periodType: selectedPeriod.periodType,
    endDate: toIsoDate(selectedPeriod.periodEndDate ?? selectedPeriod.endDate ?? selectedPeriod.asOfDate),
  };

  const summary = {
    cards: buildSummaryCards(metrics),
    highlights: buildHighlights(selectedPeriodInfo, selectedFactValues, activeMetricValues),
  };

  const priceHeader = selectPriceHeader(latestLegacySnapshot, latestDailyPrices, latestSnapshotFacts);

  return {
    ticker: company.ticker,
    name: company.name,
    sector: company.sector,
    exchange: company.exchange,
    industry: company.industry,
    currency: company.currency,
    price: priceHeader.price,
    priceChange: priceHeader.priceChange,
    priceChangePct: priceHeader.priceChangePct,
    selectedPeriod: selectedPeriodInfo,
    availablePeriods: sortedPeriods.map((period) => ({
      id: period.id,
      label: period.periodLabel,
      periodType: period.periodType,
      endDate: toIsoDate(period.periodEndDate ?? period.endDate ?? period.asOfDate),
    })),
    summary,
    metrics,
  };
}

async function handleLegacy(ticker: string, requestedPeriodId: string | null): Promise<FlashcardResponse | null> {
  const stock = await prisma.stockUniverse.findUnique({
    where: { ticker },
    include: {
      quarterlyStats: {
        orderBy: { periodEnd: 'desc' },
        take: 24,
      },
    },
  });
  if (!stock || stock.quarterlyStats.length === 0) return null;

  const snapshot = stock.quarterlyStats.find((row) => row.reportType === 'snapshot') ?? null;
  const historicalRows = stock.quarterlyStats.filter((row) => row.reportType !== 'snapshot');

  const availableRows = [
    ...(snapshot ? [snapshot] : []),
    ...historicalRows,
  ];
  if (availableRows.length === 0) return null;

  const selectedRow =
    (requestedPeriodId ? availableRows.find((row) => buildLegacyPeriodId(row.reportType, row.periodEnd) === requestedPeriodId) : null)
    ?? snapshot
    ?? availableRows[0];

  const selectedPeriodInfo: PeriodInfo = {
    id: buildLegacyPeriodId(selectedRow.reportType, selectedRow.periodEnd),
    label: legacyPeriodLabel(selectedRow.reportType, selectedRow.periodEnd),
    periodType: selectedRow.reportType === 'snapshot' ? 'snapshot' : selectedRow.reportType === 'Annual' ? 'annual' : 'quarterly',
    endDate: toIsoDate(selectedRow.periodEnd),
  };

  const comparableRow =
    selectedRow.reportType === 'snapshot'
      ? historicalRows[Math.min(3, historicalRows.length - 1)] ?? null
      : historicalRows.find((row) => row.reportType === selectedRow.reportType && row.periodEnd.getUTCFullYear() === selectedRow.periodEnd.getUTCFullYear() - 1)
        ?? historicalRows[historicalRows.indexOf(selectedRow) + 4]
        ?? null;

  const peHistory = historicalRows
    .map((row) => validNumber(row.peRatio))
    .filter((value): value is number => value != null && value > 0 && value < 200);

  const { metricValues, factValues } = buildLegacyMetricValues(selectedRow, snapshot, comparableRow, peHistory);
  const metricDefinitionsList = await prisma.companyMetricDefinition.findMany({
    where: {
      category: {
        in: ['valuation', 'quality', 'risk'],
      },
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      code: true,
      label: true,
      unitType: true,
      description: true,
    },
  });
  const metricDefinitions = new Map(metricDefinitionsList.map((definition) => [definition.code, definition]));
  const metrics = buildMetricGroups(metricDefinitions, metricValues);

  return {
    ticker: stock.ticker,
    name: stock.name,
    sector: stock.sector,
    exchange: stock.exchange,
    industry: stock.industry,
    currency: 'USD',
    price: snapshot?.price ?? null,
    priceChange: snapshot?.priceChange ?? null,
    priceChangePct: snapshot?.priceChangePct ?? null,
    selectedPeriod: selectedPeriodInfo,
    availablePeriods: availableRows.map((row) => ({
      id: buildLegacyPeriodId(row.reportType, row.periodEnd),
      label: legacyPeriodLabel(row.reportType, row.periodEnd),
      periodType: row.reportType === 'snapshot' ? 'snapshot' : row.reportType === 'Annual' ? 'annual' : 'quarterly',
      endDate: toIsoDate(row.periodEnd),
    })),
    summary: {
      cards: buildSummaryCards(metrics),
      highlights: buildHighlights(selectedPeriodInfo, factValues, metricValues),
    },
    metrics,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const requestedPeriodId = req.nextUrl.searchParams.get('periodId');

  const hybrid = await handleNewSchema(symbol, requestedPeriodId);
  if (hybrid) {
    return NextResponse.json(hybrid);
  }

  const legacy = await handleLegacy(symbol, requestedPeriodId);
  if (legacy) {
    return NextResponse.json(legacy);
  }

  return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
}
