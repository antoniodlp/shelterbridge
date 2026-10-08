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

    it('starts a day at the first valid moment when the clocks jump forward at midnight', () => {
      // Santiago: 00:00 on 2026-09-06 does not exist, the day starts at 01:00 (UTC-3).
      expect(startOfDayInstant('2026-09-06', 'America/Santiago')).toBe('2026-09-06T04:00:00.000Z')
      // Havana: 00:00 on 2026-03-08 does not exist, the day starts at 01:00 (UTC-4).
      expect(startOfDayInstant('2026-03-08', 'America/Havana')).toBe('2026-03-08T05:00:00.000Z')
    })

    it('keeps ordinary midnights on the days the clocks change', () => {
      // Auckland 2026-04-05: the clocks go back at 03:00, midnight exists once (UTC+13).
      expect(startOfDayInstant('2026-04-05', 'Pacific/Auckland')).toBe('2026-04-04T11:00:00.000Z')
      // Madrid 2026-10-25: the clocks go back at 03:00, midnight exists once (UTC+2).
      expect(startOfDayInstant('2026-10-25', 'Europe/Madrid')).toBe('2026-10-24T22:00:00.000Z')
      // Tijuana 2026-03-08: the clocks jump at 02:00, so midnight is still PST (UTC-8).
      expect(startOfDayInstant('2026-03-08', 'America/Tijuana')).toBe('2026-03-08T08:00:00.000Z')
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

    it('moves a time skipped by the clocks forward to the first valid moment, east or west of UTC', () => {
      // Tijuana 02:30 on 2026-03-08 does not exist: 02:00 PST became 03:00 PDT, so 03:30 PDT.
      expect(fromWallClock(new Date(2026, 2, 8, 2, 30), 'America/Tijuana')).toBe('2026-03-08T10:30:00.000Z')
      // Madrid 02:30 on 2026-03-29 does not exist: 02:00 CET became 03:00 CEST, so 03:30 CEST.
      expect(fromWallClock(new Date(2026, 2, 29, 2, 30), 'Europe/Madrid')).toBe('2026-03-29T01:30:00.000Z')
    })

    it('keeps times that exist on the day the clocks change', () => {
      // Santiago 01:30 on 2026-09-06 is after the jump (UTC-3), Madrid 01:30 on 2026-10-25 is before
      // the fall back (UTC+2), Auckland 23:30 on 2026-04-04 is before the fall back (UTC+13).
      expect(fromWallClock(new Date(2026, 8, 6, 1, 30), 'America/Santiago')).toBe('2026-09-06T04:30:00.000Z')
      expect(fromWallClock(new Date(2026, 9, 25, 1, 30), 'Europe/Madrid')).toBe('2026-10-24T23:30:00.000Z')
      expect(fromWallClock(new Date(2026, 3, 4, 23, 30), 'Pacific/Auckland')).toBe('2026-04-04T10:30:00.000Z')
    })

    it('keeps its choice for a time the clocks repeat when they go back', () => {
      // Tijuana 01:30 on 2026-11-01 happens twice (PDT then PST); the first one is used.
      expect(fromWallClock(new Date(2026, 10, 1, 1, 30), 'America/Tijuana')).toBe('2026-11-01T08:30:00.000Z')
      // Madrid 02:30 on 2026-10-25 happens twice (CEST then CET); the second one is used.
      expect(fromWallClock(new Date(2026, 9, 25, 2, 30), 'Europe/Madrid')).toBe('2026-10-25T01:30:00.000Z')
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
