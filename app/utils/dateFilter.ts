import type { EntityStatistic } from '../types';

/**
 * Returns true if the item's date is visible given the global view date.
 * Rules:
 *  - If no viewDate set: always show (no filter)
 *  - If item has no date: always show (undated data is always visible)
 *  - If item date <= viewDate: show (data existed at or before the viewed date)
 *  - If item date > viewDate: hide (data is "in the future" relative to viewed date)
 */
export function isVisibleAtDate(itemDate: string | undefined, viewDate: string | null): boolean {
  if (!viewDate) return true;          // no global filter — show everything
  if (!itemDate) return true;          // undated items always visible
  return itemDate <= viewDate;         // ISO string compare works lexicographically
}

/**
 * Given an array of statistics, returns only the most recent entry per label name.
 * Steps:
 *  1. Filter to entries visible at viewDate
 *  2. Group by stat.name
 *  3. For each group pick the entry with the latest asOf
 *     (dated entries beat undated; among dated ones the lexicographically largest wins)
 */
export function getLatestStatsByLabel(
  stats: EntityStatistic[],
  viewDate: string | null,
): EntityStatistic[] {
  const visible = stats.filter((s) => isVisibleAtDate(s.asOf, viewDate));

  const groups = new Map<string, EntityStatistic[]>();
  for (const s of visible) {
    if (!groups.has(s.name)) groups.set(s.name, []);
    groups.get(s.name)!.push(s);
  }

  const result: EntityStatistic[] = [];
  for (const [, group] of groups) {
    // Sort: dated entries descending, then undated
    const sorted = [...group].sort((a, b) => {
      if (a.asOf && b.asOf) return b.asOf.localeCompare(a.asOf);
      if (a.asOf) return -1;  // a has date → higher priority
      if (b.asOf) return 1;
      return 0;
    });
    result.push(sorted[0]);
  }

  return result;
}
