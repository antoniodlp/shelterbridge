import { describe, expect, it } from 'vitest'
import { fromLocalDate, toLocalDate } from '@/lib/dates'
import { TEST_TIMEZONES, useTimezone } from '../utils/timezone'

describe.each(TEST_TIMEZONES)('toLocalDate and fromLocalDate in %s', (timezone) => {
  useTimezone(timezone)

  it('runs in the zone under test', () => {
    // 2026-01-15 is winter in the north and summer in Auckland: UTC-6 and UTC+13.
    const expectedOffset = timezone === 'America/Mexico_City' ? 360 : -780
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(expectedOffset)
  })

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

  it('reads the calendar day the picker shows, even just after midnight', () => {
    expect(fromLocalDate(new Date(2026, 9, 7, 0, 1))).toBe('2026-10-07')
  })

  it('returns null for empty or invalid values', () => {
    expect(toLocalDate(null)).toBeNull()
    expect(toLocalDate('07/10/2026')).toBeNull()
    expect(fromLocalDate(null)).toBeNull()
    expect(fromLocalDate(new Date('not a date'))).toBeNull()
  })
})
