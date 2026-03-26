/**
 * Admin-only CRUD for TemplateMap entries.
 *
 * GET    /api/admin/templates          — list all templates (incl. inactive)
 * POST   /api/admin/templates          — create template from pasted JSON OR from a saved mapId
 * PATCH  /api/admin/templates?id=<id>  — update name/description/category/isActive
 * DELETE /api/admin/templates?id=<id>  — delete template
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAILS = ['minjune043010@gmail.com'];

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return null;
  }
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const templates = await prisma.templateMap.findMany({
    select: { id: true, name: true, description: true, category: true, isActive: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  let { name, description, category, data, mapId } = body as {
    name?: string;
    description?: string;
    category?: string;
    data?: string;   // raw JSON string pasted by admin
    mapId?: string;  // shortcut: promote an existing saved map directly
  };

  // If mapId provided, pull data from the SavedMap table — no JSON paste needed
  if (mapId) {
    const saved = await prisma.savedMap.findFirst({ where: { mapId } });
    if (!saved) return NextResponse.json({ error: 'Map not found' }, { status: 404 });
    data = saved.data;
    if (!name?.trim()) name = saved.name;
  }

  if (!name?.trim() || !data?.trim()) {
    return NextResponse.json({ error: 'name and data are required' }, { status: 400 });
  }

  // Validate that data is valid JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return NextResponse.json({ error: 'data is not valid JSON' }, { status: 400 });
  }

  // Re-stringify normalised (removes whitespace variance)
  const normalised = JSON.stringify(parsed);

  const template = await prisma.templateMap.create({
    data: {
      name: name.trim(),
      description: description?.trim() ?? '',
      category: category?.trim() || 'custom',
      data: normalised,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, id: template.id });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json() as {
    name?: string;
    description?: string;
    category?: string;
    isActive?: boolean;
  };

  const updated = await prisma.templateMap.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: { id: true, name: true, isActive: true },
  });

  return NextResponse.json({ ok: true, template: updated });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.templateMap.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
