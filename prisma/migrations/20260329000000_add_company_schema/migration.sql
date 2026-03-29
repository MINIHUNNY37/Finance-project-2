-- Migration: add_company_schema
-- Adds the normalized Company / Library / Period / Metric schema alongside
-- existing stock tables (nothing is dropped or altered here).
-- All CREATE TABLE statements use IF NOT EXISTS so this is safe to re-run.

-- ── Company registry ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Company" (
  "id"        TEXT NOT NULL,
  "ticker"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "exchange"  TEXT,
  "sector"    TEXT,
  "industry"  TEXT,
  "country"   TEXT NOT NULL DEFAULT 'US',
  "currency"  TEXT NOT NULL DEFAULT 'USD',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Company_ticker_key" ON "Company"("ticker");

-- ── Company libraries ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CompanyLibrary" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyLibrary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyLibrary_slug_key" ON "CompanyLibrary"("slug");

-- ── Library membership (many-to-many) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CompanyLibraryMembership" (
  "id"        TEXT NOT NULL,
  "libraryId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "addedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyLibraryMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyLibraryMembership_libraryId_fkey"
    FOREIGN KEY ("libraryId") REFERENCES "CompanyLibrary"("id") ON DELETE CASCADE,
  CONSTRAINT "CompanyLibraryMembership_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyLibraryMembership_libraryId_companyId_key"
  ON "CompanyLibraryMembership"("libraryId", "companyId");

CREATE INDEX IF NOT EXISTS "CompanyLibraryMembership_libraryId_sortOrder_idx"
  ON "CompanyLibraryMembership"("libraryId", "sortOrder");

-- ── Time-period axis ─────────────────────────────────────────────────────────
-- periodKey format:
--   quarterly  →  "Q-{year}-{quarter}"    e.g. "Q-2025-4"
--   annual     →  "A-{year}"              e.g. "A-2024"
--   ttm        →  "TTM-{YYYY-MM}"         e.g. "TTM-2025-03"
--   snapshot   →  "SNAP-{YYYY-MM-DD}"     e.g. "SNAP-2025-03-29"

CREATE TABLE IF NOT EXISTS "CompanyPeriod" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "periodKey"     TEXT NOT NULL,
  "periodType"    TEXT NOT NULL,
  "fiscalYear"    INTEGER,
  "fiscalQuarter" INTEGER,
  "periodLabel"   TEXT NOT NULL,
  "startDate"     DATE,
  "endDate"       DATE,
  "reportedAt"    TIMESTAMP(3),
  "isLatest"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyPeriod_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPeriod_companyId_periodKey_key"
  ON "CompanyPeriod"("companyId", "periodKey");

CREATE INDEX IF NOT EXISTS "CompanyPeriod_companyId_periodType_isLatest_idx"
  ON "CompanyPeriod"("companyId", "periodType", "isLatest");

-- ── Metric catalogue ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CompanyMetricDefinition" (
  "id"                     TEXT NOT NULL,
  "code"                   TEXT NOT NULL,
  "label"                  TEXT NOT NULL,
  "category"               TEXT NOT NULL,
  "unitType"               TEXT NOT NULL,
  "formula"                TEXT NOT NULL DEFAULT '',
  "description"            TEXT NOT NULL DEFAULT '',
  "availableInPeriodTypes" TEXT NOT NULL DEFAULT '[]',
  "sortOrder"              INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "CompanyMetricDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMetricDefinition_code_key"
  ON "CompanyMetricDefinition"("code");

-- ── Metric values ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CompanyMetricValue" (
  "id"                 TEXT NOT NULL,
  "periodId"           TEXT NOT NULL,
  "metricDefinitionId" TEXT NOT NULL,
  "numericValue"       DOUBLE PRECISION,
  "textValue"          TEXT,
  "currency"           TEXT,
  "source"             TEXT NOT NULL DEFAULT 'system',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyMetricValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyMetricValue_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "CompanyPeriod"("id") ON DELETE CASCADE,
  CONSTRAINT "CompanyMetricValue_metricDefinitionId_fkey"
    FOREIGN KEY ("metricDefinitionId") REFERENCES "CompanyMetricDefinition"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMetricValue_periodId_metricDefinitionId_key"
  ON "CompanyMetricValue"("periodId", "metricDefinitionId");

CREATE INDEX IF NOT EXISTS "CompanyMetricValue_periodId_idx"
  ON "CompanyMetricValue"("periodId");

-- ── Daily price candles ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CompanyDailyPrice" (
  "companyId"     TEXT NOT NULL,
  "date"          DATE NOT NULL,
  "open"          DOUBLE PRECISION,
  "high"          DOUBLE PRECISION,
  "low"           DOUBLE PRECISION,
  "close"         DOUBLE PRECISION,
  "adjustedClose" DOUBLE PRECISION,
  "volume"        BIGINT,

  CONSTRAINT "CompanyDailyPrice_pkey" PRIMARY KEY ("companyId", "date"),
  CONSTRAINT "CompanyDailyPrice_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CompanyDailyPrice_companyId_date_idx"
  ON "CompanyDailyPrice"("companyId", "date" DESC);
