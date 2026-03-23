import { NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tables = await prisma.dbTableSchema.findMany({
      include: { columns: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(tables);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[db/schemas GET]', message);
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

    const created = await prisma.dbTableSchema.create({
      data: {
        displayName,
        tableName,
        description: description ?? null,
        columns: {
          create: columns.map((col: Record<string, unknown>, i: number) => ({
            columnName:   String(col.columnName),
            displayName:  String(col.displayName),
            dataType:     String(col.dataType ?? 'TEXT'),
            isPrimaryKey: Boolean(col.isPrimaryKey ?? false),
            isForeignKey: Boolean(col.isForeignKey ?? false),
            foreignTable: col.foreignTable ? String(col.foreignTable) : null,
            isNullable:   col.isNullable !== false,
            position:     Number(col.position ?? i),
          })),
        },
      },
      include: { columns: { orderBy: { position: 'asc' } } },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[db/schemas POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
