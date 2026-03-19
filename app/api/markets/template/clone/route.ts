/**
 * POST /api/markets/template/clone
 * Body: { templateId: string }
 *
 * Clones a TemplateMap into the logged-in user's SavedMaps with a fresh map id.
 * Returns the new mapId so the client can load it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { ScenarioMap } from '@/app/types';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { templateId } = await req.json();
  if (!templateId) {
    return NextResponse.json({ error: 'templateId required' }, { status: 400 });
  }

  const template = await prisma.templateMap.findUnique({ where: { id: templateId } });
  if (!template || !template.isActive) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const userId  = session.user.email;
  const now     = new Date().toISOString();
  const newMapId = uuidv4();

  const original: ScenarioMap = JSON.parse(template.data);

  // Stamp ownership and give it a fresh id so it doesn't collide
  const cloned: ScenarioMap = {
    ...original,
    id:        newMapId,
    ownerId:   userId,
    sharedWith: [],
    shareToken: undefined,
    createdAt: now,
    updatedAt: now,
  };

  await prisma.savedMap.create({
    data: {
      userId,
      mapId: newMapId,
      name:  cloned.name,
      data:  JSON.stringify(cloned),
    },
  });

  return NextResponse.json({ ok: true, mapId: newMapId, name: cloned.name });
}
