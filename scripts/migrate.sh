#!/bin/sh
# Baseline the two Prisma-model migrations that were previously applied by
# "prisma db push" (so migrate deploy doesn't try to re-run them on a
# non-empty DB).  Migration 3 (fin_tables_add_time) is intentionally NOT
# baselined — we let migrate deploy actually run it so the fin_* tables are
# created.  All statements in migration 3 use IF NOT EXISTS / IF EXISTS, so
# it is safe to run against a DB that already has those tables.

set -e

BASELINE_MIGRATIONS="
20260319000000_historical_data_expansion
20260323000000_quarterly_stats_composite_pk
"

for name in $BASELINE_MIGRATIONS; do
  echo "Baselining migration: $name"
  npx prisma migrate resolve --applied "$name" 2>&1 || true
done

echo "Running prisma migrate deploy (will run fin_tables_add_time if not yet applied)..."
npx prisma migrate deploy
