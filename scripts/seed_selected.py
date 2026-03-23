#!/usr/bin/env python3
"""
scripts/seed_selected.py
────────────────────────
Ensures specific tickers are present in StockUniverse, then seeds the five
fin_* tables for each one via yahooquery.

Use this when you want to add a handful of tickers without running
seed-markets (the full S&P500/NASDAQ-100 bootstrap) first.

Usage
─────
  python scripts/seed_selected.py --tickers AAPL MSFT GOOGL NVDA TSLA AMZN META
  python scripts/seed_selected.py --tickers AAPL --dry-run

Requirements
────────────
  Same as seed_financials.py (pip install -r scripts/requirements.txt)

Environment
───────────
  Reads DATABASE_URL from .env.local (or --env <path>).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Re-use all helpers from seed_financials so there is no logic duplication
sys.path.insert(0, str(Path(__file__).parent))
from seed_financials import (  # noqa: E402
    make_conn,
    ensure_alive,
    fetch_batch,
    write_ticker,
)

from dotenv import load_dotenv
from yahooquery import Ticker


# ── Yahoo info fetch ──────────────────────────────────────────────────────────

def get_basic_info(symbol: str) -> tuple[str, str, str | None]:
    """
    Fetch company name, exchange, and sector for *symbol* from Yahoo Finance.
    Falls back to symbol itself if the request fails.
    """
    try:
        t = Ticker(symbol, asynchronous=False, timeout=15)
        qtype = t.quote_type.get(symbol, {})
        if isinstance(qtype, str):
            qtype = {}
        profile = t.asset_profile.get(symbol, {})
        if isinstance(profile, str):
            profile = {}

        name     = qtype.get("longName") or qtype.get("shortName") or symbol
        exchange = qtype.get("fullExchangeName") or qtype.get("exchange") or ""
        sector   = profile.get("sector")
        return str(name), str(exchange), sector
    except Exception:
        return symbol, "", None


# ── StockUniverse upsert ──────────────────────────────────────────────────────

def upsert_stock_universe(
    cur,
    ticker: str,
    name: str,
    exchange: str,
    sector: str | None,
) -> None:
    """
    Insert or update a row in StockUniverse.
    Uses ON CONFLICT so it is safe to run repeatedly.
    The id column has a default (cuid) so we omit it.
    """
    cur.execute(
        """
        INSERT INTO "StockUniverse"
            (ticker, name, exchange, sector, country, "isNasdaq100", "isSP500",
             "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, 'US', false, false, NOW(), NOW())
        ON CONFLICT (ticker) DO UPDATE SET
            name      = EXCLUDED.name,
            exchange  = EXCLUDED.exchange,
            sector    = EXCLUDED.sector,
            "updatedAt" = NOW()
        """,
        (ticker, name or ticker, exchange or "", sector),
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Ensure tickers in StockUniverse and seed fin_* tables",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--tickers", nargs="+", required=True, metavar="SYM",
        help="Space-separated ticker symbols, e.g. AAPL MSFT GOOGL",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Fetch and print data but do not write to the database",
    )
    p.add_argument(
        "--env", metavar="FILE", default=".env.local",
        help="Path to .env file (default: .env.local)",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    env_path = Path(args.env)
    load_dotenv(env_path if env_path.exists() else Path(".env"))

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set. Check your .env.local file.", file=sys.stderr)
        sys.exit(1)

    tickers = [s.upper() for s in args.tickers]

    if args.dry_run:
        print("DRY RUN — no data will be written to the database.\n")

    print(f"Targets ({len(tickers)}): {', '.join(tickers)}\n")

    conn = make_conn(db_url)

    # ── Step 1: Ensure each ticker exists in StockUniverse ────────────────────
    print("Step 1 — Upserting tickers into StockUniverse ...")
    info_map: dict[str, tuple[str, str, str | None]] = {}

    for sym in tickers:
        print(f"  {sym}: fetching info from Yahoo ...", end=" ", flush=True)
        name, exchange, sector = get_basic_info(sym)
        info_map[sym] = (name, exchange, sector)

        if not args.dry_run:
            with conn.cursor() as cur:
                upsert_stock_universe(cur, sym, name, exchange, sector)
            conn.commit()

        print(f"✓  {name!r}  ({exchange or '?'}  |  {sector or '—'})")

    # ── Step 2: Fetch and write fin_* tables ─────────────────────────────────
    print("\nStep 2 — Fetching quarterly financials and writing fin_* tables ...")

    # Fetch all target tickers in a single yahooquery batch call
    conn = ensure_alive(conn, db_url)
    batch_results = fetch_batch(tickers)
    ticker_errors: dict[str, str] = batch_results.pop("__errors__", {})  # type: ignore[arg-type]

    done           = 0
    failed         = 0
    total_quarters = 0

    for sym in tickers:
        quarters = batch_results.get(sym)

        if not quarters:
            reason = ticker_errors.get(sym, "no data returned by yahooquery")
            print(f"  {sym}: FAILED — {reason}")
            failed += 1
            continue

        name, exchange, sector = info_map[sym]

        try:
            n = write_ticker(conn, sym, name, exchange, sector, quarters, args.dry_run)
            total_quarters += n
            done += 1
            print(f"  {sym}: ✓  {n} quarter-rows")
        except Exception as exc:
            conn.rollback()
            print(f"  {sym}: FAILED (db write) — {exc}")
            failed += 1

    conn.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    sep = "═" * 52
    print(f"\n{sep}")
    print(f"  Done:    {done:>4} / {len(tickers)} tickers  |  {total_quarters:,} quarter-rows")
    if failed:
        print(f"  Failed:  {failed:>4} ticker(s)")
    print(sep)


if __name__ == "__main__":
    main()
