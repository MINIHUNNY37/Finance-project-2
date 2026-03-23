import { prisma } from '@/lib/prisma';

export async function ensureMetaTables() {
  // Use simple inline PK/UNIQUE — no named constraints to avoid collision on re-runs
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DbTableSchema" (
      "id"          TEXT        PRIMARY KEY,
      "tableName"   TEXT        NOT NULL UNIQUE,
      "displayName" TEXT        NOT NULL,
      "description" TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DbColumnSchema" (
      "id"           TEXT        PRIMARY KEY,
      "tableId"      TEXT        NOT NULL REFERENCES "DbTableSchema"("id") ON DELETE CASCADE,
      "columnName"   TEXT        NOT NULL,
      "displayName"  TEXT        NOT NULL,
      "dataType"     TEXT        NOT NULL DEFAULT 'TEXT',
      "isPrimaryKey" BOOLEAN     NOT NULL DEFAULT false,
      "isForeignKey" BOOLEAN     NOT NULL DEFAULT false,
      "foreignTable" TEXT,
      "isNullable"   BOOLEAN     NOT NULL DEFAULT true,
      "position"     INTEGER     NOT NULL DEFAULT 0,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tableId", "columnName")
    )
  `);
}
