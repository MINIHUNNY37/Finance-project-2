import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/maps/[id] — fetch a single saved map by its mapId
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.email;
  const { id: mapId } = await params;

  const map = await prisma.savedMap.findFirst({
    where: { userId, mapId },
  });

  if (!map) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ map: JSON.parse(map.data) });
}

// DELETE /api/maps/[id] — delete a map (only if it belongs to the logged-in user)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.email;
  const { id: mapId } = await params;

  const existing = await prisma.savedMap.findUnique({
    where: { userId_mapId: { userId, mapId } },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.savedMap.delete({ where: { userId_mapId: { userId, mapId } } });
  return NextResponse.json({ success: true });
}
