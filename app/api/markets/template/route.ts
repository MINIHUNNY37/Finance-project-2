/**
 * GET /api/markets/template
 * Returns a list of available template maps (metadata only).
 *
 * GET /api/markets/template?id=<id>
 * Returns the full ScenarioMap JSON for that template — ready to import.
 *
 * POST /api/markets/template/clone  →  see /api/markets/template/clone/route.ts
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    // Return a single template's full map data
    const template = await prisma.templateMap.findUnique({ where: { id } });
    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ template: { ...template, data: JSON.parse(template.data) } });
  }

  // List all active templates (no data blob — just metadata)
  const templates = await prisma.templateMap.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, category: true, createdAt: true, updatedAt: true },
    orderBy: { category: 'asc' },
  });

  return NextResponse.json({ templates });
}
