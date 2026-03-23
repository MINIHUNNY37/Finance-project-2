import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureMetaTables } from '@/lib/db-meta';

const ADMIN_EMAILS = ['minjune043010@gmail.com'];

const SQL_TYPES: Record<string, string> = {
  TEXT:       'TEXT',
  NUMERIC:    'NUMERIC',
  INTEGER:    'INTEGER',
  BOOLEAN:    'BOOLEAN',
  TIMESTAMPTZ:'TIMESTAMPTZ',
};

interface ColumnSchema {
  columnName:   string;
  dataType:     string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignTable: string | null;
  isNullable:   boolean;
  position:     number;
}

interface TableSchema {
  id:          string;
  tableName:   string;
  displayName: string;
  columns:     ColumnSchema[];
}

function buildCreateSQL(schema: TableSchema): string {
  const sorted = [...schema.columns].sort((a, b) => a.position - b.position);

  const pkCols = sorted.filter(c => c.isPrimaryKey).map(c => `"${c.columnName}"`);

  const colDefs = sorted.map(col => {
    const sqlType  = SQL_TYPES[col.dataType] ?? 'TEXT';
    const nullable = col.isNullable && !col.isPrimaryKey ? '' : ' NOT NULL';
    return `  "${col.columnName}" ${sqlType}${nullable}`;
  });

  if (pkCols.length > 0) {
    colDefs.push(`  PRIMARY KEY (${pkCols.join(', ')})`);
  }

  return `CREATE TABLE IF NOT EXISTS "${schema.tableName}" (\n${colDefs.join(',\n')}\n)`;
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1
     ) AS exists`,
    tableName
  );
  return rows[0]?.exists ?? false;
}

async function getExistingColumns(tableName: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`,
    tableName
  );
  return rows.map(r => r.column_name);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureMetaTables();
  const { id } = await params;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT t.id, t."tableName", t."displayName", t."description",
      COALESCE(
        json_agg(json_build_object(
          'id',c.id,'columnName',c."columnName",'displayName',c."displayName",
          'dataType',c."dataType",'isPrimaryKey',c."isPrimaryKey",'isForeignKey',c."isForeignKey",
          'foreignTable',c."foreignTable",'isNullable',c."isNullable",'position',c."position"
        ) ORDER BY c."position") FILTER (WHERE c.id IS NOT NULL),'[]'::json
      ) AS columns
    FROM "DbTableSchema" t LEFT JOIN "DbColumnSchema" c ON c."tableId"=t.id
    WHERE t.id=$1 GROUP BY t.id`,
    id
  );

  if (!rows[0]) return NextResponse.json({ error: 'Schema not found' }, { status: 404 });

  const schema = rows[0] as unknown as TableSchema;
  const ops: string[] = [];

  if (!(await tableExists(schema.tableName))) {
    // Create the table from scratch
    const sql = buildCreateSQL(schema);
    await prisma.$executeRawUnsafe(sql);
    ops.push(`Created table "${schema.tableName}"`);
  } else {
    // Add any missing columns (safe, non-destructive)
    const existing = await getExistingColumns(schema.tableName);
    const sorted = [...schema.columns].sort((a, b) => a.position - b.position);

    for (const col of sorted) {
      if (!existing.includes(col.columnName)) {
        const sqlType  = SQL_TYPES[col.dataType] ?? 'TEXT';
        const nullable = col.isNullable ? '' : ' NOT NULL';
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "${schema.tableName}" ADD COLUMN IF NOT EXISTS "${col.columnName}" ${sqlType}${nullable}`
        );
        ops.push(`Added column "${col.columnName}" to "${schema.tableName}"`);
      }
    }
    if (ops.length === 0) ops.push(`"${schema.tableName}" is already up-to-date`);
  }

  // Add FK constraints if referenced table exists
  const fkCols = schema.columns.filter(c => c.isForeignKey && c.foreignTable);
  for (const col of fkCols) {
    if (!col.foreignTable) continue;
    if (!(await tableExists(col.foreignTable))) {
      ops.push(`Skipped FK on "${col.columnName}" — "${col.foreignTable}" not yet synced`);
      continue;
    }
    const constraintName = `fk_${schema.tableName}_${col.columnName}`;
    // Check if constraint already exists
    const exists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_constraint WHERE conname=$1
       ) AS exists`,
      constraintName
    );
    if (!exists[0]?.exists) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "${schema.tableName}"
           ADD CONSTRAINT "${constraintName}"
           FOREIGN KEY ("${col.columnName}") REFERENCES "${col.foreignTable}"("ticker")`
        );
        ops.push(`Added FK constraint ${constraintName}`);
      } catch {
        ops.push(`FK constraint ${constraintName} could not be added (data mismatch?)`);
      }
    }
  }

  return NextResponse.json({ ok: true, operations: ops });
}
