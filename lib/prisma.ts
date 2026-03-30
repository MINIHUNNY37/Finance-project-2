import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// On Vercel/serverless, each function invocation gets its own module scope.
// Cap the connection pool so we don't exhaust Neon's free-tier 10-connection limit
// even under concurrent requests or during heavy migration runs.
function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  // Append connection_limit if not already present
  const separator = url.includes('?') ? '&' : '?';
  const pooledUrl = url.includes('connection_limit')
    ? url
    : `${url}${separator}connection_limit=3&pool_timeout=10`;

  return new PrismaClient({
    datasources: { db: { url: pooledUrl } },
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
