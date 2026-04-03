#!/bin/sh
# Baseline the two Prisma-model migrations that were previously applied by
# "prisma db push" so migrate deploy does not try to re-run them on a
# non-empty database. Migration 3 (fin_tables_add_time) is intentionally not
# baselined so migrate deploy can actually create the fin_* tables.

set -e

BASELINE_MIGRATIONS="
20260319000000_historical_data_expansion
20260323000000_quarterly_stats_composite_pk
"

for name in $BASELINE_MIGRATIONS; do
  echo "Baselining migration: $name"
  npx prisma migrate resolve --applied "$name" 2>&1 || true
done

echo "Running prisma migrate deploy (will run fin_tables_add_time if needed)..."
npx prisma migrate deploy
