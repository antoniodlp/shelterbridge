import { describe, expect, it } from 'vitest'
import { addDays, fromWallClock, startOfDayInstant, toWallClock } from '@/lib/dates'
import { TEST_TIMEZONES, useTimezone } from '../utils/timezone'

describe('addDays', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

// The shelter timezone is always passed in. The pickers still work with Date objects whose
// local fields are the wall clock, so the results must not depend on the browser's zone.
describe.each(TEST_TIMEZONES)('wall-clock helpers with the browser in %s', (browserZone) => {
  useTimezone(browserZone)

  it('runs in the zone under test', () => {
    // 2026-01-15 is winter in the north and summer in Auckland: UTC-6 and UTC+13.
    const expectedOffset = browserZone === 'America/Mexico_City' ? 360 : -780
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(expectedOffset)
  })

  describe('startOfDayInstant', () => {
    it('finds local midnight in the shelter timezone', () => {
      expect(startOfDayInstant('2026-10-07', 'America/Mexico_City')).toBe('2026-10-07T06:00:00.000Z')
    })

    it('follows daylight saving time where the timezone has it', () => {
      expect(startOfDayInstant('2026-01-01', 'America/Tijuana')).toBe('2026-01-01T08:00:00.000Z')
      expect(startOfDayInstant('2026-07-01', 'America/Tijuana')).toBe('2026-07-01T07:00:00.000Z')
    })
  })

  describe('toWallClock and fromWallClock', () => {
    it('shows an instant as the shelter wall clock, whatever the browser timezone is', () => {
      const wall = toWallClock('2026-01-01T06:30:00.000Z', 'America/Mexico_City')
      expect([wall?.getFullYear(), wall?.getMonth(), wall?.getDate(), wall?.getHours(), wall?.getMinutes()]).toEqual([
        2026, 0, 1, 0, 30,
      ])
    })

    it('reads a wall-clock time back as an instant in the shelter timezone', () => {
      expect(fromWallClock(new Date(2026, 6, 1, 12, 15), 'America/Tijuana')).toBe('2026-07-01T19:15:00.000Z')
      expect(fromWallClock(new Date(2026, 9, 7, 23, 59), 'Europe/Madrid')).toBe('2026-10-07T21:59:00.000Z')
    })

    it('round-trips a time to the minute', () => {
      const instant = '2026-10-07T16:30:00.000Z'
      expect(fromWallClock(toWallClock(instant, 'America/Mexico_City'), 'America/Mexico_City')).toBe(instant)
    })

    it('handles empty and invalid values', () => {
      expect(toWallClock(null, 'America/Mexico_City')).toBeNull()
      expect(toWallClock('not a time', 'America/Mexico_City')).toBeNull()
      expect(fromWallClock(null, 'America/Mexico_City')).toBeNull()
      expect(fromWallClock(new Date('not a time'), 'America/Mexico_City')).toBeNull()
    })
  })
})
