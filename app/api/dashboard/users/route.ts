import { NextRequest, NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '../../../../auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Attach saved-map count per user
  const mapCounts = await prisma.savedMap.groupBy({
    by: ['userId'],
    _count: { mapId: true },
  });
  const countMap = new Map(mapCounts.map((r) => [r.userId, r._count.mapId]));

  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role: u.role,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
    savedMaps: countMap.get(u.id) ?? 0,
  }));

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId, role } = await req.json() as { userId: string; role: string };
  if (!['user', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return NextResponse.json({ id: updated.id, role: updated.role });
}
