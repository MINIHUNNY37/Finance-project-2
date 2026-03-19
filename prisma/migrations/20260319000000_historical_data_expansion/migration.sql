-- Migration: historical_data_expansion
-- Replaces StockKeyStats (single-row snapshot) with StockQuarterlyStats (full history).
-- Upgrades StockDailyOHLC to composite PK + adjClose.
-- Adds StockDividend, StockSplit, StockFetchProgress.

-- ── 1. Drop old single-row stats table ──────────────────────────────────────
DROP TABLE IF EXISTS "StockKeyStats";

-- ── 2. Upgrade StockDailyOHLC ────────────────────────────────────────────────
-- Add adjClose column
ALTER TABLE "StockDailyOHLC" ADD COLUMN IF NOT EXISTS "adjClose" DOUBLE PRECISION;

-- Drop old surrogate PK and unique constraint, promote (ticker, date) to PK
ALTER TABLE "StockDailyOHLC" DROP CONSTRAINT IF EXISTS "StockDailyOHLC_pkey";
ALTER TABLE "StockDailyOHLC" DROP CONSTRAINT IF EXISTS "StockDailyOHLC_ticker_date_key";
DROP INDEX IF EXISTS "StockDailyOHLC_ticker_date_idx";

ALTER TABLE "StockDailyOHLC" DROP COLUMN IF EXISTS "id";
ALTER TABLE "StockDailyOHLC" ADD PRIMARY KEY ("ticker", "date");
CREATE INDEX "StockDailyOHLC_ticker_date_idx" ON "StockDailyOHLC" ("ticker", "date" DESC);

-- ── 3. Create StockQuarterlyStats ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StockQuarterlyStats" (
    "id"             TEXT NOT NULL,
    "ticker"         TEXT NOT NULL,
    "periodEnd"      DATE NOT NULL,
    "reportType"     TEXT NOT NULL,

    -- price snapshot
    "price"          DOUBLE PRECISION,
    "priceChange"    DOUBLE PRECISION,
    "priceChangePct" DOUBLE PRECISION,
    "week52High"     DOUBLE PRECISION,
    "week52Low"      DOUBLE PRECISION,

    -- valuation
    "marketCap"      DOUBLE PRECISION,
    "marketCapFmt"   TEXT,
    "peRatio"        DOUBLE PRECISION,
    "priceToBook"    DOUBLE PRECISION,

    -- income statement
    "revenue"        DOUBLE PRECISION,
    "netIncome"      DOUBLE PRECISION,
    "eps"            DOUBLE PRECISION,
    "epsEstimate"    DOUBLE PRECISION,
    "epsSurprisePct" DOUBLE PRECISION,

    -- balance sheet
    "bookValue"      DOUBLE PRECISION,
    "debtToEquity"   DOUBLE PRECISION,
    "currentRatio"   DOUBLE PRECISION,

    -- cash flow
    "freeCashFlow"       DOUBLE PRECISION,
    "operatingCashFlow"  DOUBLE PRECISION,

    -- returns / yield
    "operatingMargin" DOUBLE PRECISION,
    "dividendYield"   DOUBLE PRECISION,

    "reportedAt" TIMESTAMPTZ,
    "fetchedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "StockQuarterlyStats_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockQuarterlyStats"
    ADD CONSTRAINT "StockQuarterlyStats_ticker_fkey"
    FOREIGN KEY ("ticker") REFERENCES "StockUniverse"("ticker") ON DELETE CASCADE;

CREATE UNIQUE INDEX "StockQuarterlyStats_ticker_periodEnd_reportType_key"
    ON "StockQuarterlyStats" ("ticker", "periodEnd", "reportType");

CREATE INDEX "StockQuarterlyStats_ticker_periodEnd_idx"
    ON "StockQuarterlyStats" ("ticker", "periodEnd" DESC);

-- ── 4. Create StockDividend ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StockDividend" (
    "ticker"    TEXT NOT NULL,
    "exDate"    DATE NOT NULL,
    "payDate"   DATE,
    "amount"    DOUBLE PRECISION NOT NULL,
    "frequency" TEXT,

    CONSTRAINT "StockDividend_pkey" PRIMARY KEY ("ticker", "exDate")
);

ALTER TABLE "StockDividend"
    ADD CONSTRAINT "StockDividend_ticker_fkey"
    FOREIGN KEY ("ticker") REFERENCES "StockUniverse"("ticker") ON DELETE CASCADE;

CREATE INDEX "StockDividend_ticker_exDate_idx"
    ON "StockDividend" ("ticker", "exDate" DESC);

-- ── 5. Create StockSplit ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StockSplit" (
    "ticker" TEXT NOT NULL,
    "date"   DATE NOT NULL,
    "ratio"  DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StockSplit_pkey" PRIMARY KEY ("ticker", "date")
);

ALTER TABLE "StockSplit"
    ADD CONSTRAINT "StockSplit_ticker_fkey"
    FOREIGN KEY ("ticker") REFERENCES "StockUniverse"("ticker") ON DELETE CASCADE;

-- ── 6. Create StockFetchProgress ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StockFetchProgress" (
    "ticker"        TEXT NOT NULL,
    "dataType"      TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "lastFetchedAt" TIMESTAMPTZ,
    "errorMessage"  TEXT,

    CONSTRAINT "StockFetchProgress_pkey" PRIMARY KEY ("ticker", "dataType")
);

CREATE INDEX "StockFetchProgress_dataType_status_idx"
    ON "StockFetchProgress" ("dataType", "status");
