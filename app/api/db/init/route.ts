import { NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '@/auth';
import { prisma } from '@/lib/prisma';

// ── Table definitions ─────────────────────────────────────────────────────────
//
// fin_time is the event anchor: a row is created only when a real event exists
// (e.g. an earnings release). All fact tables (valuation / quality / risk)
// carry a reported_at column that FKs → fin_time.reported_at, giving every
// metric row a clear "as-of" timestamp.
//
// Composite PK on fact tables: (ticker, reported_at)
//
// NOTE: The sync endpoint creates FK constraints to "ticker" on the referenced
// table by default. The reported_at → fin_time FK is handled separately via
// the 20260323100000_fin_tables_add_time SQL migration.

const DEFAULT_TABLES = [
  // ── Event time anchor ───────────────────────────────────────────────────────
  {
    tableName:   'fin_time',
    displayName: 'Time',
    description: 'Event timestamps. A row is created only when a meaningful event occurs (e.g. an earnings release). All fact tables reference this via reported_at.',
    columns: [
      { columnName: 'reported_at', displayName: 'Reported At', dataType: 'TIMESTAMPTZ', isPrimaryKey: true,  isForeignKey: false, foreignTable: null, isNullable: false, position: 0 },
      { columnName: 'event_type',  displayName: 'Event Type',  dataType: 'TEXT',         isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true,  position: 1 },
    ],
  },

  // ── Master ticker reference ─────────────────────────────────────────────────
  {
    tableName:   'fin_stock_info',
    displayName: 'Stock Info',
    description: 'Master list of stocks with basic identifying information.',
    columns: [
      { columnName: 'ticker',       displayName: 'Ticker',        dataType: 'TEXT', isPrimaryKey: true,  isForeignKey: false, foreignTable: null, isNullable: false, position: 0 },
      { columnName: 'company_name', displayName: 'Company Name',  dataType: 'TEXT', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true,  position: 1 },
      { columnName: 'exchange',     displayName: 'Exchange',      dataType: 'TEXT', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true,  position: 2 },
      { columnName: 'sector',       displayName: 'Sector',        dataType: 'TEXT', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true,  position: 3 },
    ],
  },

  // ── Valuation metrics (per ticker, per earnings date) ───────────────────────
  {
    tableName:   'fin_valuation',
    displayName: 'Valuation',
    description: 'Valuation multiples keyed by (ticker, reported_at). reported_at references fin_time — one row per earnings release.',
    columns: [
      { columnName: 'ticker',               displayName: 'Ticker',               dataType: 'TEXT',    isPrimaryKey: true,  isForeignKey: true,  foreignTable: 'fin_stock_info', isNullable: false, position: 0 },
      { columnName: 'reported_at',          displayName: 'Reported At',          dataType: 'TIMESTAMPTZ', isPrimaryKey: true, isForeignKey: false, foreignTable: null,            isNullable: false, position: 1 },
      { columnName: 'per',                  displayName: 'PER (P/E)',            dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 2 },
      { columnName: 'pbr',                  displayName: 'PBR (P/B)',            dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 3 },
      { columnName: 'ev_ebit',              displayName: 'EV/EBIT',              dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 4 },
      { columnName: 'fcf_yield',            displayName: 'FCF Yield (%)',        dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 5 },
      { columnName: 'valuation_percentile', displayName: 'Valuation Percentile', dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 6 },
    ],
  },

  // ── Quality metrics (per ticker, per earnings date) ─────────────────────────
  {
    tableName:   'fin_quality',
    displayName: 'Quality',
    description: 'Business quality indicators keyed by (ticker, reported_at). Covers growth, profitability and capital efficiency.',
    columns: [
      { columnName: 'ticker',           displayName: 'Ticker',           dataType: 'TEXT',    isPrimaryKey: true,  isForeignKey: true,  foreignTable: 'fin_stock_info', isNullable: false, position: 0 },
      { columnName: 'reported_at',      displayName: 'Reported At',      dataType: 'TIMESTAMPTZ', isPrimaryKey: true, isForeignKey: false, foreignTable: null,            isNullable: false, position: 1 },
      { columnName: 'revenue_growth',   displayName: 'Revenue Growth (%)',   dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 2 },
      { columnName: 'operating_margin', displayName: 'Operating Margin (%)', dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 3 },
      { columnName: 'roe',              displayName: 'ROE (%)',              dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 4 },
      { columnName: 'roic',             displayName: 'ROIC (%)',             dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 5 },
      { columnName: 'cfo_net_income',   displayName: 'CFO / Net Income',     dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 6 },
    ],
  },

  // ── Risk metrics (per ticker, per earnings date) ────────────────────────────
  {
    tableName:   'fin_risk',
    displayName: 'Risk',
    description: 'Balance-sheet and shareholder-return risk metrics keyed by (ticker, reported_at).',
    columns: [
      { columnName: 'ticker',            displayName: 'Ticker',                  dataType: 'TEXT',    isPrimaryKey: true,  isForeignKey: true,  foreignTable: 'fin_stock_info', isNullable: false, position: 0 },
      { columnName: 'reported_at',       displayName: 'Reported At',             dataType: 'TIMESTAMPTZ', isPrimaryKey: true, isForeignKey: false, foreignTable: null,            isNullable: false, position: 1 },
      { columnName: 'fcf',               displayName: 'FCF (USD)',               dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 2 },
      { columnName: 'net_debt_ebitda',   displayName: 'Net Debt / EBITDA',       dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 3 },
      { columnName: 'interest_coverage', displayName: 'Interest Coverage',       dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 4 },
      { columnName: 'cash_short_debt',   displayName: 'Cash / Short-term Debt',  dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 5 },
      { columnName: 'shareholder_yield', displayName: 'Shareholder Yield (%)',   dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true, position: 6 },
    ],
  },
];

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const created: string[] = [];
    const skipped: string[] = [];

    for (const tbl of DEFAULT_TABLES) {
      const existing = await prisma.dbTableSchema.findUnique({
        where: { tableName: tbl.tableName },
        include: { columns: { select: { id: true } } },
      });

      if (existing) {
        if (existing.columns.length > 0) {
          skipped.push(tbl.tableName);
          continue;
        }
        // Table row exists but columns are missing — backfill
        await prisma.dbColumnSchema.createMany({
          data: tbl.columns.map(col => ({ ...col, tableId: existing.id })),
          skipDuplicates: true,
        });
        created.push(tbl.tableName);
        continue;
      }

      await prisma.dbTableSchema.create({
        data: {
          tableName:   tbl.tableName,
          displayName: tbl.displayName,
          description: tbl.description,
          columns: { create: tbl.columns },
        },
      });
      created.push(tbl.tableName);
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[db/init]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
