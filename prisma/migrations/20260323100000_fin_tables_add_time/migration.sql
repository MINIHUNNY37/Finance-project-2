-- Migration: fin_tables_add_time
--
-- Adds the time dimension to the custom financial tables so every fact row
-- is keyed by (ticker, reported_at):
--
--   fin_time        ← event anchor  (reported_at TIMESTAMPTZ PK)
--   fin_valuation   ← fact table    (ticker + reported_at composite PK)
--   fin_quality     ← fact table    (ticker + reported_at composite PK)
--   fin_risk        ← fact table    (ticker + reported_at composite PK)
--
-- fin_time gets a row only when a real event exists (e.g. an earnings release).
-- The other tables FK → fin_time.reported_at, so you always know WHEN each
-- set of metrics was valid.
--
-- This migration is safe to re-run (all statements are IF NOT EXISTS / IF EXISTS).

-- ── 0. Create all fin_* tables if they don't exist ───────────────────────────
--
-- These tables are NOT Prisma models, so `prisma migrate deploy` will never
-- drop them — but it also won't create them unless this migration does it.
-- Using IF NOT EXISTS makes every statement idempotent.

CREATE TABLE IF NOT EXISTS "fin_time" (
  "reported_at" TIMESTAMPTZ NOT NULL,
  "event_type"  TEXT,
  PRIMARY KEY ("reported_at")
);

CREATE TABLE IF NOT EXISTS "fin_stock_info" (
  "ticker"       TEXT NOT NULL,
  "company_name" TEXT NOT NULL,
  "exchange"     TEXT NOT NULL DEFAULT '',
  "sector"       TEXT,
  PRIMARY KEY ("ticker")
);

CREATE TABLE IF NOT EXISTS "fin_valuation" (
  "ticker"                TEXT        NOT NULL,
  "reported_at"           TIMESTAMPTZ NOT NULL,
  "per"                   DOUBLE PRECISION,
  "pbr"                   DOUBLE PRECISION,
  "ev_ebit"               DOUBLE PRECISION,
  "fcf_yield"             DOUBLE PRECISION,
  "valuation_percentile"  DOUBLE PRECISION,
  PRIMARY KEY ("ticker", "reported_at")
);

CREATE TABLE IF NOT EXISTS "fin_quality" (
  "ticker"           TEXT        NOT NULL,
  "reported_at"      TIMESTAMPTZ NOT NULL,
  "revenue_growth"   DOUBLE PRECISION,
  "operating_margin" DOUBLE PRECISION,
  "roe"              DOUBLE PRECISION,
  "roic"             DOUBLE PRECISION,
  "cfo_net_income"   DOUBLE PRECISION,
  PRIMARY KEY ("ticker", "reported_at")
);

CREATE TABLE IF NOT EXISTS "fin_risk" (
  "ticker"            TEXT        NOT NULL,
  "reported_at"       TIMESTAMPTZ NOT NULL,
  "fcf"               DOUBLE PRECISION,
  "net_debt_ebitda"   DOUBLE PRECISION,
  "interest_coverage" DOUBLE PRECISION,
  "cash_short_debt"   DOUBLE PRECISION,
  "shareholder_yield" DOUBLE PRECISION,
  PRIMARY KEY ("ticker", "reported_at")
);

-- ── 1. fin_time ───────────────────────────────────────────────────────────────
-- If the table was created above without event_type (older DB), add it safely.
ALTER TABLE "fin_time"
  ADD COLUMN IF NOT EXISTS "event_type" TEXT;

-- ── 2. fin_valuation ─────────────────────────────────────────────────────────

-- Add reported_at if missing
ALTER TABLE IF EXISTS "fin_valuation"
  ADD COLUMN IF NOT EXISTS "reported_at" TIMESTAMPTZ;

-- Back-fill NULLs so we can set NOT NULL (safe — tables are empty at this stage)
UPDATE "fin_valuation" SET "reported_at" = '1970-01-01 00:00:00+00'
  WHERE "reported_at" IS NULL;

ALTER TABLE IF EXISTS "fin_valuation"
  ALTER COLUMN "reported_at" SET NOT NULL;

-- Swap PK from (ticker) to (ticker, reported_at)
ALTER TABLE IF EXISTS "fin_valuation"
  DROP CONSTRAINT IF EXISTS "fin_valuation_pkey";

ALTER TABLE IF EXISTS "fin_valuation"
  ADD CONSTRAINT "fin_valuation_pkey"
  PRIMARY KEY ("ticker", "reported_at");

-- FK → fin_time
ALTER TABLE IF EXISTS "fin_valuation"
  DROP CONSTRAINT IF EXISTS "fk_fin_valuation_reported_at";

ALTER TABLE IF EXISTS "fin_valuation"
  ADD CONSTRAINT "fk_fin_valuation_reported_at"
  FOREIGN KEY ("reported_at")
  REFERENCES "fin_time" ("reported_at")
  ON DELETE CASCADE;

-- ── 3. fin_quality ───────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS "fin_quality"
  ADD COLUMN IF NOT EXISTS "reported_at" TIMESTAMPTZ;

UPDATE "fin_quality" SET "reported_at" = '1970-01-01 00:00:00+00'
  WHERE "reported_at" IS NULL;

ALTER TABLE IF EXISTS "fin_quality"
  ALTER COLUMN "reported_at" SET NOT NULL;

ALTER TABLE IF EXISTS "fin_quality"
  DROP CONSTRAINT IF EXISTS "fin_quality_pkey";

ALTER TABLE IF EXISTS "fin_quality"
  ADD CONSTRAINT "fin_quality_pkey"
  PRIMARY KEY ("ticker", "reported_at");

ALTER TABLE IF EXISTS "fin_quality"
  DROP CONSTRAINT IF EXISTS "fk_fin_quality_reported_at";

ALTER TABLE IF EXISTS "fin_quality"
  ADD CONSTRAINT "fk_fin_quality_reported_at"
  FOREIGN KEY ("reported_at")
  REFERENCES "fin_time" ("reported_at")
  ON DELETE CASCADE;

-- ── 4. fin_risk ───────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS "fin_risk"
  ADD COLUMN IF NOT EXISTS "reported_at" TIMESTAMPTZ;

UPDATE "fin_risk" SET "reported_at" = '1970-01-01 00:00:00+00'
  WHERE "reported_at" IS NULL;

ALTER TABLE IF EXISTS "fin_risk"
  ALTER COLUMN "reported_at" SET NOT NULL;

ALTER TABLE IF EXISTS "fin_risk"
  DROP CONSTRAINT IF EXISTS "fin_risk_pkey";

ALTER TABLE IF EXISTS "fin_risk"
  ADD CONSTRAINT "fin_risk_pkey"
  PRIMARY KEY ("ticker", "reported_at");

ALTER TABLE IF EXISTS "fin_risk"
  DROP CONSTRAINT IF EXISTS "fk_fin_risk_reported_at";

ALTER TABLE IF EXISTS "fin_risk"
  ADD CONSTRAINT "fk_fin_risk_reported_at"
  FOREIGN KEY ("reported_at")
  REFERENCES "fin_time" ("reported_at")
  ON DELETE CASCADE;
