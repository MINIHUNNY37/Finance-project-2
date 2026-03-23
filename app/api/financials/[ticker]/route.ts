/**
 * GET /api/financials/[ticker]
 *
 * Returns historical quarterly fundamentals from the five custom fin_* tables
 * for a given ticker symbol.
 *
 * NOTE: No `export const runtime = 'edge'` here — fin_* tables are queried via
 * Prisma which requires the Node.js runtime (edge runtime is not supported).
 *
 * Response shape:
 *   {
 *     stockInfo: { ticker, company_name, exchange, sector } | null,
 *     valuation:  FinValuationRow[],   // up to 12 quarters, newest first
 *     quality:    FinQualityRow[],
 *     risk:       FinRiskRow[],
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// ── Row types (snake_case mirrors PostgreSQL column names) ────────────────────

interface FinStockInfo {
  ticker:       string;
  company_name: string;
  exchange:     string;
  sector:       string | null;
}

interface FinValuationRow {
  reported_at:          Date;
  event_type:           string;
  per:                  number | null;
  pbr:                  number | null;
  ev_ebit:              number | null;
  fcf_yield:            number | null;
  valuation_percentile: number | null;
}

interface FinQualityRow {
  reported_at:      Date;
  event_type:       string;
  revenue_growth:   number | null;
  operating_margin: number | null;
  roe:              number | null;
  roic:             number | null;
  cfo_net_income:   number | null;
}

interface FinRiskRow {
  reported_at:       Date;
  event_type:        string;
  fcf:               number | null;
  net_debt_ebitda:   number | null;
  interest_coverage: number | null;
  cash_short_debt:   number | null;
  shareholder_yield: number | null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const [stockInfo, valuation, quality, risk] = await Promise.all([
    prisma.$queryRawUnsafe<FinStockInfo[]>(
      `SELECT ticker, company_name, exchange, sector
       FROM "fin_stock_info"
       WHERE ticker = $1`,
      symbol,
    ),

    prisma.$queryRawUnsafe<FinValuationRow[]>(
      `SELECT fv.reported_at, ft.event_type,
              fv.per, fv.pbr, fv.ev_ebit, fv.fcf_yield, fv.valuation_percentile
       FROM "fin_valuation" fv
       JOIN "fin_time" ft ON ft.reported_at = fv.reported_at
       WHERE fv.ticker = $1
       ORDER BY fv.reported_at DESC
       LIMIT 12`,
      symbol,
    ),

    prisma.$queryRawUnsafe<FinQualityRow[]>(
      `SELECT fq.reported_at, ft.event_type,
              fq.revenue_growth, fq.operating_margin, fq.roe, fq.roic, fq.cfo_net_income
       FROM "fin_quality" fq
       JOIN "fin_time" ft ON ft.reported_at = fq.reported_at
       WHERE fq.ticker = $1
       ORDER BY fq.reported_at DESC
       LIMIT 12`,
      symbol,
    ),

    prisma.$queryRawUnsafe<FinRiskRow[]>(
      `SELECT fr.reported_at, ft.event_type,
              fr.fcf, fr.net_debt_ebitda, fr.interest_coverage,
              fr.cash_short_debt, fr.shareholder_yield
       FROM "fin_risk" fr
       JOIN "fin_time" ft ON ft.reported_at = fr.reported_at
       WHERE fr.ticker = $1
       ORDER BY fr.reported_at DESC
       LIMIT 12`,
      symbol,
    ),
  ]);

  if (!stockInfo.length && !valuation.length) {
    return NextResponse.json(
      { error: `No financial data found for ${symbol}` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    stockInfo: stockInfo[0] ?? null,
    valuation,
    quality,
    risk,
  });
}
