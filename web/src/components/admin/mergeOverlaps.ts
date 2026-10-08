import { addDays } from '@/lib/dates'
import type { Stay } from '@/types/domain'

export interface StayOverlap {
  kept: Stay
  other: Stay
}

const NO_END = '9999-12-31'

/**
 * The days a stay occupies, like app.stay_range in the database: [entry, exit),
 * except that a stay ending the day it started occupies that day, and an open stay has no end.
 */
function rangeOf(stay: Stay): { start: string; end: string } {
  if (stay.exit_date === null) return { start: stay.entry_date, end: NO_END }
  const end = stay.exit_date === stay.entry_date ? addDays(stay.entry_date, 1) : stay.exit_date
  return { start: stay.entry_date, end }
}

/** Pairs of stays that would overlap if both records belonged to one person. */
export function findOverlaps(kept: Stay[], other: Stay[]): StayOverlap[] {
  return kept.flatMap((a) => {
    const rangeA = rangeOf(a)
    return other
      .filter((b) => {
        const rangeB = rangeOf(b)
        return rangeA.start < rangeB.end && rangeB.start < rangeA.end
      })
      .map((b) => ({ kept: a, other: b }))
  })
}

/** "01/09/2026 a 10/09/2026", or "desde 05/09/2026, abierta" for a stay that has not ended. */
export function stayRangeLabel(
  stay: Stay,
  formatDate: (value: string) => string,
  t: (key: string, named: Record<string, unknown>) => string,
): string {
  return stay.exit_date
    ? t('admin.merge.range', { from: formatDate(stay.entry_date), to: formatDate(stay.exit_date) })
    : t('admin.merge.openRange', { from: formatDate(stay.entry_date) })
}
