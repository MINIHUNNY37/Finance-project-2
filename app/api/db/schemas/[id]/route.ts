import { NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '@/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const schema = await prisma.dbTableSchema.findUnique({
      where: { id },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
    if (!schema) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(schema);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const { displayName, tableName, description, columns } = await req.json();

    // Update table metadata
    await prisma.dbTableSchema.update({
      where: { id },
      data: {
        ...(displayName  !== undefined && { displayName }),
        ...(tableName    !== undefined && { tableName }),
        ...(description  !== undefined && { description }),
      },
    });

    // Replace columns if provided
    if (Array.isArray(columns)) {
      await prisma.dbColumnSchema.deleteMany({ where: { tableId: id } });
      await prisma.dbColumnSchema.createMany({
        data: columns.map((col: Record<string, unknown>, i: number) => ({
          tableId:      id,
          columnName:   String(col.columnName),
          displayName:  String(col.displayName),
          dataType:     String(col.dataType ?? 'TEXT'),
          isPrimaryKey: Boolean(col.isPrimaryKey ?? false),
          isForeignKey: Boolean(col.isForeignKey ?? false),
          foreignTable: col.foreignTable ? String(col.foreignTable) : null,
          isNullable:   col.isNullable !== false,
          position:     Number(col.position ?? i),
        })),
      });
    }

    const updated = await prisma.dbTableSchema.findUnique({
      where: { id },
      include: { columns: { orderBy: { position: 'asc' } } },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    await prisma.dbTableSchema.delete({ where: { id } }); // columns cascade
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
