import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/maps — list all maps for the logged-in user
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.email;
  const maps = await prisma.savedMap.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, mapId: true, name: true, updatedAt: true, createdAt: true, data: true },
  });

  return NextResponse.json({ maps });
}

// POST /api/maps — save (upsert) the current map for the logged-in user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.email;
  const { map } = await req.json();

  if (!map?.id || !map?.name) {
    return NextResponse.json({ error: 'Invalid map data' }, { status: 400 });
  }

  const saved = await prisma.savedMap.upsert({
    where: { userId_mapId: { userId, mapId: map.id } },
    update: { name: map.name, data: JSON.stringify(map), updatedAt: new Date() },
    create: { userId, mapId: map.id, name: map.name, data: JSON.stringify(map) },
  });

  return NextResponse.json({ success: true, id: saved.id });
}
