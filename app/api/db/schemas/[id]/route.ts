import { NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '@/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { ensureMetaTables } from '@/lib/db-meta';

async function getSchemaById(id: string) {
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
  return rows[0] ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureMetaTables();
  const { id } = await params;
  const schema = await getSchemaById(id);
  if (!schema) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(schema);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureMetaTables();
  const { id } = await params;
  const existing = await getSchemaById(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { displayName, tableName, description, columns } = await req.json();
  const now = new Date().toISOString();

  // Update table metadata
  await prisma.$executeRawUnsafe(
    `UPDATE "DbTableSchema"
     SET "displayName"=$1,"tableName"=$2,"description"=$3,"updatedAt"=$4
     WHERE id=$5`,
    displayName ?? existing.displayName,
    tableName   ?? existing.tableName,
    description !== undefined ? description : existing.description,
    now, id
  );

  // Replace all columns if provided
  if (Array.isArray(columns)) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "DbColumnSchema" WHERE "tableId"=$1`, id
    );

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DbColumnSchema"
          ("id","tableId","columnName","displayName","dataType","isPrimaryKey","isForeignKey","foreignTable","isNullable","position","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        col.id ?? uuidv4(), id,
        col.columnName, col.displayName, col.dataType ?? 'TEXT',
        col.isPrimaryKey ?? false, col.isForeignKey ?? false, col.foreignTable ?? null,
        col.isNullable !== false, col.position ?? i, col.createdAt ?? now, now
      );
    }
  }

  return NextResponse.json(await getSchemaById(id));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureMetaTables();
  const { id } = await params;
  const schema = await getSchemaById(id);
  if (!schema) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Columns cascade-deleted due to FK constraint
  await prisma.$executeRawUnsafe(`DELETE FROM "DbTableSchema" WHERE id=$1`, id);
  return NextResponse.json({ ok: true });
}
