import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

const ADMIN_EMAILS = ['minjune043010@gmail.com'];

export async function ensureMetaTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DbTableSchema" (
      "id"          TEXT        NOT NULL,
      "tableName"   TEXT        NOT NULL,
      "displayName" TEXT        NOT NULL,
      "description" TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "DbTableSchema_pkey"         PRIMARY KEY ("id"),
      CONSTRAINT "DbTableSchema_tableName_key" UNIQUE ("tableName")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DbColumnSchema" (
      "id"           TEXT        NOT NULL,
      "tableId"      TEXT        NOT NULL,
      "columnName"   TEXT        NOT NULL,
      "displayName"  TEXT        NOT NULL,
      "dataType"     TEXT        NOT NULL DEFAULT 'TEXT',
      "isPrimaryKey" BOOLEAN     NOT NULL DEFAULT false,
      "isForeignKey" BOOLEAN     NOT NULL DEFAULT false,
      "foreignTable" TEXT,
      "isNullable"   BOOLEAN     NOT NULL DEFAULT true,
      "position"     INTEGER     NOT NULL DEFAULT 0,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "DbColumnSchema_pkey"                   PRIMARY KEY ("id"),
      CONSTRAINT "DbColumnSchema_tableId_fkey"           FOREIGN KEY ("tableId") REFERENCES "DbTableSchema"("id") ON DELETE CASCADE,
      CONSTRAINT "DbColumnSchema_tableId_columnName_key" UNIQUE ("tableId", "columnName")
    )
  `);
}

async function getAllSchemas() {
  return prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT
      t.id, t."tableName", t."displayName", t."description",
      t."createdAt", t."updatedAt",
      COALESCE(
        json_agg(
          json_build_object(
            'id',           c.id,
            'tableId',      c."tableId",
            'columnName',   c."columnName",
            'displayName',  c."displayName",
            'dataType',     c."dataType",
            'isPrimaryKey', c."isPrimaryKey",
            'isForeignKey', c."isForeignKey",
            'foreignTable', c."foreignTable",
            'isNullable',   c."isNullable",
            'position',     c."position"
          )
          ORDER BY c."position"
        ) FILTER (WHERE c.id IS NOT NULL),
        '[]'::json
      ) AS columns
    FROM "DbTableSchema" t
    LEFT JOIN "DbColumnSchema" c ON c."tableId" = t.id
    GROUP BY t.id
    ORDER BY t."createdAt"
  `);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureMetaTables();
  const tables = await getAllSchemas();
  return NextResponse.json(tables);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { displayName, tableName, description, columns = [] } = await req.json();
  if (!displayName || !tableName) {
    return NextResponse.json({ error: 'displayName and tableName are required' }, { status: 400 });
  }

  await ensureMetaTables();

  const id  = uuidv4();
  const now = new Date().toISOString();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "DbTableSchema" ("id","tableName","displayName","description","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6)`,
    id, tableName, displayName, description ?? null, now, now
  );

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DbColumnSchema"
        ("id","tableId","columnName","displayName","dataType","isPrimaryKey","isForeignKey","foreignTable","isNullable","position","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      uuidv4(), id,
      col.columnName, col.displayName, col.dataType ?? 'TEXT',
      col.isPrimaryKey ?? false, col.isForeignKey ?? false, col.foreignTable ?? null,
      col.isNullable !== false, col.position ?? i, now, now
    );
  }

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT t.id, t."tableName", t."displayName", t."description", t."createdAt", t."updatedAt",
      COALESCE(
        json_agg(json_build_object(
          'id',c.id,'tableId',c."tableId",'columnName',c."columnName",'displayName',c."displayName",
          'dataType',c."dataType",'isPrimaryKey',c."isPrimaryKey",'isForeignKey',c."isForeignKey",
          'foreignTable',c."foreignTable",'isNullable',c."isNullable",'position',c."position"
        ) ORDER BY c."position") FILTER (WHERE c.id IS NOT NULL),'[]'::json
      ) AS columns
    FROM "DbTableSchema" t LEFT JOIN "DbColumnSchema" c ON c."tableId"=t.id
    WHERE t.id=$1 GROUP BY t.id`,
    id
  );

  return NextResponse.json(rows[0], { status: 201 });
}
