-- Migration: company_hybrid_storage
--
-- Adds the hybrid company storage layer beside the legacy Stock* and fin_* tables.
-- The migration is written to be safe to re-run: existing columns are preserved,
-- new columns are added with IF NOT EXISTS, and new tables are created idempotently.

-- 1. Extend CompanyPeriod with richer lineage and period metadata.
ALTER TABLE "CompanyPeriod"
  ADD COLUMN IF NOT EXISTS "periodEndDate" DATE,
  ADD COLUMN IF NOT EXISTS "filingDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "asOfDate" DATE,
  ADD COLUMN IF NOT EXISTS "sourceProvider" TEXT NOT NULL DEFAULT 'yahoo',
  ADD COLUMN IF NOT EXISTS "restatementVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "ingestionRunId" TEXT;

UPDATE "CompanyPeriod"
SET
  "periodEndDate" = COALESCE("periodEndDate", "endDate"),
  "filingDate" = COALESCE("filingDate", "reportedAt"),
  "asOfDate" = COALESCE(
    "asOfDate",
    CASE
      WHEN "periodType" = 'snapshot' THEN COALESCE("endDate", "startDate")
      ELSE NULL
    END
  ),
  "sourceProvider" = COALESCE("sourceProvider", 'yahoo'),
  "restatementVersion" = COALESCE("restatementVersion", 1),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

DROP INDEX IF EXISTS "CompanyPeriod_companyId_periodKey_key";

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPeriod_companyId_periodKey_restatementVersion_key"
  ON "CompanyPeriod"("companyId", "periodKey", "restatementVersion");

CREATE INDEX IF NOT EXISTS "CompanyPeriod_companyId_periodType_periodEndDate_idx"
  ON "CompanyPeriod"("companyId", "periodType", "periodEndDate" DESC);

-- Normalize any pre-existing duplicate latest rows before adding the partial unique index.
WITH ranked_latest AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "companyId", "periodType"
      ORDER BY COALESCE("asOfDate", "periodEndDate", "endDate", "startDate") DESC NULLS LAST, "createdAt" DESC
    ) AS rn
  FROM "CompanyPeriod"
  WHERE "isLatest" = true
)
UPDATE "CompanyPeriod" AS cp
SET "isLatest" = false
FROM ranked_latest AS rl
WHERE cp."id" = rl."id"
  AND rl.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPeriod_companyId_periodType_latest_true_key"
  ON "CompanyPeriod"("companyId", "periodType")
  WHERE "isLatest" = true;

-- 2. Extend CompanyMetricValue for versioned formulas.
ALTER TABLE "CompanyMetricValue"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "formulaVersion" TEXT NOT NULL DEFAULT 'v1';

UPDATE "CompanyMetricValue"
SET
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP),
  "formulaVersion" = COALESCE(NULLIF("formulaVersion", ''), 'v1');

DROP INDEX IF EXISTS "CompanyMetricValue_periodId_metricDefinitionId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMetricValue_periodId_metricDefinitionId_formulaVersion_key"
  ON "CompanyMetricValue"("periodId", "metricDefinitionId", "formulaVersion");

-- 3. Extend CompanyDailyPrice with lineage timestamps.
ALTER TABLE "CompanyDailyPrice"
  ADD COLUMN IF NOT EXISTS "sourceProvider" TEXT NOT NULL DEFAULT 'yahoo',
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "CompanyDailyPrice"
SET
  "sourceProvider" = COALESCE("sourceProvider", 'yahoo'),
  "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

-- 4. Source fact dictionary and values.
CREATE TABLE IF NOT EXISTS "CompanyFactDefinition" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unitType" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyFactDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyFactDefinition_code_key"
  ON "CompanyFactDefinition"("code");

CREATE TABLE IF NOT EXISTS "CompanyFactValue" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "factDefinitionId" TEXT NOT NULL,
  "numericValue" DOUBLE PRECISION,
  "textValue" TEXT,
  "currency" TEXT,
  "sourceProvider" TEXT NOT NULL DEFAULT 'yahoo',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ingestionRunId" TEXT,
  CONSTRAINT "CompanyFactValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyFactValue_periodId_factDefinitionId_key"
  ON "CompanyFactValue"("periodId", "factDefinitionId");

CREATE INDEX IF NOT EXISTS "CompanyFactValue_periodId_idx"
  ON "CompanyFactValue"("periodId");

CREATE INDEX IF NOT EXISTS "CompanyFactValue_factDefinitionId_idx"
  ON "CompanyFactValue"("factDefinitionId");

ALTER TABLE "CompanyFactValue"
  DROP CONSTRAINT IF EXISTS "CompanyFactValue_periodId_fkey";

ALTER TABLE "CompanyFactValue"
  ADD CONSTRAINT "CompanyFactValue_periodId_fkey"
  FOREIGN KEY ("periodId")
  REFERENCES "CompanyPeriod"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "CompanyFactValue"
  DROP CONSTRAINT IF EXISTS "CompanyFactValue_factDefinitionId_fkey";

ALTER TABLE "CompanyFactValue"
  ADD CONSTRAINT "CompanyFactValue_factDefinitionId_fkey"
  FOREIGN KEY ("factDefinitionId")
  REFERENCES "CompanyFactDefinition"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 5. Corporate actions and ingestion runs.
CREATE TABLE IF NOT EXISTS "CompanyCorporateAction" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "actionDate" DATE NOT NULL,
  "actionType" TEXT NOT NULL,
  "amount" DOUBLE PRECISION,
  "ratio" DOUBLE PRECISION,
  "sharesDelta" DOUBLE PRECISION,
  "sourceProvider" TEXT NOT NULL DEFAULT 'yahoo',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyCorporateAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyCorporateAction_companyId_actionDate_actionType_key"
  ON "CompanyCorporateAction"("companyId", "actionDate", "actionType");

CREATE INDEX IF NOT EXISTS "CompanyCorporateAction_companyId_actionDate_idx"
  ON "CompanyCorporateAction"("companyId", "actionDate" DESC);

ALTER TABLE "CompanyCorporateAction"
  DROP CONSTRAINT IF EXISTS "CompanyCorporateAction_companyId_fkey";

ALTER TABLE "CompanyCorporateAction"
  ADD CONSTRAINT "CompanyCorporateAction_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CompanyIngestionRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "provider" TEXT NOT NULL,
  "universeKey" TEXT,
  "jobType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "payloadHash" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyIngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompanyIngestionRun_provider_jobType_status_idx"
  ON "CompanyIngestionRun"("provider", "jobType", "status");

CREATE INDEX IF NOT EXISTS "CompanyIngestionRun_companyId_startedAt_idx"
  ON "CompanyIngestionRun"("companyId", "startedAt" DESC);

CREATE INDEX IF NOT EXISTS "CompanyIngestionRun_universeKey_startedAt_idx"
  ON "CompanyIngestionRun"("universeKey", "startedAt" DESC);

ALTER TABLE "CompanyIngestionRun"
  DROP CONSTRAINT IF EXISTS "CompanyIngestionRun_companyId_fkey";

ALTER TABLE "CompanyIngestionRun"
  ADD CONSTRAINT "CompanyIngestionRun_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 6. Screening snapshot table.
CREATE TABLE IF NOT EXISTS "CompanyScreeningSnapshot" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sourcePeriodId" TEXT,
  "ingestionRunId" TEXT,
  "asOfDate" DATE NOT NULL,
  "priceDate" DATE,
  "snapshotType" TEXT NOT NULL,
  "formulaVersion" TEXT NOT NULL DEFAULT 'v1',
  "sourceProvider" TEXT NOT NULL DEFAULT 'system',
  "per" DOUBLE PRECISION,
  "pbr" DOUBLE PRECISION,
  "evEbit" DOUBLE PRECISION,
  "fcfYield" DOUBLE PRECISION,
  "valuationPercentile" DOUBLE PRECISION,
  "revenueGrowth" DOUBLE PRECISION,
  "operatingMargin" DOUBLE PRECISION,
  "roe" DOUBLE PRECISION,
  "roic" DOUBLE PRECISION,
  "cfoNetIncomeRatio" DOUBLE PRECISION,
  "fcf" DOUBLE PRECISION,
  "netDebtEbitda" DOUBLE PRECISION,
  "interestCoverage" DOUBLE PRECISION,
  "cashShortTermDebtRatio" DOUBLE PRECISION,
  "shareholderYield" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyScreeningSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyScreeningSnapshot_companyId_asOfDate_snapshotType_formulaVersion_key"
  ON "CompanyScreeningSnapshot"("companyId", "asOfDate", "snapshotType", "formulaVersion");

CREATE INDEX IF NOT EXISTS "CompanyScreeningSnapshot_snapshotType_asOfDate_idx"
  ON "CompanyScreeningSnapshot"("snapshotType", "asOfDate" DESC);

CREATE INDEX IF NOT EXISTS "CompanyScreeningSnapshot_companyId_snapshotType_asOfDate_idx"
  ON "CompanyScreeningSnapshot"("companyId", "snapshotType", "asOfDate" DESC);

CREATE INDEX IF NOT EXISTS "CompanyScreeningSnapshot_per_idx"
  ON "CompanyScreeningSnapshot"("per");

CREATE INDEX IF NOT EXISTS "CompanyScreeningSnapshot_roic_idx"
  ON "CompanyScreeningSnapshot"("roic");

CREATE INDEX IF NOT EXISTS "CompanyScreeningSnapshot_netDebtEbitda_idx"
  ON "CompanyScreeningSnapshot"("netDebtEbitda");

ALTER TABLE "CompanyScreeningSnapshot"
  DROP CONSTRAINT IF EXISTS "CompanyScreeningSnapshot_companyId_fkey";

ALTER TABLE "CompanyScreeningSnapshot"
  ADD CONSTRAINT "CompanyScreeningSnapshot_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "CompanyScreeningSnapshot"
  DROP CONSTRAINT IF EXISTS "CompanyScreeningSnapshot_sourcePeriodId_fkey";

ALTER TABLE "CompanyScreeningSnapshot"
  ADD CONSTRAINT "CompanyScreeningSnapshot_sourcePeriodId_fkey"
  FOREIGN KEY ("sourcePeriodId")
  REFERENCES "CompanyPeriod"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "CompanyScreeningSnapshot"
  DROP CONSTRAINT IF EXISTS "CompanyScreeningSnapshot_ingestionRunId_fkey";

ALTER TABLE "CompanyScreeningSnapshot"
  ADD CONSTRAINT "CompanyScreeningSnapshot_ingestionRunId_fkey"
  FOREIGN KEY ("ingestionRunId")
  REFERENCES "CompanyIngestionRun"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 7. Link CompanyPeriod and CompanyFactValue back to CompanyIngestionRun.
ALTER TABLE "CompanyPeriod"
  DROP CONSTRAINT IF EXISTS "CompanyPeriod_ingestionRunId_fkey";

ALTER TABLE "CompanyPeriod"
  ADD CONSTRAINT "CompanyPeriod_ingestionRunId_fkey"
  FOREIGN KEY ("ingestionRunId")
  REFERENCES "CompanyIngestionRun"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "CompanyFactValue"
  DROP CONSTRAINT IF EXISTS "CompanyFactValue_ingestionRunId_fkey";

ALTER TABLE "CompanyFactValue"
  ADD CONSTRAINT "CompanyFactValue_ingestionRunId_fkey"
  FOREIGN KEY ("ingestionRunId")
  REFERENCES "CompanyIngestionRun"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
