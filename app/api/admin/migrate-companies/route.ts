/**
 * Phase 3 — Migrate existing stock data into the normalized company schema.
 *
 * GET  /api/admin/migrate-companies           — progress counts for all steps
 * POST /api/admin/migrate-companies?step=1    — StockUniverse → Company (~600 rows, runs in one go)
 * POST /api/admin/migrate-companies?step=2    — assign nasdaq100 / sp500 library memberships
 * POST /api/admin/migrate-companies?step=3    — StockDailyOHLC → CompanyDailyPrice
 *                                               ?offset=0&limit=50  (batch by ticker)
 * POST /api/admin/migrate-companies?step=4    — StockQuarterlyStats → CompanyPeriod + CompanyMetricValue
 *                                               ?offset=0&limit=50  (batch by ticker)
 *
 * All steps are idempotent — safe to re-run or resume after failure.
 *
 * Metrics migrated in step 4 (from existing StockQuarterlyStats fields):
 *   valuation_pe          peRatio              (snapshot periods only)
 *   valuation_pb          priceToBook          (snapshot periods only)
 *   valuation_fcf_yield   freeCashFlow/mktCap  (snapshot periods only)
 *   quality_operating_margin  operatingMargin  (all periods)
 *   quality_cfo_net_income    ocf/netIncome    (all periods, netIncome > 0)
 *   quality_revenue_growth    YoY calc         (quarterly/annual, prior-year data required)
 *   risk_fcf              freeCashFlow         (all periods)
 *
 * The remaining 8 metrics (ROIC, EV/EBIT, Interest Coverage, etc.) require
 * fresh data not stored in StockQuarterlyStats — those are Phase 3b.
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

// ── Period key helpers ───────────────────────────────────────────────────────

function makePeriodKey(reportType: string, periodEnd: Date): string {
  const d = new Date(periodEnd);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');

  if (reportType === 'snapshot') return `SNAP-${yyyy}-${mm}-${dd}`;
  if (reportType === 'Annual')   return `A-${yyyy}`;
  // Q1 / Q2 / Q3 / Q4
  const q = reportType.replace('Q', '');
  return `Q-${yyyy}-${q}`;
}

function makePeriodLabel(reportType: string, periodEnd: Date): string {
  const d = new Date(periodEnd);
  const yyyy = d.getUTCFullYear();
  if (reportType === 'snapshot') return `Snapshot ${yyyy}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  if (reportType === 'Annual')   return `FY${yyyy}`;
  return `${yyyy} ${reportType}`;  // e.g. "2025 Q4"
}

function reportTypeToPeriodType(reportType: string): string {
  if (reportType === 'snapshot') return 'snapshot';
  if (reportType === 'Annual')   return 'annual';
  return 'quarterly';
}

function reportTypeToQuarter(reportType: string): number | null {
  if (reportType === 'Q1') return 1;
  if (reportType === 'Q2') return 2;
  if (reportType === 'Q3') return 3;
  if (reportType === 'Q4') return 4;
  return null;
}

// ── Metric code lookup ───────────────────────────────────────────────────────
// Cached after first call
let metricCodes: Record<string, string> = {};

async function getMetricIds(): Promise<Record<string, string>> {
  if (Object.keys(metricCodes).length > 0) return metricCodes;
  const defs = await prisma.companyMetricDefinition.findMany({ select: { id: true, code: true } });
  metricCodes = Object.fromEntries(defs.map((d) => [d.code, d.id]));
  return metricCodes;
}

// ── Null-safe division ───────────────────────────────────────────────────────
function safeDivide(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den === 0) return null;
  return num / den;
}

// ── GET — progress status ────────────────────────────────────────────────────

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [
    stockUniverseCount,
    companyCount,
    membershipCount,
    ohlcCount,
    dailyPriceCount,
    quarterlyCount,
    periodCount,
    metricValueCount,
  ] = await Promise.all([
    prisma.stockUniverse.count(),
    prisma.company.count(),
    prisma.companyLibraryMembership.count(),
    prisma.stockDailyOHLC.count(),
    prisma.companyDailyPrice.count(),
    prisma.stockQuarterlyStats.count(),
    prisma.companyPeriod.count(),
    prisma.companyMetricValue.count(),
  ]);

  return NextResponse.json({
    step1: { label: 'StockUniverse → Company',                source: stockUniverseCount,  migrated: companyCount },
    step2: { label: 'Library memberships',                    migrated: membershipCount },
    step3: { label: 'StockDailyOHLC → CompanyDailyPrice',    source: ohlcCount,           migrated: dailyPriceCount },
    step4: { label: 'StockQuarterlyStats → Periods + Metrics', source: quarterlyCount,    periods: periodCount, metricValues: metricValueCount },
  });
}

// ── POST — migration steps ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const step   = searchParams.get('step');
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit  = parseInt(searchParams.get('limit')  ?? '50', 10);

  // ── Step 1: StockUniverse → Company ───────────────────────────────────────
  if (step === '1') {
    const stocks = await prisma.stockUniverse.findMany();
    let created = 0, skipped = 0;

    for (const s of stocks) {
      const existing = await prisma.company.findUnique({ where: { ticker: s.ticker } });
      if (existing) { skipped++; continue; }

      await prisma.company.create({
        data: {
          ticker:   s.ticker,
          name:     s.name,
          exchange: s.exchange,
          sector:   s.sector   ?? undefined,
          industry: s.industry ?? undefined,
          country:  s.country,
          currency: 'USD',
          isActive: true,
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, step: 1, total: stocks.length, created, skipped });
  }

  // ── Step 2: Library memberships ────────────────────────────────────────────
  if (step === '2') {
    const [nasdaq100Lib, sp500Lib] = await Promise.all([
      prisma.companyLibrary.findUnique({ where: { slug: 'nasdaq100' } }),
      prisma.companyLibrary.findUnique({ where: { slug: 'sp500' } }),
    ]);

    if (!nasdaq100Lib || !sp500Lib) {
      return NextResponse.json({ error: 'Run seed-company-schema?step=2 first to create library slugs' }, { status: 400 });
    }

    const stocks = await prisma.stockUniverse.findMany({
      where: { OR: [{ isNasdaq100: true }, { isSP500: true }] },
    });

    let created = 0, skipped = 0;

    for (const s of stocks) {
      const company = await prisma.company.findUnique({ where: { ticker: s.ticker } });
      if (!company) continue;

      if (s.isNasdaq100) {
        const exists = await prisma.companyLibraryMembership.findUnique({
          where: { libraryId_companyId: { libraryId: nasdaq100Lib.id, companyId: company.id } },
        });
        if (!exists) {
          await prisma.companyLibraryMembership.create({
            data: { libraryId: nasdaq100Lib.id, companyId: company.id },
          });
          created++;
        } else skipped++;
      }

      if (s.isSP500) {
        const exists = await prisma.companyLibraryMembership.findUnique({
          where: { libraryId_companyId: { libraryId: sp500Lib.id, companyId: company.id } },
        });
        if (!exists) {
          await prisma.companyLibraryMembership.create({
            data: { libraryId: sp500Lib.id, companyId: company.id },
          });
          created++;
        } else skipped++;
      }
    }

    return NextResponse.json({ ok: true, step: 2, created, skipped });
  }

  // ── Step 3: StockDailyOHLC → CompanyDailyPrice (batched by ticker) ─────────
  if (step === '3') {
    // Get a batch of tickers that have Company rows
    const companies = await prisma.company.findMany({
      skip: offset, take: limit,
      select: { id: true, ticker: true },
      orderBy: { ticker: 'asc' },
    });

    if (companies.length === 0) {
      return NextResponse.json({ ok: true, step: 3, done: true, message: 'No more tickers to process' });
    }

    let rowsCreated = 0;

    for (const company of companies) {
      const ohlcRows = await prisma.stockDailyOHLC.findMany({
        where: { ticker: company.ticker },
      });

      for (const row of ohlcRows) {
        await prisma.companyDailyPrice.upsert({
          where:  { companyId_date: { companyId: company.id, date: row.date } },
          update: {
            open:          row.open,
            high:          row.high,
            low:           row.low,
            close:         row.close,
            adjustedClose: row.adjClose ?? undefined,
            volume:        row.volume,
          },
          create: {
            companyId:     company.id,
            date:          row.date,
            open:          row.open,
            high:          row.high,
            low:           row.low,
            close:         row.close,
            adjustedClose: row.adjClose ?? undefined,
            volume:        row.volume,
          },
        });
        rowsCreated++;
      }
    }

    const totalCompanies = await prisma.company.count();
    const nextOffset = offset + limit;

    return NextResponse.json({
      ok: true, step: 3,
      processed: companies.length,
      rowsCreated,
      nextOffset,
      done: nextOffset >= totalCompanies,
      progress: `${Math.min(nextOffset, totalCompanies)} / ${totalCompanies} tickers`,
    });
  }

  // ── Step 4: StockQuarterlyStats → CompanyPeriod + CompanyMetricValue ────────
  if (step === '4') {
    const metricIds = await getMetricIds();

    // Verify metric definitions exist
    if (!metricIds['valuation_pe']) {
      return NextResponse.json({ error: 'Run seed-company-schema?step=1 first to create metric definitions' }, { status: 400 });
    }

    const companies = await prisma.company.findMany({
      skip: offset, take: limit,
      select: { id: true, ticker: true },
      orderBy: { ticker: 'asc' },
    });

    if (companies.length === 0) {
      return NextResponse.json({ ok: true, step: 4, done: true, message: 'No more tickers to process' });
    }

    let periodsCreated = 0, metricValuesCreated = 0;

    for (const company of companies) {
      // Fetch all stat rows for this ticker, newest first
      const stats = await prisma.stockQuarterlyStats.findMany({
        where: { ticker: company.ticker },
        orderBy: { periodEnd: 'desc' },
      });

      if (stats.length === 0) continue;

      // Build a lookup map: periodKey → revenue, for YoY growth calculation
      const revenueByKey: Record<string, number | null> = {};
      for (const s of stats) {
        revenueByKey[makePeriodKey(s.reportType, s.periodEnd)] = s.revenue;
      }

      // Track which periodTypes we've seen (first = latest since sorted desc)
      const seenLatest = new Set<string>();

      for (const s of stats) {
        const periodType = reportTypeToPeriodType(s.reportType);
        const periodKey  = makePeriodKey(s.reportType, s.periodEnd);
        const isLatest   = !seenLatest.has(periodType);
        if (isLatest) seenLatest.add(periodType);

        const d = new Date(s.periodEnd);
        const fiscalYear = d.getUTCFullYear();
        const fiscalQuarter = reportTypeToQuarter(s.reportType);

        // Upsert the period row
        const period = await prisma.companyPeriod.upsert({
          where:  { companyId_periodKey: { companyId: company.id, periodKey } },
          update: { isLatest, reportedAt: s.reportedAt ?? undefined },
          create: {
            companyId:    company.id,
            periodKey,
            periodType,
            fiscalYear,
            fiscalQuarter,
            periodLabel:  makePeriodLabel(s.reportType, s.periodEnd),
            endDate:      s.periodEnd,
            reportedAt:   s.reportedAt ?? undefined,
            isLatest,
          },
        });
        periodsCreated++;

        // Helper to upsert a single metric value
        const upsertMetric = async (code: string, numericValue: number | null, textValue?: string, currency?: string) => {
          const defId = metricIds[code];
          if (!defId) return;
          if (numericValue == null && !textValue) return; // nothing to store
          await prisma.companyMetricValue.upsert({
            where:  { periodId_metricDefinitionId: { periodId: period.id, metricDefinitionId: defId } },
            update: { numericValue: numericValue ?? undefined, textValue, currency },
            create: { periodId: period.id, metricDefinitionId: defId, numericValue: numericValue ?? undefined, textValue, currency },
          });
          metricValuesCreated++;
        };

        // ── Valuation (snapshot periods only — price required) ──────────────
        if (periodType === 'snapshot') {
          await upsertMetric('valuation_pe', s.peRatio);
          await upsertMetric('valuation_pb', s.priceToBook);
          await upsertMetric('valuation_fcf_yield', safeDivide(s.freeCashFlow, s.marketCap));
        }

        // ── Quality ─────────────────────────────────────────────────────────
        await upsertMetric('quality_operating_margin', s.operatingMargin);
        await upsertMetric('quality_cfo_net_income', safeDivide(s.operatingCashFlow, s.netIncome));

        // Revenue growth YoY — compare same quarter of prior year
        if (s.revenue != null) {
          let priorKey: string | null = null;
          if (s.reportType === 'Annual') {
            priorKey = `A-${fiscalYear - 1}`;
          } else if (fiscalQuarter != null) {
            priorKey = `Q-${fiscalYear - 1}-${fiscalQuarter}`;
          }
          if (priorKey && revenueByKey[priorKey] != null) {
            const priorRevenue = revenueByKey[priorKey]!;
            const growth = safeDivide(s.revenue - priorRevenue, Math.abs(priorRevenue));
            await upsertMetric('quality_revenue_growth', growth);
          }
        }

        // ── Risk ────────────────────────────────────────────────────────────
        // FCF stored as-is (can be negative — that IS the data point)
        if (s.freeCashFlow != null) {
          await upsertMetric('risk_fcf', s.freeCashFlow, undefined, 'USD');
        }
      }
    }

    const totalCompanies = await prisma.company.count();
    const nextOffset = offset + limit;

    return NextResponse.json({
      ok: true, step: 4,
      processed: companies.length,
      periodsCreated,
      metricValuesCreated,
      nextOffset,
      done: nextOffset >= totalCompanies,
      progress: `${Math.min(nextOffset, totalCompanies)} / ${totalCompanies} tickers`,
    });
  }

  return NextResponse.json({ error: 'step must be 1, 2, 3, or 4' }, { status: 400 });
}
