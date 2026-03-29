/**
 * Admin-only endpoint to seed Company schema definitions.
 *
 * GET  /api/admin/seed-company-schema         — status counts
 * POST /api/admin/seed-company-schema?step=1  — seed CompanyMetricDefinition (15 metrics)
 * POST /api/admin/seed-company-schema?step=2  — seed CompanyLibrary (initial library slugs)
 *
 * Both POST steps are fully idempotent (upsert on natural key).
 * Run step=1 before step=2.
 * Data migration (Company rows, periods, metric values) is Phase 3 — not here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAILS = ['minjune043010@gmail.com'];

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) return null;
  return session;
}

// ── Metric definitions ──────────────────────────────────────────────────────
// Exactly 15 metrics across 3 categories.
// availableInPeriodTypes documents which period types can carry each metric.
//   Valuation metrics require a market price — only valid on snapshot/ttm periods.
//   Quality metrics are derived from income/cash-flow statements — quarterly/annual/ttm.
//   Risk metrics are mostly balance-sheet / cash-flow — quarterly/annual/ttm (+snapshot where price needed).
//
// Formula edge cases (null policy):
//   - Ratios: null when denominator is zero or the sign makes the ratio meaningless.
//   - Interest Coverage: textValue = "N/D" when company has no interest expense (no debt).
//   - Valuation Percentile: null when fewer than 8 historical PE data points exist.
//   - FCF: stored as-is (can be negative — negative FCF is a valid data point).

const METRIC_DEFINITIONS = [
  // ── Valuation (price-dependent — snapshot and ttm only) ──────────────────
  {
    code: 'valuation_pe',
    label: 'PER',
    category: 'valuation',
    unitType: 'ratio',
    sortOrder: 1,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: 'price / trailing_12m_eps',
    description: 'Price-to-Earnings Ratio (trailing 12 months). Null if EPS ≤ 0.',
  },
  {
    code: 'valuation_pb',
    label: 'PBR',
    category: 'valuation',
    unitType: 'ratio',
    sortOrder: 2,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: 'price / book_value_per_share',
    description: 'Price-to-Book Ratio. Null if book value ≤ 0.',
  },
  {
    code: 'valuation_ev_ebit',
    label: 'EV/EBIT',
    category: 'valuation',
    unitType: 'ratio',
    sortOrder: 3,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: '(market_cap + total_debt - cash) / ebit',
    description: 'Enterprise Value to EBIT. Null if EBIT ≤ 0.',
  },
  {
    code: 'valuation_fcf_yield',
    label: 'FCF Yield',
    category: 'valuation',
    unitType: 'percent',
    sortOrder: 4,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: 'free_cash_flow / market_cap',
    description: 'Free Cash Flow as a percentage of market cap. Null if market cap = 0.',
  },
  {
    code: 'valuation_percentile',
    label: 'Valuation Percentile',
    category: 'valuation',
    unitType: 'percent',
    sortOrder: 5,
    availableInPeriodTypes: JSON.stringify(['snapshot']),
    formula: 'percentile_rank(current_pe, own_trailing_60q_pe_history)',
    description:
      'Percentile rank of current PE within the company\'s own trailing 5-year (60-quarter) PE history. ' +
      'Null if fewer than 8 historical data points are available.',
  },

  // ── Quality (income statement / cash flow — quarterly, annual, ttm) ──────
  {
    code: 'quality_revenue_growth',
    label: 'Revenue Growth',
    category: 'quality',
    unitType: 'percent',
    sortOrder: 6,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm']),
    formula: '(revenue_current - revenue_prior_year) / abs(revenue_prior_year)',
    description: 'Year-over-year revenue growth. Null if prior-year revenue is unavailable or zero.',
  },
  {
    code: 'quality_operating_margin',
    label: 'Operating Margin',
    category: 'quality',
    unitType: 'percent',
    sortOrder: 7,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm']),
    formula: 'operating_income / revenue',
    description: 'Operating profit as a percentage of revenue. Null if revenue = 0.',
  },
  {
    code: 'quality_roe',
    label: 'ROE',
    category: 'quality',
    unitType: 'percent',
    sortOrder: 8,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm']),
    formula: 'net_income / avg_shareholders_equity',
    description: 'Return on Equity. Null if average shareholders\' equity ≤ 0.',
  },
  {
    code: 'quality_roic',
    label: 'ROIC',
    category: 'quality',
    unitType: 'percent',
    sortOrder: 9,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm']),
    formula: 'nopat / (total_debt + total_equity - cash)',
    description:
      'Return on Invested Capital. NOPAT = operating_income * (1 - effective_tax_rate). ' +
      'Null if invested capital ≤ 0.',
  },
  {
    code: 'quality_cfo_net_income',
    label: 'CFO/Net Income',
    category: 'quality',
    unitType: 'ratio',
    sortOrder: 10,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm']),
    formula: 'operating_cash_flow / net_income',
    description:
      'Cash earnings quality ratio. Values > 1 indicate earnings backed by real cash. ' +
      'Null if net income = 0 or negative (denominator sign makes ratio misleading).',
  },

  // ── Risk (balance sheet / cash flow — most period types) ─────────────────
  {
    code: 'risk_fcf',
    label: 'FCF',
    category: 'risk',
    unitType: 'currency',
    sortOrder: 11,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm', 'snapshot']),
    formula: 'operating_cash_flow - capex',
    description: 'Free Cash Flow in reporting currency. Can be negative — stored as-is.',
  },
  {
    code: 'risk_net_debt_ebitda',
    label: 'Net Debt/EBITDA',
    category: 'risk',
    unitType: 'ratio',
    sortOrder: 12,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm']),
    formula: '(total_debt - cash_and_equivalents) / ebitda',
    description: 'Financial leverage. Null if EBITDA ≤ 0 (ratio loses meaning with negative EBITDA).',
  },
  {
    code: 'risk_interest_coverage',
    label: 'Interest Coverage',
    category: 'risk',
    unitType: 'ratio',
    sortOrder: 13,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm']),
    formula: 'ebit / interest_expense',
    description:
      'EBIT divided by interest expense. ' +
      'textValue = "N/D" when interest expense = 0 (company carries no debt). ' +
      'numericValue = null when EBIT is negative.',
  },
  {
    code: 'risk_cash_short_debt',
    label: 'Cash/Short-term Debt',
    category: 'risk',
    unitType: 'ratio',
    sortOrder: 14,
    availableInPeriodTypes: JSON.stringify(['quarterly', 'annual', 'ttm', 'snapshot']),
    formula: 'cash_and_equivalents / short_term_debt',
    description: 'Near-term liquidity cushion. Null if short-term debt = 0.',
  },
  {
    code: 'risk_shareholder_yield',
    label: 'Shareholder Yield',
    category: 'risk',
    unitType: 'percent',
    sortOrder: 15,
    availableInPeriodTypes: JSON.stringify(['snapshot', 'ttm']),
    formula: '(dividends_paid + net_share_buybacks) / market_cap',
    description: 'Combined dividend and buyback yield relative to market cap. Null if market cap = 0.',
  },
] as const;

// ── Initial library slugs ───────────────────────────────────────────────────

const LIBRARIES = [
  { slug: 'nasdaq100',        title: 'NASDAQ-100',        description: 'All NASDAQ-100 index constituents', sortOrder: 1 },
  { slug: 'sp500',            title: 'S&P 500',           description: 'All S&P 500 index constituents',    sortOrder: 2 },
  { slug: 'us-big-tech',      title: 'US Big Tech',       description: 'Large-cap US technology leaders',   sortOrder: 3 },
  { slug: 'semiconductors',   title: 'Semiconductors',    description: 'Global semiconductor companies',     sortOrder: 4 },
  { slug: 'korean-large-cap', title: 'Korean Large Caps', description: 'Major Korean listed companies',      sortOrder: 5 },
] as const;

// ── Handlers ────────────────────────────────────────────────────────────────

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [metricCount, libraryCount, companyCount, periodCount, metricValueCount] =
    await Promise.all([
      prisma.companyMetricDefinition.count(),
      prisma.companyLibrary.count(),
      prisma.company.count(),
      prisma.companyPeriod.count(),
      prisma.companyMetricValue.count(),
    ]);

  return NextResponse.json({
    metricCount,
    libraryCount,
    companyCount,
    periodCount,
    metricValueCount,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const step = searchParams.get('step');

  // ── Step 1: Seed metric definitions ──────────────────────────────────────
  if (step === '1') {
    let seeded = 0;
    for (const def of METRIC_DEFINITIONS) {
      await prisma.companyMetricDefinition.upsert({
        where:  { code: def.code },
        update: {
          label:                  def.label,
          category:               def.category,
          unitType:               def.unitType,
          formula:                def.formula,
          description:            def.description,
          availableInPeriodTypes: def.availableInPeriodTypes,
          sortOrder:              def.sortOrder,
        },
        create: {
          code:                   def.code,
          label:                  def.label,
          category:               def.category,
          unitType:               def.unitType,
          formula:                def.formula,
          description:            def.description,
          availableInPeriodTypes: def.availableInPeriodTypes,
          sortOrder:              def.sortOrder,
        },
      });
      seeded++;
    }
    return NextResponse.json({ ok: true, step: 1, seeded, total: METRIC_DEFINITIONS.length });
  }

  // ── Step 2: Seed library slugs ────────────────────────────────────────────
  if (step === '2') {
    let seeded = 0;
    for (const lib of LIBRARIES) {
      await prisma.companyLibrary.upsert({
        where:  { slug: lib.slug },
        update: { title: lib.title, description: lib.description, sortOrder: lib.sortOrder },
        create: { slug: lib.slug, title: lib.title, description: lib.description, sortOrder: lib.sortOrder },
      });
      seeded++;
    }
    return NextResponse.json({ ok: true, step: 2, seeded, total: LIBRARIES.length });
  }

  return NextResponse.json({ error: 'step must be 1 or 2' }, { status: 400 });
}
