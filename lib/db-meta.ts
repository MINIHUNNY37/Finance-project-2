import { prisma } from '@/lib/prisma';

export async function ensureMetaTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DbTableSchema" (
      "id"          TEXT        NOT NULL,
      "tableName"   TEXT        NOT NULL,
      "displayName" TEXT        NOT NULL,
      "description" TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "DbTableSchema_pkey"         PRIMARY KEY ("id"),
      CONSTRAINT "DbTableSchema_tableName_key" UNIQUE ("tableName")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DbColumnSchema" (
      "id"           TEXT        NOT NULL,
      "tableId"      TEXT        NOT NULL,
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
      CONSTRAINT "DbColumnSchema_pkey"                   PRIMARY KEY ("id"),
      CONSTRAINT "DbColumnSchema_tableId_fkey"           FOREIGN KEY ("tableId") REFERENCES "DbTableSchema"("id") ON DELETE CASCADE,
      CONSTRAINT "DbColumnSchema_tableId_columnName_key" UNIQUE ("tableId", "columnName")
    )
  `);
}
