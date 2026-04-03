export const FORMULA_VERSION = 'v1';

export const COMPANY_METRIC_DEFINITIONS = [
  {
    code: 'valuation_pe',
    label: 'PER',
    category: 'valuation',
    unitType: 'ratio',
    sortOrder: 1,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: 'share_price / trailing_eps',
    description: 'Price-to-Earnings Ratio. Null if trailing EPS <= 0.',
  },
  {
    code: 'valuation_pb',
    label: 'PBR',
    category: 'valuation',
    unitType: 'ratio',
    sortOrder: 2,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: 'market_cap / total_equity',
    description: 'Price-to-Book Ratio. Null if total equity <= 0.',
  },
  {
    code: 'valuation_ev_ebit',
    label: 'EV/EBIT',
    category: 'valuation',
    unitType: 'ratio',
    sortOrder: 3,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: '(market_cap + total_debt - cash_and_equivalents) / ebit',
    description: 'Enterprise Value to EBIT. Null if EBIT <= 0.',
  },
  {
    code: 'valuation_fcf_yield',
    label: 'FCF Yield',
    category: 'valuation',
    unitType: 'percent',
    sortOrder: 4,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: '(free_cash_flow / market_cap) * 100',
    description: 'Free Cash Flow yield in percentage points. Null if market cap <= 0.',
  },
  {
    code: 'valuation_percentile',
    label: 'Valuation Percentile',
    category: 'valuation',
    unitType: 'percent',
    sortOrder: 5,
    availableInPeriodTypes: JSON.stringify(['snapshot']),
    formula: 'percentile_rank(current_pe, own_historical_pe_series) * 100',
    description: 'Percentile rank of current P/E versus own historical series. Null when fewer than 8 valid points exist.',
  },
  {
    code: 'quality_revenue_growth',
    label: 'Revenue Growth',
    category: 'quality',
    unitType: 'percent',
    sortOrder: 6,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm']),
    formula: '((revenue_current - revenue_prior_year) / abs(revenue_prior_year)) * 100',
    description: 'Year-over-year revenue growth in percentage points.',
  },
  {
    code: 'quality_operating_margin',
    label: 'Operating Margin',
    category: 'quality',
    unitType: 'percent',
    sortOrder: 7,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm']),
    formula: '(operating_income / revenue) * 100',
    description: 'Operating profit as a percentage of revenue.',
  },
  {
    code: 'quality_roe',
    label: 'ROE',
    category: 'quality',
    unitType: 'percent',
    sortOrder: 8,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm']),
    formula: '(net_income / total_equity) * 100',
    description: 'Return on Equity in percentage points.',
  },
  {
    code: 'quality_roic',
    label: 'ROIC',
    category: 'quality',
    unitType: 'percent',
    sortOrder: 9,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm']),
    formula: '((operating_income * (1 - 0.21)) / invested_capital) * 100',
    description: 'Return on Invested Capital using a 21% default tax assumption when tax detail is unavailable.',
  },
  {
    code: 'quality_cfo_net_income',
    label: 'CFO/Net Income',
    category: 'quality',
    unitType: 'ratio',
    sortOrder: 10,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm']),
    formula: 'cash_from_operations / net_income',
    description: 'Cash earnings quality ratio. Null if net income <= 0.',
  },
  {
    code: 'risk_fcf',
    label: 'FCF',
    category: 'risk',
    unitType: 'currency',
    sortOrder: 11,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm', 'snapshot']),
    formula: 'cash_from_operations - capex',
    description: 'Free Cash Flow in reporting currency.',
  },
  {
    code: 'risk_net_debt_ebitda',
    label: 'Net Debt/EBITDA',
    category: 'risk',
    unitType: 'ratio',
    sortOrder: 12,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm']),
    formula: '(total_debt - cash_and_equivalents) / ebitda',
    description: 'Financial leverage ratio. Null if EBITDA <= 0.',
  },
  {
    code: 'risk_interest_coverage',
    label: 'Interest Coverage',
    category: 'risk',
    unitType: 'ratio',
    sortOrder: 13,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm']),
    formula: 'ebit / interest_expense',
    description: 'EBIT divided by interest expense. textValue can be "N/D" when interest expense is zero.',
  },
  {
    code: 'risk_cash_short_debt',
    label: 'Cash/Short-term Debt',
    category: 'risk',
    unitType: 'ratio',
    sortOrder: 14,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'ttm', 'snapshot']),
    formula: 'cash_and_equivalents / short_term_debt',
    description: 'Near-term liquidity cushion. Null if short-term debt <= 0.',
  },
  {
    code: 'risk_shareholder_yield',
    label: 'Shareholder Yield',
    category: 'risk',
    unitType: 'percent',
    sortOrder: 15,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: 'dividend_yield + buyback_yield',
    description: 'Combined dividend and buyback yield in percentage points.',
  },
] as const;

export const COMPANY_FACT_DEFINITIONS = [
  { code: 'share_price', label: 'Share Price', category: 'market', unitType: 'currency', sortOrder: 1, description: 'Observed share price used for valuation calculations.' },
  { code: 'market_cap', label: 'Market Cap', category: 'market', unitType: 'currency', sortOrder: 2, description: 'Observed market capitalisation in USD.' },
  { code: 'trailing_eps', label: 'Trailing EPS', category: 'market', unitType: 'currency', sortOrder: 3, description: 'Trailing twelve-month earnings per share.' },
  { code: 'book_value_per_share', label: 'Book Value Per Share', category: 'balance_sheet', unitType: 'currency', sortOrder: 4, description: 'Book value per share when available or derivable.' },
  { code: 'revenue', label: 'Revenue', category: 'income_statement', unitType: 'currency', sortOrder: 5, description: 'Reported revenue for the period.' },
  { code: 'operating_income', label: 'Operating Income', category: 'income_statement', unitType: 'currency', sortOrder: 6, description: 'Operating income for the period.' },
  { code: 'ebit', label: 'EBIT', category: 'income_statement', unitType: 'currency', sortOrder: 7, description: 'Earnings before interest and tax.' },
  { code: 'ebitda', label: 'EBITDA', category: 'income_statement', unitType: 'currency', sortOrder: 8, description: 'Earnings before interest, tax, depreciation, and amortisation.' },
  { code: 'net_income', label: 'Net Income', category: 'income_statement', unitType: 'currency', sortOrder: 9, description: 'Net income attributable to common shareholders.' },
  { code: 'cash_from_operations', label: 'Cash From Operations', category: 'cash_flow', unitType: 'currency', sortOrder: 10, description: 'Cash generated from operating activities.' },
  { code: 'capex', label: 'Capex', category: 'cash_flow', unitType: 'currency', sortOrder: 11, description: 'Capital expenditures for the period.' },
  { code: 'free_cash_flow', label: 'Free Cash Flow', category: 'cash_flow', unitType: 'currency', sortOrder: 12, description: 'Free cash flow for the period.' },
  { code: 'total_equity', label: 'Total Equity', category: 'balance_sheet', unitType: 'currency', sortOrder: 13, description: 'Shareholders equity at period end.' },
  { code: 'total_debt', label: 'Total Debt', category: 'balance_sheet', unitType: 'currency', sortOrder: 14, description: 'Total debt at period end.' },
  { code: 'short_term_debt', label: 'Short-term Debt', category: 'balance_sheet', unitType: 'currency', sortOrder: 15, description: 'Short-term borrowings due within one year.' },
  { code: 'cash_and_equivalents', label: 'Cash and Equivalents', category: 'balance_sheet', unitType: 'currency', sortOrder: 16, description: 'Cash and cash equivalents at period end.' },
  { code: 'interest_expense', label: 'Interest Expense', category: 'income_statement', unitType: 'currency', sortOrder: 17, description: 'Interest expense for the period.' },
  { code: 'shares_outstanding', label: 'Shares Outstanding', category: 'market', unitType: 'number', sortOrder: 18, description: 'Shares outstanding used for per-share calculations.' },
  { code: 'invested_capital', label: 'Invested Capital', category: 'balance_sheet', unitType: 'currency', sortOrder: 19, description: 'Total debt plus equity minus cash.' },
  { code: 'enterprise_value', label: 'Enterprise Value', category: 'market', unitType: 'currency', sortOrder: 20, description: 'Enterprise value derived from market cap, debt, and cash.' },
  { code: 'dividend_yield', label: 'Dividend Yield', category: 'capital_returns', unitType: 'percent', sortOrder: 21, description: 'Dividend yield in percentage points.' },
  { code: 'buyback_yield', label: 'Buyback Yield', category: 'capital_returns', unitType: 'percent', sortOrder: 22, description: 'Net buyback yield in percentage points.' },
] as const;

export const COMPANY_LIBRARY_DEFINITIONS = [
  { slug: 'nasdaq', title: 'NASDAQ', description: 'Companies in the tracked universe listed on NASDAQ', sortOrder: 1 },
  { slug: 'sp500', title: 'S&P 500', description: 'All S&P 500 index constituents', sortOrder: 2 },
  { slug: 'nasdaq100', title: 'NASDAQ-100', description: 'All NASDAQ-100 index constituents', sortOrder: 3 },
  { slug: 'us-big-tech', title: 'US Big Tech', description: 'Large-cap US technology leaders', sortOrder: 4 },
  { slug: 'semiconductors', title: 'Semiconductors', description: 'Global semiconductor companies', sortOrder: 5 },
  { slug: 'korean-large-cap', title: 'Korean Large Caps', description: 'Major Korean listed companies', sortOrder: 6 },
] as const;

export function toDateOnly(date: Date): Date {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function quarterFromDate(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getUTCMonth() + 1;
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

export function quarterLabel(date: Date): string {
  const year = date.getUTCFullYear();
  return `Q${quarterFromDate(date)} ${year}`;
}

export function buildQuarterPeriodKey(date: Date): string {
  return `Q${quarterFromDate(date)}-${date.getUTCFullYear()}`;
}

export function buildTtmPeriodKey(date: Date): string {
  return `TTM-${toDateOnly(date).toISOString().split('T')[0]}`;
}

export function buildSnapshotPeriodKey(date: Date): string {
  return `SNAP-${toDateOnly(date).toISOString().split('T')[0]}`;
}

export function safeRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

export function safePercent(numerator: number | null, denominator: number | null): number | null {
  const ratio = safeRatio(numerator, denominator);
  return ratio == null ? null : ratio * 100;
}

export function normalizeStoredPercent(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.abs(value) <= 1.5 ? value * 100 : value;
}
