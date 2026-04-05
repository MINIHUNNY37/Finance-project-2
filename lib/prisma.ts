import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// On Vercel/serverless, each function invocation gets its own module scope.
// Cap the connection pool so we don't exhaust Neon's free-tier 10-connection limit
// even under concurrent requests or during heavy migration runs.
function createPrismaClient() {
  const url = process.env.DATABASE_URL;

  // During Next.js build, DATABASE_URL may not be present — return a bare client
  // so the build succeeds. At runtime on Vercel the env var is always set.
  if (!url) return new PrismaClient();

  // Append connection_limit if not already present to avoid exhausting
  // Neon free-tier's ~10 simultaneous connection cap.
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
