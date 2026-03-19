-- CreateTable
CREATE TABLE IF NOT EXISTS "StockUniverse" (
    "id"          TEXT        NOT NULL,
    "ticker"      TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "exchange"    TEXT        NOT NULL,
    "sector"      TEXT,
    "industry"    TEXT,
    "country"     TEXT        NOT NULL DEFAULT 'US',
    "isNasdaq100" BOOLEAN     NOT NULL DEFAULT false,
    "isSP500"     BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockUniverse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockDailyOHLC" (
    "id"     TEXT             NOT NULL,
    "ticker" TEXT             NOT NULL,
    "date"   DATE             NOT NULL,
    "open"   DOUBLE PRECISION NOT NULL,
    "high"   DOUBLE PRECISION NOT NULL,
    "low"    DOUBLE PRECISION NOT NULL,
    "close"  DOUBLE PRECISION NOT NULL,
    "volume" BIGINT           NOT NULL DEFAULT 0,

    CONSTRAINT "StockDailyOHLC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StockKeyStats" (
    "id"             TEXT             NOT NULL,
    "ticker"         TEXT             NOT NULL,
    "price"          DOUBLE PRECISION,
    "priceChange"    DOUBLE PRECISION,
    "priceChangePct" DOUBLE PRECISION,
    "marketCap"      TEXT,
    "peRatio"        TEXT,
    "eps"            TEXT,
    "dividendYield"  TEXT,
    "week52High"     DOUBLE PRECISION,
    "week52Low"      DOUBLE PRECISION,
    "fetchedAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockKeyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TemplateMap" (
    "id"          TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "description" TEXT         NOT NULL,
    "category"    TEXT         NOT NULL,
    "data"        TEXT         NOT NULL,
    "isActive"    BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StockUniverse_ticker_key"       ON "StockUniverse"("ticker");
CREATE UNIQUE INDEX IF NOT EXISTS "StockDailyOHLC_ticker_date_key" ON "StockDailyOHLC"("ticker", "date");
CREATE INDEX        IF NOT EXISTS "StockDailyOHLC_ticker_date_idx" ON "StockDailyOHLC"("ticker", "date" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "StockKeyStats_ticker_key"       ON "StockKeyStats"("ticker");

-- AddForeignKey (safe: only if not already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockDailyOHLC_ticker_fkey'
  ) THEN
    ALTER TABLE "StockDailyOHLC"
      ADD CONSTRAINT "StockDailyOHLC_ticker_fkey"
      FOREIGN KEY ("ticker") REFERENCES "StockUniverse"("ticker")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockKeyStats_ticker_fkey'
  ) THEN
    ALTER TABLE "StockKeyStats"
      ADD CONSTRAINT "StockKeyStats_ticker_fkey"
      FOREIGN KEY ("ticker") REFERENCES "StockUniverse"("ticker")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
