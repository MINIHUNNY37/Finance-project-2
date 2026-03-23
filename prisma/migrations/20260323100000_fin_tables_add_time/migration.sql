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

-- ── 1. fin_time ───────────────────────────────────────────────────────────────
-- Ensure the table exists with the expected shape.
-- If the user already created it via the UI it will be left unchanged except
-- for the optional event_type column addition.

CREATE TABLE IF NOT EXISTS "fin_time" (
  "reported_at" TIMESTAMPTZ NOT NULL,
  "event_type"  TEXT,
  PRIMARY KEY ("reported_at")
);

-- If the table was created by the UI without event_type, add it safely.
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
