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
