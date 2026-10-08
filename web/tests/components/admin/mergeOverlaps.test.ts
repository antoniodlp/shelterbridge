import { describe, expect, it } from 'vitest'
import { findOverlaps, stayRangeLabel } from '@/components/admin/mergeOverlaps'
import { makeStay, uuid } from '../../fixtures/data'

function stay(n: number, entry: string, exit: string | null) {
  return makeStay({ id: uuid(n), entry_date: entry, exit_date: exit })
}

describe('findOverlaps', () => {
  it('finds stays whose days overlap', () => {
    const kept = [stay(1, '2026-09-01', '2026-09-10')]
    const other = [stay(2, '2026-09-05', '2026-09-20'), stay(3, '2026-08-01', '2026-08-05')]
    expect(findOverlaps(kept, other).map((overlap) => overlap.other.id)).toEqual([uuid(2)])
  })

  it('lets a stay start on the day the previous one ended', () => {
    expect(findOverlaps([stay(1, '2026-09-01', '2026-09-10')], [stay(2, '2026-09-10', null)])).toEqual([])
  })

  it('counts a same-day stay as occupying its day', () => {
    expect(findOverlaps([stay(1, '2026-09-10', '2026-09-10')], [stay(2, '2026-09-10', null)])).toHaveLength(1)
    expect(findOverlaps([stay(1, '2026-09-10', '2026-09-10')], [stay(2, '2026-09-11', null)])).toEqual([])
  })

  it('treats an open stay as having no end', () => {
    expect(findOverlaps([stay(1, '2026-09-01', null)], [stay(2, '2026-12-01', '2026-12-05')])).toHaveLength(1)
  })
})

describe('stayRangeLabel', () => {
  // Echoes the key and the named values, so the test sees which message is picked.
  const t = (key: string, named: Record<string, unknown>) => `${key}:${JSON.stringify(named)}`
  const format = (value: string) => `<${value}>`

  it('labels a closed stay with both days', () => {
    expect(stayRangeLabel(stay(1, '2026-09-01', '2026-09-10'), format, t)).toBe(
      'admin.merge.range:{"from":"<2026-09-01>","to":"<2026-09-10>"}',
    )
  })

  it('labels an open stay with its first day only', () => {
    expect(stayRangeLabel(stay(1, '2026-09-01', null), format, t)).toBe(
      'admin.merge.openRange:{"from":"<2026-09-01>"}',
    )
  })
})
