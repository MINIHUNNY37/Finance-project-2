#!/usr/bin/env python3
"""
scripts/seed_financials.py
──────────────────────────
Fetches quarterly financial data from Yahoo Finance via yahooquery and
populates the five fin_* tables in your Neon / Postgres database.

Table write order (FK-safe)
───────────────────────────
  1. fin_stock_info   PK: ticker                   (no FK dependencies)
  2. fin_time         PK: reported_at              (event anchor)
  3. fin_valuation    PK: (ticker, reported_at)    FK → fin_time
  4. fin_quality      PK: (ticker, reported_at)    FK → fin_time
  5. fin_risk         PK: (ticker, reported_at)    FK → fin_time

Usage
─────
  python scripts/seed_financials.py                        # all tickers
  python scripts/seed_financials.py --ticker AAPL          # single ticker (test)
  python scripts/seed_financials.py --offset 50 --limit 50 # paginated
  python scripts/seed_financials.py --dry-run              # fetch only, no DB writes
  python scripts/seed_financials.py --batch-size 5         # smaller batches if rate-limited

Requirements
────────────
  pip install -r scripts/requirements.txt

Environment
───────────
  Reads DATABASE_URL from .env.local (or --env <path>).
  DATABASE_URL must be a Postgres connection string, e.g.:
    postgresql://user:pass@host/dbname?sslmode=require
"""

from __future__ import annotations

import argparse
import csv
import math
import os
import sys
import time
from datetime import timezone
from pathlib import Path
from typing import Optional

import pandas as pd
import psycopg2
from dotenv import load_dotenv
from tqdm import tqdm
from yahooquery import Ticker

# ── Tunables ──────────────────────────────────────────────────────────────────

BATCH_DEFAULT  = 10    # tickers per yahooquery call (sweet spot: 5-15)
DELAY_DEFAULT  = 0.5   # seconds between batches (be polite to Yahoo)
DATE_TOLERANCE = 5     # days — match income/balance/cashflow rows by date ±N days
YOY_TOLERANCE  = 46    # days — find same quarter from prior year within ±N days
MAX_RETRIES    = 3     # API retry attempts per batch

# ── Math helpers ──────────────────────────────────────────────────────────────

def safe_float(v) -> Optional[float]:
    """Convert any pandas/numpy scalar to a Python float, or None if not finite."""
    if v is None:
        return None
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def safe_ratio(a, b) -> Optional[float]:
    """a / b, returns None if either is None or b is zero."""
    a, b = safe_float(a), safe_float(b)
    if a is None or b is None or b == 0:
        return None
    return a / b


def pct(a, b) -> Optional[float]:
    """(a / b) × 100, or None."""
    r = safe_ratio(a, b)
    return r * 100.0 if r is not None else None


# ── DataFrame helpers ─────────────────────────────────────────────────────────

def filter_ticker(df, ticker: str) -> pd.DataFrame:
    """
    Extract rows for a single ticker from a multi-ticker yahooquery DataFrame.

    yahooquery may return:
      - A DataFrame with 'symbol' as a plain column
      - A DataFrame with a MultiIndex of (symbol, asOfDate)
      - A plain string (error message) when no data is available
    All cases are handled safely.
    """
    if df is None or isinstance(df, str) or not isinstance(df, pd.DataFrame) or df.empty:
        return pd.DataFrame()

    # Flatten any MultiIndex so we always work with plain columns
    df = df.reset_index()

    if "symbol" in df.columns:
        sub = df[df["symbol"] == ticker].copy()
    else:
        # Single-ticker call or unexpected format — return as-is
        sub = df.copy()

    # Normalise asOfDate to timezone-naive datetime (psycopg2 handles UTC separately)
    if "asOfDate" in sub.columns:
        sub["asOfDate"] = pd.to_datetime(sub["asOfDate"], errors="coerce", utc=True)
        sub = sub.dropna(subset=["asOfDate"])

    return sub.reset_index(drop=True)


def closest_row(df: pd.DataFrame, target: pd.Timestamp, max_days: int) -> Optional[pd.Series]:
    """
    Return the DataFrame row whose asOfDate is closest to *target* within
    *max_days* tolerance, or None if no match exists.
    """
    if df is None or df.empty or "asOfDate" not in df.columns:
        return None

    # Make target timezone-aware to match the normalised column
    if target.tzinfo is None:
        target = target.tz_localize("UTC")

    tolerance = pd.Timedelta(days=max_days)
    deltas    = (df["asOfDate"] - target).abs()
    idx       = deltas.idxmin()

    return df.loc[idx] if deltas[idx] <= tolerance else None


def closest_revenue(rev_by_date: dict[pd.Timestamp, float],
                    target: pd.Timestamp,
                    max_days: int = YOY_TOLERANCE) -> Optional[float]:
    """Find a revenue value whose date is closest to *target* within *max_days*."""
    best_val   = None
    best_delta = pd.Timedelta(days=max_days)

    for dt, rev in rev_by_date.items():
        delta = abs(dt - target)
        if delta < best_delta:
            best_delta = delta
            best_val   = rev

    return best_val


# ── Quarter label ─────────────────────────────────────────────────────────────

def quarter_label(as_of: pd.Timestamp) -> str:
    """Return a human-readable event key like 'Q1_2024'."""
    m = as_of.month
    q = "Q1" if m <= 3 else "Q2" if m <= 6 else "Q3" if m <= 9 else "Q4"
    return f"{q}_{as_of.year}"


# ── Core transform ────────────────────────────────────────────────────────────

def build_quarters(
    ticker: str,
    inc: pd.DataFrame,
    bal: pd.DataFrame,
    cf:  pd.DataFrame,
    fd:  dict,
) -> list[dict]:
    """
    Combine yahooquery DataFrames + financial_data dict into a list of
    quarter-metric dicts ready to upsert into the fin_* tables.

    One dict per quarterly row found in the income statement.
    Metrics that are price-dependent (PE, PB, FCF yield, shareholder yield)
    are only populated for the most-recent quarter — historical prices are
    not available from this data source.
    """
    if inc.empty:
        return []

    # ── Current-price snapshot values (from financial_data) ──────────────────
    market_cap    = safe_float(fd.get("marketCap"))
    trailing_pe   = safe_float(fd.get("trailingPE"))
    price_to_book = safe_float(fd.get("priceToBook"))
    ev            = safe_float(fd.get("enterpriseValue"))
    ttm_fcf       = safe_float(fd.get("freeCashflow"))
    ttm_ebitda    = safe_float(fd.get("ebitda"))

    # ── Sort oldest → newest for correct YoY revenue look-back ───────────────
    inc = inc.sort_values("asOfDate").reset_index(drop=True)

    # Pre-build revenue history for YoY growth computation
    rev_history: dict[pd.Timestamp, float] = {}
    for _, row in inc.iterrows():
        rv = safe_float(row.get("TotalRevenue"))
        if rv is not None:
            rev_history[row["asOfDate"]] = rv

    quarters: list[dict] = []
    n = len(inc)

    for i, inc_row in inc.iterrows():
        is_latest = (i == n - 1)                    # newest quarter in the batch
        as_of     = inc_row["asOfDate"]             # pd.Timestamp, UTC-aware

        # Match balance sheet and cash-flow rows by nearest date
        bal_row = closest_row(bal, as_of, DATE_TOLERANCE)
        cf_row  = closest_row(cf,  as_of, DATE_TOLERANCE)

        # ── Income statement ──────────────────────────────────────────────────
        revenue    = safe_float(inc_row.get("TotalRevenue"))
        net_income = (safe_float(inc_row.get("NetIncome"))
                      or safe_float(inc_row.get("NetIncomeCommonStockholders")))
        op_income  = (safe_float(inc_row.get("OperatingIncome"))
                      or safe_float(inc_row.get("EBIT")))
        # InterestExpense is reported as a negative number by yahooquery
        int_raw    = safe_float(inc_row.get("InterestExpense"))
        int_exp    = abs(int_raw) if int_raw is not None else None

        # ── Balance sheet ─────────────────────────────────────────────────────
        def bal_get(col: str) -> Optional[float]:
            return safe_float(bal_row.get(col)) if bal_row is not None else None

        equity     = bal_get("StockholdersEquity")
        long_debt  = (bal_get("LongTermDebt")
                      or bal_get("LongTermDebtAndCapitalLeaseObligation"))
        short_debt = bal_get("CurrentDebtAndCapitalLeaseObligation")
        cash_eq    = bal_get("CashAndCashEquivalents")
        st_invest  = bal_get("OtherShortTermInvestments")

        # Aggregate cash and total debt (treat None as 0 only when at least
        # one component is known)
        cash = None
        if cash_eq is not None or st_invest is not None:
            cash = (cash_eq or 0.0) + (st_invest or 0.0)

        total_debt = None
        if long_debt is not None or short_debt is not None:
            total_debt = (long_debt or 0.0) + (short_debt or 0.0)

        # ── Cash flow ─────────────────────────────────────────────────────────
        def cf_get(col: str) -> Optional[float]:
            return safe_float(cf_row.get(col)) if cf_row is not None else None

        cfo      = cf_get("OperatingCashFlow")
        capex_r  = cf_get("CapitalExpenditure")      # negative
        divs_r   = cf_get("CashDividendsPaid")        # negative
        buybk_r  = cf_get("RepurchaseOfCapitalStock") # negative

        capex    = abs(capex_r)  if capex_r  is not None else None
        divs     = abs(divs_r)   if divs_r   is not None else 0.0
        buybacks = abs(buybk_r)  if buybk_r  is not None else 0.0

        fcf = (cfo - (capex or 0.0)) if cfo is not None else None

        # ── fin_valuation ─────────────────────────────────────────────────────
        # P/E and P/B are price-dependent; only meaningful for the current quarter
        per       = trailing_pe   if (is_latest and trailing_pe)   else None
        pbr       = price_to_book if (is_latest and price_to_book) else None
        # EV/EBIT can be computed historically (EV is current but better than nothing)
        ev_ebit   = safe_ratio(ev, op_income)
        # FCF yield uses TTM FCF from financial_data — latest quarter only
        fcf_yield = pct(ttm_fcf, market_cap) if (is_latest and market_cap and ttm_fcf) else None

        # ── fin_quality ───────────────────────────────────────────────────────
        # YoY revenue growth: find matching quarter ~1 year earlier
        rev_growth = None
        if revenue is not None:
            one_yr_ago = as_of - pd.DateOffset(years=1)
            prior_rev  = closest_revenue(rev_history, one_yr_ago)
            if prior_rev:
                rev_growth = pct(revenue - prior_rev, abs(prior_rev))

        op_margin = pct(op_income, revenue)
        roe       = pct(net_income, equity)

        # ROIC = operating income / invested capital
        # Invested capital = total debt + equity − cash
        roic = None
        if total_debt is not None and equity is not None:
            inv_cap = total_debt + equity - (cash or 0.0)
            if inv_cap > 0:
                roic = pct(op_income, inv_cap)

        cfo_ni = safe_ratio(cfo, net_income)

        # ── fin_risk ──────────────────────────────────────────────────────────
        # Net debt/EBITDA: use TTM EBITDA for the latest quarter; fall back to
        # operating income (EBIT) for historical quarters (understates slightly)
        ebitda_row      = ttm_ebitda if is_latest else op_income
        net_debt        = ((total_debt or 0.0) - (cash or 0.0)) if total_debt is not None else None
        net_debt_ebitda = safe_ratio(net_debt, ebitda_row)
        int_cov         = safe_ratio(op_income, int_exp)
        cash_short      = safe_ratio(cash, short_debt)

        # Shareholder yield = (dividends + buybacks) / market cap — latest only
        sh_yield = None
        if is_latest and market_cap and (divs or buybacks):
            sh_yield = pct(divs + buybacks, market_cap)

        quarters.append({
            # Anchor
            "reported_at":       as_of.to_pydatetime().replace(tzinfo=timezone.utc),
            "event_type":        quarter_label(as_of),
            # fin_valuation
            "per":               per,
            "pbr":               pbr,
            "ev_ebit":           ev_ebit,
            "fcf_yield":         fcf_yield,
            # fin_quality
            "revenue_growth":    rev_growth,
            "operating_margin":  op_margin,
            "roe":               roe,
            "roic":              roic,
            "cfo_net_income":    cfo_ni,
            # fin_risk
            "fcf":               fcf,
            "net_debt_ebitda":   net_debt_ebitda,
            "interest_coverage": int_cov,
            "cash_short_debt":   cash_short,
            "shareholder_yield": sh_yield,
        })

    return quarters


# ── yahooquery fetch layer ────────────────────────────────────────────────────

def fetch_batch(tickers: list[str]) -> dict[str, list[dict] | None]:
    """
    Fetch income statement, balance sheet, cash flow, and financial_data
    for a batch of tickers via yahooquery.

    Returns a dict mapping each ticker to its quarter list, or None on failure.
    """
    t = Ticker(tickers, asynchronous=False, timeout=30)

    income_df   = t.income_statement(frequency="q")
    balance_df  = t.balance_sheet(frequency="q")
    cashflow_df = t.cash_flow(frequency="q")
    fin_data    = t.financial_data  # dict[ticker -> dict | str]

    results: dict[str, list[dict] | None] = {}
    errors:  dict[str, str] = {}

    # Capture raw Yahoo responses for the first ticker to aid debugging
    _debug_sample = tickers[0] if tickers else None
    if _debug_sample:
        raw_fd = fin_data.get(_debug_sample)
        if isinstance(raw_fd, str):
            print(f"\n[DEBUG] Yahoo financial_data for {_debug_sample}: {raw_fd!r}", flush=True)
        raw_inc = income_df if isinstance(income_df, str) else None
        if raw_inc:
            print(f"[DEBUG] income_statement response: {raw_inc!r}", flush=True)

    for ticker in tickers:
        try:
            inc = filter_ticker(income_df,   ticker)
            bal = filter_ticker(balance_df,  ticker)
            cf  = filter_ticker(cashflow_df, ticker)
            fd  = fin_data.get(ticker, {})

            # yahooquery returns a string like "No fundamentals data found..."
            # when a ticker is invalid or has no financial filings (e.g. ETFs)
            if isinstance(fd, str):
                errors[ticker] = f"financial_data error: {fd}"
                results[ticker] = None
                continue

            if not isinstance(fd, dict):
                fd = {}

            if inc.empty:
                errors[ticker] = "income_statement returned empty (ETF, delisted, or Yahoo API error)"
                results[ticker] = None
                continue

            quarters = build_quarters(ticker, inc, bal, cf, fd)
            results[ticker] = quarters or None
            if not quarters:
                errors[ticker] = "build_quarters returned no rows"

        except Exception as exc:
            errors[ticker] = f"exception: {exc}"
            results[ticker] = None

    # Surface unique error reasons so caller can log them
    results["__errors__"] = errors  # type: ignore[assignment]
    return results


# ── Database helpers ──────────────────────────────────────────────────────────

def make_conn(db_url: str):
    return psycopg2.connect(db_url, connect_timeout=10)


def ensure_alive(conn, db_url: str):
    """Ping the connection; reconnect if it has gone idle (Neon auto-suspends)."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return conn
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
        return make_conn(db_url)


def upsert_stock_info(cur, ticker: str, name: str, exchange: str, sector):
    cur.execute(
        """
        INSERT INTO "fin_stock_info" (ticker, company_name, exchange, sector)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (ticker) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            exchange     = EXCLUDED.exchange,
            sector       = EXCLUDED.sector
        """,
        (ticker, name or ticker, exchange or "", sector),
    )


def upsert_time(cur, reported_at, event_type: str):
    cur.execute(
        """
        INSERT INTO "fin_time" (reported_at, event_type)
        VALUES (%s, %s)
        ON CONFLICT (reported_at) DO UPDATE SET event_type = EXCLUDED.event_type
        """,
        (reported_at, event_type),
    )


def upsert_valuation(cur, ticker: str, q: dict):
    cur.execute(
        """
        INSERT INTO "fin_valuation"
            (ticker, reported_at, per, pbr, ev_ebit, fcf_yield, valuation_percentile)
        VALUES (%s, %s, %s, %s, %s, %s, NULL)
        ON CONFLICT (ticker, reported_at) DO UPDATE SET
            per                  = EXCLUDED.per,
            pbr                  = EXCLUDED.pbr,
            ev_ebit              = EXCLUDED.ev_ebit,
            fcf_yield            = EXCLUDED.fcf_yield,
            valuation_percentile = EXCLUDED.valuation_percentile
        """,
        (ticker, q["reported_at"], q["per"], q["pbr"], q["ev_ebit"], q["fcf_yield"]),
    )


def upsert_quality(cur, ticker: str, q: dict):
    cur.execute(
        """
        INSERT INTO "fin_quality"
            (ticker, reported_at, revenue_growth, operating_margin, roe, roic, cfo_net_income)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (ticker, reported_at) DO UPDATE SET
            revenue_growth   = EXCLUDED.revenue_growth,
            operating_margin = EXCLUDED.operating_margin,
            roe              = EXCLUDED.roe,
            roic             = EXCLUDED.roic,
            cfo_net_income   = EXCLUDED.cfo_net_income
        """,
        (
            ticker, q["reported_at"], q["revenue_growth"], q["operating_margin"],
            q["roe"], q["roic"], q["cfo_net_income"],
        ),
    )


def upsert_risk(cur, ticker: str, q: dict):
    cur.execute(
        """
        INSERT INTO "fin_risk"
            (ticker, reported_at, fcf, net_debt_ebitda,
             interest_coverage, cash_short_debt, shareholder_yield)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (ticker, reported_at) DO UPDATE SET
            fcf               = EXCLUDED.fcf,
            net_debt_ebitda   = EXCLUDED.net_debt_ebitda,
            interest_coverage = EXCLUDED.interest_coverage,
            cash_short_debt   = EXCLUDED.cash_short_debt,
            shareholder_yield = EXCLUDED.shareholder_yield
        """,
        (
            ticker, q["reported_at"], q["fcf"], q["net_debt_ebitda"],
            q["interest_coverage"], q["cash_short_debt"], q["shareholder_yield"],
        ),
    )


def write_ticker(
    conn,
    ticker: str,
    name: str,
    exchange: str,
    sector,
    quarters: list[dict],
    dry_run: bool,
) -> int:
    """Upsert all rows for one ticker in FK-safe order. Returns quarters written."""
    if dry_run:
        return len(quarters)

    with conn.cursor() as cur:
        # 1. Stock master row (no FK dependencies)
        upsert_stock_info(cur, ticker, name, exchange, sector)

        # 2. For each quarter: time anchor first, then the three fact tables
        for q in quarters:
            upsert_time(cur, q["reported_at"], q["event_type"])
            upsert_valuation(cur, ticker, q)
            upsert_quality(cur, ticker, q)
            upsert_risk(cur, ticker, q)

    conn.commit()
    return len(quarters)


# ── CLI + main loop ───────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Seed fin_* tables from yahooquery",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--ticker",     metavar="SYM",  default=None,  help="Single ticker (for testing)")
    p.add_argument("--offset",     metavar="N",    type=int, default=0,             help="Skip first N tickers")
    p.add_argument("--limit",      metavar="N",    type=int, default=0,             help="Process at most N tickers (0 = all)")
    p.add_argument("--batch-size", metavar="N",    type=int, default=BATCH_DEFAULT, help="Tickers per API call (default: 10)")
    p.add_argument("--delay",      metavar="SECS", type=float, default=DELAY_DEFAULT, help="Pause between batches (default: 0.5s)")
    p.add_argument("--dry-run",    action="store_true", help="Fetch data but do not write to the database")
    p.add_argument("--env",        metavar="FILE", default=".env.local", help="Path to .env file (default: .env.local)")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    # Load DATABASE_URL from env file
    env_path = Path(args.env)
    load_dotenv(env_path if env_path.exists() else Path(".env"))

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set. Check your .env.local file.", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print("DRY RUN — no data will be written to the database.\n")

    # ── Connect and read tickers from StockUniverse ───────────────────────────
    conn = make_conn(db_url)

    with conn.cursor() as cur:
        if args.ticker:
            cur.execute(
                'SELECT ticker, name, exchange, sector FROM "StockUniverse" WHERE ticker = %s',
                (args.ticker,),
            )
        else:
            parts = ['SELECT ticker, name, exchange, sector FROM "StockUniverse" ORDER BY ticker']
            if args.limit  > 0: parts.append(f"LIMIT {args.limit}")
            if args.offset > 0: parts.append(f"OFFSET {args.offset}")
            cur.execute(" ".join(parts))
        stocks = cur.fetchall()

    if not stocks:
        print("No tickers found in StockUniverse.")
        conn.close()
        return

    total = len(stocks)
    print(f"Loaded {total} ticker{'s' if total != 1 else ''} from StockUniverse.")
    if args.offset:
        print(f"Starting at offset {args.offset}.")

    # ── Batch processing ──────────────────────────────────────────────────────
    batch_size = max(1, min(args.batch_size, 20))
    batches    = [stocks[i : i + batch_size] for i in range(0, total, batch_size)]

    done           = 0
    failed         = 0
    total_quarters = 0
    error_log: list[dict] = []
    failed_csv = Path("scripts/failed_tickers.csv")

    with tqdm(total=total, unit="ticker", ncols=90) as bar:
        for batch_idx, batch in enumerate(batches):
            tickers_in_batch = [row[0] for row in batch]

            # Fetch with retry + exponential back-off
            batch_results: dict[str, list[dict] | None] = {}
            fetch_err: str | None = None

            for attempt in range(MAX_RETRIES):
                try:
                    batch_results = fetch_batch(tickers_in_batch)
                    fetch_err = None
                    break
                except Exception as exc:
                    fetch_err = str(exc)
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(2 ** attempt)   # 1s, 2s, 4s

            if fetch_err:
                # Entire batch failed — mark all as errors
                for row in batch:
                    error_log.append({"ticker": row[0], "reason": f"fetch error: {fetch_err}"})
                failed += len(batch)
                bar.update(len(batch))
                continue

            # Keep DB connection alive across potentially slow batches
            conn = ensure_alive(conn, db_url)

            # Extract per-ticker error detail captured in fetch_batch
            ticker_errors: dict[str, str] = batch_results.pop("__errors__", {})  # type: ignore[arg-type]

            # Write each ticker in the batch
            for row in batch:
                ticker, name, exchange, sector = row
                quarters = batch_results.get(ticker)

                if not quarters:
                    reason = ticker_errors.get(
                        ticker,
                        "ticker missing from fetch results" if ticker not in batch_results
                        else "yahooquery returned no data (ETF, foreign listing, or delisted?)"
                    )
                    error_log.append({"ticker": ticker, "reason": reason})
                    failed += 1
                    bar.set_postfix_str(f"{ticker} ✗")
                    bar.update(1)
                    continue

                try:
                    n = write_ticker(conn, ticker, name, exchange, sector, quarters, args.dry_run)
                    total_quarters += n
                    done += 1
                    bar.set_postfix_str(f"{ticker} {n}q ✓")
                except Exception as exc:
                    conn.rollback()
                    error_log.append({"ticker": ticker, "reason": f"db write error: {exc}"})
                    failed += 1
                    bar.set_postfix_str(f"{ticker} ✗")

                bar.update(1)

            # Pause between batches to avoid triggering Yahoo rate limits
            if args.delay > 0 and batch_idx < len(batches) - 1:
                time.sleep(args.delay)

    conn.close()

    # ── Write failed tickers log ──────────────────────────────────────────────
    if error_log:
        failed_csv.parent.mkdir(exist_ok=True)
        with open(failed_csv, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["ticker", "reason"])
            writer.writeheader()
            writer.writerows(error_log)

    # ── Final summary ─────────────────────────────────────────────────────────
    sep = "═" * 52
    print(f"\n{sep}")
    print(f"  Done:    {done:>4} tickers  |  {total_quarters:,} quarter-rows")
    print(f"  Failed:  {failed:>4} tickers  →  {failed_csv if error_log else '(none)'}")

    if not args.dry_run:
        try:
            c2 = make_conn(db_url)
            with c2.cursor() as cur:
                for tbl in ["fin_time", "fin_stock_info", "fin_valuation", "fin_quality", "fin_risk"]:
                    cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
                    print(f"  {tbl:<22}  {cur.fetchone()[0]:>6} rows")
            c2.close()
        except Exception as exc:
            print(f"  (could not read row counts: {exc})")

    print(sep)


if __name__ == "__main__":
    main()
