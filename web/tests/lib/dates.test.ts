import { describe, expect, it } from 'vitest'
import { fromLocalDate, toLocalDate } from '@/lib/dates'

describe('toLocalDate and fromLocalDate', () => {
  it('round-trips a calendar date through a date picker value', () => {
    const date = toLocalDate('2026-03-09')
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(2)
    expect(date?.getDate()).toBe(9)
    expect(fromLocalDate(date)).toBe('2026-03-09')
  })

  it('reads the calendar day the picker shows, even late at night', () => {
    expect(fromLocalDate(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07')
  })

  it('returns null for empty or invalid values', () => {
    expect(toLocalDate(null)).toBeNull()
    expect(toLocalDate('07/10/2026')).toBeNull()
    expect(fromLocalDate(null)).toBeNull()
    expect(fromLocalDate(new Date('not a date'))).toBeNull()
  })
})
