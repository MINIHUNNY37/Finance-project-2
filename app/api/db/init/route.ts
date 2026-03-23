import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { ensureMetaTables } from '../schemas/route';

const ADMIN_EMAILS = ['minjune043010@gmail.com'];

const DEFAULT_TABLES = [
  {
    tableName:   'fin_stock_info',
    displayName: 'Stock Info',
    description: 'Master list of stocks with basic identifying information.',
    columns: [
      { columnName: 'ticker',       displayName: 'Ticker',        dataType: 'TEXT',    isPrimaryKey: true,  isForeignKey: false, foreignTable: null, isNullable: false, position: 0 },
      { columnName: 'company_name', displayName: 'Company Name',  dataType: 'TEXT',    isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true,  position: 1 },
      { columnName: 'exchange',     displayName: 'Stock Exchange', dataType: 'TEXT',    isPrimaryKey: false, isForeignKey: false, foreignTable: null, isNullable: true,  position: 2 },
    ],
  },
  {
    tableName:   'fin_valuation',
    displayName: 'Valuation',
    description: 'Valuation multiples and relative attractiveness metrics.',
    columns: [
      { columnName: 'ticker',               displayName: 'Ticker',               dataType: 'TEXT',    isPrimaryKey: true,  isForeignKey: true,  foreignTable: 'fin_stock_info', isNullable: false, position: 0 },
      { columnName: 'per',                  displayName: 'PER',                  dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 1 },
      { columnName: 'pbr',                  displayName: 'PBR',                  dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 2 },
      { columnName: 'ev_ebit',              displayName: 'EV/EBIT',              dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 3 },
      { columnName: 'fcf_yield',            displayName: 'FCF Yield',            dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 4 },
      { columnName: 'valuation_percentile', displayName: 'Valuation Percentile', dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 5 },
    ],
  },
  {
    tableName:   'fin_quality',
    displayName: 'Quality',
    description: 'Business quality indicators: growth, profitability and capital efficiency.',
    columns: [
      { columnName: 'ticker',          displayName: 'Ticker',             dataType: 'TEXT',    isPrimaryKey: true,  isForeignKey: true,  foreignTable: 'fin_stock_info', isNullable: false, position: 0 },
      { columnName: 'revenue_growth',  displayName: 'Revenue Growth',     dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 1 },
      { columnName: 'operating_margin',displayName: 'Operating Margin',   dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 2 },
      { columnName: 'roe',             displayName: 'ROE',                dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 3 },
      { columnName: 'roic',            displayName: 'ROIC',               dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 4 },
      { columnName: 'cfo_net_income',  displayName: 'CFO / Net Income',   dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 5 },
    ],
  },
  {
    tableName:   'fin_risk',
    displayName: 'Risk',
    description: 'Balance-sheet and shareholder-return risk metrics.',
    columns: [
      { columnName: 'ticker',             displayName: 'Ticker',                       dataType: 'TEXT',    isPrimaryKey: true,  isForeignKey: true,  foreignTable: 'fin_stock_info', isNullable: false, position: 0 },
      { columnName: 'fcf',                displayName: 'FCF',                          dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 1 },
      { columnName: 'net_debt_ebitda',    displayName: 'Net Debt / EBITDA',            dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 2 },
      { columnName: 'interest_coverage',  displayName: 'Interest Coverage',            dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 3 },
      { columnName: 'cash_short_debt',    displayName: 'Cash / Short-term Debt',       dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 4 },
      { columnName: 'shareholder_yield',  displayName: 'Shareholder Yield',            dataType: 'NUMERIC', isPrimaryKey: false, isForeignKey: false, foreignTable: null,             isNullable: true,  position: 5 },
    ],
  },
];

export async function POST() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureMetaTables();

  const created: string[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();

  for (const tbl of DEFAULT_TABLES) {
    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "DbTableSchema" WHERE "tableName"=$1`,
      tbl.tableName
    );

    if (existing.length > 0) {
      skipped.push(tbl.tableName);
      continue;
    }

    const id = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DbTableSchema" ("id","tableName","displayName","description","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      id, tbl.tableName, tbl.displayName, tbl.description, now, now
    );

    for (const col of tbl.columns) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DbColumnSchema"
          ("id","tableId","columnName","displayName","dataType","isPrimaryKey","isForeignKey","foreignTable","isNullable","position","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        uuidv4(), id,
        col.columnName, col.displayName, col.dataType,
        col.isPrimaryKey, col.isForeignKey, col.foreignTable,
        col.isNullable, col.position, now, now
      );
    }

    created.push(tbl.tableName);
  }

  return NextResponse.json({ ok: true, created, skipped });
}
