-- Migration: quarterly_stats_composite_pk
-- Removes the surrogate `id` column from StockQuarterlyStats and promotes
-- (ticker, periodEnd, reportType) to a true composite PRIMARY KEY.
-- This aligns the table with all other time-series tables in the schema
-- where ticker + timestamp is the natural identifier.

-- ── 1. Drop old surrogate PK ─────────────────────────────────────────────────
ALTER TABLE "StockQuarterlyStats" DROP CONSTRAINT IF EXISTS "StockQuarterlyStats_pkey";

-- ── 2. Drop the unique index that covered the same columns ───────────────────
DROP INDEX IF EXISTS "StockQuarterlyStats_ticker_periodEnd_reportType_key";

-- ── 3. Remove the id column ──────────────────────────────────────────────────
ALTER TABLE "StockQuarterlyStats" DROP COLUMN IF EXISTS "id";

-- ── 4. Promote (ticker, periodEnd, reportType) to composite PK ───────────────
ALTER TABLE "StockQuarterlyStats"
  ADD CONSTRAINT "StockQuarterlyStats_pkey"
  PRIMARY KEY ("ticker", "periodEnd", "reportType");
