#!/bin/sh
# Baseline existing migrations (no-op if already applied), then deploy new ones.
# This handles the transition from "prisma db push" to "prisma migrate deploy".

set -e

MIGRATIONS="
20260319000000_historical_data_expansion
20260323000000_quarterly_stats_composite_pk
20260323100000_fin_tables_add_time
"

for name in $MIGRATIONS; do
  echo "Baselining migration: $name"
  npx prisma migrate resolve --applied "$name" 2>&1 | grep -v "already been applied" || true
done

echo "Running prisma migrate deploy..."
npx prisma migrate deploy
