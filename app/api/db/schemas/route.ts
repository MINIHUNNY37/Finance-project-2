import { NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureMetaTables } from '@/lib/db-meta';
import { v4 as uuidv4 } from 'uuid';

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
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureMetaTables();
    const tables = await getAllSchemas();
    return NextResponse.json(tables);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[db/schemas GET] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[db/schemas POST] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
