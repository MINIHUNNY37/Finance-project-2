/**
 * POST /api/admin/seed-fin-tables
 *
 * Fetches quarterly financial data from Yahoo Finance and populates the five
 * custom financial tables with a full time-series per ticker.
 *
 * ── Table & key design ───────────────────────────────────────────────────────
 *
 *   fin_time        PK: reported_at (TIMESTAMPTZ)
 *                   A row is created ONLY when a real earnings quarter exists.
 *                   This is the event anchor that all fact tables reference.
 *
 *   fin_stock_info  PK: ticker
 *                   One row per company — static info (name, exchange, sector).
 *
 *   fin_valuation   PK: (ticker, reported_at)  FK→fin_stock_info + fin_time
 *   fin_quality     PK: (ticker, reported_at)  FK→fin_stock_info + fin_time
 *   fin_risk        PK: (ticker, reported_at)  FK→fin_stock_info + fin_time
 *
 *   The composite PK means you get one metrics row per company per earnings
 *   release date — a full historical record, not just the latest snapshot.
 *
 * ── Yahoo Finance modules used ───────────────────────────────────────────────
 *
 *   incomeStatementHistory    → revenue, net income, EBIT, interest expense
 *   balanceSheetHistory       → equity, total debt, cash, short-term debt
 *   cashflowStatementHistory  → CFO, capex (FCF), dividends paid, buybacks
 *   defaultKeyStatistics      → enterprise value, P/B ratio, trailing EPS
 *   summaryDetail             → trailing P/E, dividend yield, market cap
 *   financialData             → TTM margins, FCF, EBITDA, revenue growth
 *
 * ── Metrics computed ─────────────────────────────────────────────────────────
 *
 *   fin_valuation:
 *     per               = trailing P/E (TTM, latest quarter only)
 *     pbr               = price-to-book (latest)
 *     ev_ebit           = enterprise value / quarterly EBIT
 *     fcf_yield         = TTM FCF / market cap × 100  (latest)
 *     valuation_pct     = NULL — requires cross-sectional ranking
 *
 *   fin_quality:
 *     revenue_growth    = YoY quarterly revenue growth %
 *     operating_margin  = operating income / revenue × 100
 *     roe               = net income / shareholders' equity × 100
 *     roic              = operating income / invested capital × 100
 *     cfo_net_income    = CFO / net income  (cash conversion quality)
 *
 *   fin_risk:
 *     fcf               = quarterly free cash flow (USD)
 *     net_debt_ebitda   = (total debt − cash) / EBITDA
 *     interest_coverage = EBIT / interest expense
 *     cash_short_debt   = cash / short-term debt
 *     shareholder_yield = (dividends + buybacks) / market cap × 100  (latest)
 *
 * ── Query params (POST) ──────────────────────────────────────────────────────
 *   ?offset=0    skip N tickers (pagination)
 *   ?limit=30    process up to N tickers per call (max 50)
 *
 * ── GET ──────────────────────────────────────────────────────────────────────
 *   Returns row counts for each fin_ table and last 5 time events stored.
 *
 * ── Prerequisite ─────────────────────────────────────────────────────────────
 *   Run the migration 20260323100000_fin_tables_add_time.sql on your Neon DB
 *   before calling this endpoint for the first time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '@/auth';
import { prisma } from '@/lib/prisma';

// ── helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email);
}

// ── Yahoo Finance crumb auth ──────────────────────────────────────────────────
// The v10/quoteSummary endpoint requires a crumb token + session cookie.
// We fetch both once at the start of each POST call and reuse across all tickers.

interface YahooAuth {
  crumb:   string;
  cookies: string;
}

async function getYahooAuth(): Promise<YahooAuth | null> {
  try {
    // Step 1 — hit the main Yahoo Finance page to receive a session cookie
    const homeRes = await fetch('https://finance.yahoo.com/', {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    // Collect all Set-Cookie headers into a single cookie string
    const setCookies: string[] = homeRes.headers.getSetCookie
      ? homeRes.headers.getSetCookie()
      : [(homeRes.headers.get('set-cookie') ?? '')];
    const cookies = setCookies
      .map(c => c.split(';')[0])   // keep only name=value, drop attributes
      .filter(Boolean)
      .join('; ');

    // Step 2 — exchange the session cookie for a crumb token
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie':          cookies,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!crumbRes.ok) return null;

    const crumb = (await crumbRes.text()).trim();
    // Sanity check — a valid crumb is a short alphanumeric string, not an HTML page
    if (!crumb || crumb.length > 50 || crumb.includes('<')) return null;

    return { crumb, cookies };
  } catch {
    return null;
  }
}

function nullIfZero(v: number): number | null {
  return v === 0 || !isFinite(v) ? null : v;
}

function pct(numerator: number, denominator: number): number | null {
  if (!denominator || !isFinite(denominator) || !isFinite(numerator)) return null;
  const v = (numerator / denominator) * 100;
  return isFinite(v) ? v : null;
}

function ratio(numerator: number, denominator: number): number | null {
  if (!denominator || !isFinite(denominator) || !isFinite(numerator)) return null;
  const v = numerator / denominator;
  return isFinite(v) ? v : null;
}

// ── Quarter label ─────────────────────────────────────────────────────────────

function quarterLabel(date: Date): string {
  const month = date.getUTCMonth() + 1;
  const year  = date.getUTCFullYear();
  const q     = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  return `${q}_${year}`;
}

// ── Per-quarter metrics ───────────────────────────────────────────────────────

interface QuarterMetrics {
  reportedAt:       Date;
  eventType:        string;

  // fin_valuation
  per:              number | null;   // trailing P/E — only meaningful for latest quarter
  pbr:              number | null;   // price-to-book — only meaningful for latest
  evEbit:           number | null;   // EV / quarterly EBIT
  fcfYield:         number | null;   // TTM FCF / market cap (latest)

  // fin_quality
  revenueGrowth:    number | null;   // YoY quarterly %
  operatingMargin:  number | null;   // %
  roe:              number | null;   // %
  roic:             number | null;   // %
  cfoCoverage:      number | null;   // CFO / net income

  // fin_risk
  quarterFcf:       number | null;   // quarterly FCF (USD)
  netDebtEbitda:    number | null;   // (debt − cash) / EBITDA
  interestCoverage: number | null;   // EBIT / interest expense
  cashShortDebt:    number | null;   // cash / short-term debt
  shareholderYield: number | null;   // (dividends + buybacks) / mktcap × 100 (latest)
}

// ── Yahoo Finance fetcher ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

async function fetchQuarterlyMetrics(
  ticker: string,
  auth: YahooAuth | null,
): Promise<QuarterMetrics[]> {
  const safe    = encodeURIComponent(ticker);
  const modules = [
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
    'defaultKeyStatistics',
    'summaryDetail',
    'financialData',
  ].join('%2C');

  // Append crumb to the query string when available
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : '';
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${safe}?modules=${modules}${crumbParam}`;

  const headers: Record<string, string> = {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':          'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (auth) headers['Cookie'] = auth.cookies;

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];

  const data: AnyRecord = await res.json();
  const r: AnyRecord = data?.quoteSummary?.result?.[0];
  if (!r) return [];

  // ── Raw modules ──────────────────────────────────────────────────────────────
  const incomeList: AnyRecord[]  = r.incomeStatementHistory?.incomeStatementHistory ?? [];
  const balanceList: AnyRecord[] = r.balanceSheetHistory?.balanceSheetStatements   ?? [];
  const cashList: AnyRecord[]    = r.cashflowStatementHistory?.cashflowStatements   ?? [];
  const kStats: AnyRecord        = r.defaultKeyStatistics ?? {};
  const summary: AnyRecord       = r.summaryDetail        ?? {};
  const finData: AnyRecord       = r.financialData        ?? {};

  // Index balance sheet and cash flow by quarter-end unix timestamp
  const balByTs:  Record<number, AnyRecord> = {};
  for (const b of balanceList) {
    const ts: number = b.endDate?.raw ?? 0;
    if (ts) balByTs[ts] = b;
  }

  const cashByTs: Record<number, AnyRecord> = {};
  for (const c of cashList) {
    const ts: number = c.endDate?.raw ?? 0;
    if (ts) cashByTs[ts] = c;
  }

  // ── Summary-level values (current snapshot — applied to most-recent quarter) ─
  const marketCap:      number = summary.marketCap?.raw         ?? 0;
  const trailingPE:     number = summary.trailingPE?.raw        ?? 0;
  const dividendYield:  number = summary.dividendYield?.raw     ?? 0;   // e.g. 0.0052
  const priceToBook:    number = kStats.priceToBook?.raw        ?? 0;
  const enterpriseValue:number = kStats.enterpriseValue?.raw    ?? 0;
  const ttmFCF:         number = finData.freeCashflow?.raw      ?? 0;
  const ttmEbitda:      number = finData.ebitda?.raw            ?? 0;
  const ttmRevGrowth:   number = finData.revenueGrowth?.raw     ?? 0;   // decimal

  // Build a lookup of revenue by timestamp so we can compute YoY growth per quarter
  const revenueByTs: Record<number, number> = {};
  for (const inc of incomeList) {
    const ts: number = inc.endDate?.raw ?? 0;
    if (ts) revenueByTs[ts] = inc.totalRevenue?.raw ?? 0;
  }

  const results: QuarterMetrics[] = [];

  for (let i = 0; i < incomeList.length; i++) {
    const inc = incomeList[i];
    const ts: number = inc.endDate?.raw ?? 0;
    if (!ts) continue;

    const reportedAt = new Date(ts * 1000);
    const isLatest   = i === 0;   // Yahoo returns newest first

    // ── Income statement ──────────────────────────────────────────────────────
    const revenue          = (inc.totalRevenue?.raw        ?? 0) as number;
    const netIncome        = (inc.netIncome?.raw            ?? 0) as number;
    const operatingIncome  = (inc.operatingIncome?.raw      ?? 0) as number;  // EBIT proxy
    const interestExpense  = Math.abs((inc.interestExpense?.raw ?? 0) as number);

    // ── Balance sheet ─────────────────────────────────────────────────────────
    const bal = balByTs[ts] ?? {};
    const equity        = (bal.totalStockholderEquity?.raw  ?? 0) as number;
    const longTermDebt  = (bal.longTermDebt?.raw             ?? 0) as number;
    const shortDebt     = (bal.shortLongTermDebt?.raw        ?? 0) as number;  // current LTD
    const totalDebt     = longTermDebt + shortDebt;
    const cashAndEquiv  = ((bal.cash?.raw ?? 0) as number)
                        + ((bal.shortTermInvestments?.raw ?? 0) as number);

    // ── Cash flow ─────────────────────────────────────────────────────────────
    const cf    = cashByTs[ts] ?? {};
    const cfo   = (cf.totalCashFromOperatingActivities?.raw ?? 0) as number;
    const capex = Math.abs((cf.capitalExpenditures?.raw     ?? 0) as number);
    const divPaid   = Math.abs((cf.dividendsPaid?.raw       ?? 0) as number);
    const buybacks  = Math.abs((cf.repurchaseOfStock?.raw   ?? 0) as number);

    const quarterFcf = cfo - capex;

    // ── EBITDA proxy for older quarters (TTM only available via financialData) ─
    // For the latest quarter use Yahoo's TTM EBITDA; for prior quarters
    // approximate as operating income (EBIT), which understates slightly.
    const ebitdaForRow = isLatest ? ttmEbitda : operatingIncome;

    // ── Revenue growth (YoY) ─────────────────────────────────────────────────
    // Find the same quarter from one year ago (roughly 4 entries back in the list)
    let revenueGrowth: number | null = null;
    if (isLatest) {
      // Use Yahoo's reported TTM growth for the latest quarter (most accurate)
      revenueGrowth = nullIfZero(ttmRevGrowth * 100);
    } else {
      // For historical quarters look for the matching quarter 12 months earlier
      const oneYearAgoTs = ts - 365 * 24 * 3600;
      // Find closest timestamp within ±45 days
      const priorTs = Object.keys(revenueByTs)
        .map(Number)
        .filter(t => Math.abs(t - oneYearAgoTs) < 45 * 24 * 3600)
        .sort((a, b) => Math.abs(a - oneYearAgoTs) - Math.abs(b - oneYearAgoTs))[0];
      const priorRevenue = priorTs ? (revenueByTs[priorTs] ?? 0) : 0;
      revenueGrowth = priorRevenue > 0 ? pct(revenue - priorRevenue, priorRevenue) : null;
    }

    // ── Derived metrics ───────────────────────────────────────────────────────

    // Valuation (P/E and P/B are price-dependent — only accurate for latest quarter)
    const per      = isLatest ? nullIfZero(trailingPE)   : null;
    const pbr      = isLatest ? nullIfZero(priceToBook)  : null;
    const evEbit   = (enterpriseValue > 0 && operatingIncome > 0)
                       ? ratio(enterpriseValue, operatingIncome)
                       : null;
    const fcfYield = (isLatest && marketCap > 0 && ttmFCF !== 0)
                       ? pct(ttmFCF, marketCap)
                       : null;

    // Quality
    const operatingMargin = revenue !== 0
      ? pct(operatingIncome, revenue)
      : null;
    const roe  = equity !== 0 ? pct(netIncome, equity) : null;
    const investedCapital = totalDebt + equity - cashAndEquiv;
    const roic = investedCapital > 0 ? pct(operatingIncome, investedCapital) : null;
    const cfoCoverage = netIncome !== 0 ? ratio(cfo, netIncome) : null;

    // Risk
    const netDebt        = totalDebt - cashAndEquiv;
    const netDebtEbitda  = ebitdaForRow !== 0
      ? ratio(netDebt, ebitdaForRow)
      : null;
    const interestCov    = interestExpense > 0 && operatingIncome !== 0
      ? ratio(operatingIncome, interestExpense)
      : null;
    const cashShortDebt  = shortDebt > 0 && cashAndEquiv !== 0
      ? ratio(cashAndEquiv, shortDebt)
      : null;

    // Shareholder yield = (dividend yield × market cap + buybacks) / market cap
    // Best computed for latest quarter since market cap is current
    const shareholderYield = (isLatest && marketCap > 0)
      ? pct(dividendYield * marketCap + divPaid + buybacks, marketCap)
      : null;

    results.push({
      reportedAt,
      eventType:        quarterLabel(reportedAt),
      per,
      pbr,
      evEbit,
      fcfYield,
      revenueGrowth,
      operatingMargin,
      roe,
      roic,
      cfoCoverage,
      quarterFcf:       nullIfZero(quarterFcf),
      netDebtEbitda,
      interestCoverage: interestCov,
      cashShortDebt,
      shareholderYield,
    });
  }

  return results;
}

// ── Upsert helpers (raw SQL — fin_* tables are not Prisma models) ─────────────

async function upsertFinTime(reportedAt: Date, eventType: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_time" ("reported_at", "event_type")
     VALUES ($1, $2)
     ON CONFLICT ("reported_at") DO UPDATE SET "event_type" = EXCLUDED."event_type"`,
    reportedAt,
    eventType,
  );
}

async function upsertFinStockInfo(
  ticker: string,
  name: string,
  exchange: string,
  sector: string | null,
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_stock_info" ("ticker", "company_name", "exchange", "sector")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("ticker") DO UPDATE SET
       "company_name" = EXCLUDED."company_name",
       "exchange"     = EXCLUDED."exchange",
       "sector"       = EXCLUDED."sector"`,
    ticker,
    name,
    exchange,
    sector ?? null,
  );
}

async function upsertFinValuation(ticker: string, q: QuarterMetrics) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_valuation"
       ("ticker","reported_at","per","pbr","ev_ebit","fcf_yield","valuation_percentile")
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT ("ticker","reported_at") DO UPDATE SET
       "per"                  = EXCLUDED."per",
       "pbr"                  = EXCLUDED."pbr",
       "ev_ebit"              = EXCLUDED."ev_ebit",
       "fcf_yield"            = EXCLUDED."fcf_yield",
       "valuation_percentile" = EXCLUDED."valuation_percentile"`,
    ticker,
    q.reportedAt,
    q.per,
    q.pbr,
    q.evEbit,
    q.fcfYield,
    null,   // valuation_percentile requires cross-sectional ranking — computed separately
  );
}

async function upsertFinQuality(ticker: string, q: QuarterMetrics) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_quality"
       ("ticker","reported_at","revenue_growth","operating_margin","roe","roic","cfo_net_income")
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT ("ticker","reported_at") DO UPDATE SET
       "revenue_growth"   = EXCLUDED."revenue_growth",
       "operating_margin" = EXCLUDED."operating_margin",
       "roe"              = EXCLUDED."roe",
       "roic"             = EXCLUDED."roic",
       "cfo_net_income"   = EXCLUDED."cfo_net_income"`,
    ticker,
    q.reportedAt,
    q.revenueGrowth,
    q.operatingMargin,
    q.roe,
    q.roic,
    q.cfoCoverage,
  );
}

async function upsertFinRisk(ticker: string, q: QuarterMetrics) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fin_risk"
       ("ticker","reported_at","fcf","net_debt_ebitda","interest_coverage","cash_short_debt","shareholder_yield")
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT ("ticker","reported_at") DO UPDATE SET
       "fcf"               = EXCLUDED."fcf",
       "net_debt_ebitda"   = EXCLUDED."net_debt_ebitda",
       "interest_coverage" = EXCLUDED."interest_coverage",
       "cash_short_debt"   = EXCLUDED."cash_short_debt",
       "shareholder_yield" = EXCLUDED."shareholder_yield"`,
    ticker,
    q.reportedAt,
    q.quarterFcf,
    q.netDebtEbitda,
    q.interestCoverage,
    q.cashShortDebt,
    q.shareholderYield,
  );
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const offset = Math.max(0,  parseInt(searchParams.get('offset') ?? '0',  10));
  const limit  = Math.min(50, parseInt(searchParams.get('limit')  ?? '30', 10));

  const stocks = await prisma.stockUniverse.findMany({
    skip:    offset,
    take:    limit,
    orderBy: { ticker: 'asc' },
    select:  { ticker: true, name: true, exchange: true, sector: true },
  });

  // Fetch Yahoo crumb once — reused for every ticker in this batch
  const yahooAuth = await getYahooAuth();

  let done   = 0;
  let failed = 0;
  let totalQuarters = 0;
  const errors: { ticker: string; reason: string }[] = [];

  for (const stock of stocks) {
    try {
      const quarters = await fetchQuarterlyMetrics(stock.ticker, yahooAuth);

      if (quarters.length === 0) {
        failed++;
        errors.push({ ticker: stock.ticker, reason: 'no quarterly data returned' });
        await sleep(200);
        continue;
      }

      // 1. Upsert stock master row (once per ticker)
      await upsertFinStockInfo(
        stock.ticker,
        stock.name,
        stock.exchange,
        stock.sector ?? null,
      );

      // 2. For each quarter that has a real earnings release date:
      //    create a fin_time row (only if it doesn't already exist), then
      //    write the fact rows for valuation / quality / risk.
      for (const q of quarters) {
        await upsertFinTime(q.reportedAt, q.eventType);
        await upsertFinValuation(stock.ticker, q);
        await upsertFinQuality(stock.ticker, q);
        await upsertFinRisk(stock.ticker, q);
        totalQuarters++;
      }

      done++;
    } catch (err) {
      failed++;
      errors.push({ ticker: stock.ticker, reason: String(err) });
    }

    // ~150 ms between tickers — polite rate-limit (~6 req/s)
    await sleep(150);
  }

  const totalUniverse = await prisma.stockUniverse.count();

  return NextResponse.json({
    done,
    failed,
    totalQuarters,
    offset,
    limit,
    batchSize:     stocks.length,
    totalUniverse,
    remaining:     Math.max(0, totalUniverse - offset - stocks.length),
    ...(errors.length > 0 && { errors }),
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Row counts for each fin_ table
  const [timeCount, stockInfoCount, valuationCount, qualityCount, riskCount] =
    await Promise.all([
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_time"'),
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_stock_info"'),
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_valuation"'),
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_quality"'),
      prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM "fin_risk"'),
    ]).catch(() => [null, null, null, null, null]);

  // Most recent fin_time events (last 5)
  const recentEvents = await prisma
    .$queryRawUnsafe<{ reported_at: Date; event_type: string }[]>(
      `SELECT "reported_at", "event_type"
       FROM "fin_time"
       ORDER BY "reported_at" DESC
       LIMIT 5`,
    )
    .catch(() => []);

  return NextResponse.json({
    rowCounts: {
      fin_time:       Number(timeCount?.[0]?.count       ?? 0),
      fin_stock_info: Number(stockInfoCount?.[0]?.count  ?? 0),
      fin_valuation:  Number(valuationCount?.[0]?.count  ?? 0),
      fin_quality:    Number(qualityCount?.[0]?.count    ?? 0),
      fin_risk:       Number(riskCount?.[0]?.count       ?? 0),
    },
    recentEvents: recentEvents.map(e => ({
      reportedAt: e.reported_at,
      eventType:  e.event_type,
    })),
    note: 'POST ?offset=0&limit=30 to seed a batch. Repeat with increasing offset until remaining=0.',
  });
}
