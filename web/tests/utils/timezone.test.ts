import { describe, expect, it } from 'vitest'
import { TEST_TIMEZONES, useTimezone } from './timezone'

// Taken at load, before any test in this file changes the zone.
const systemOffset = new Date(2026, 0, 15, 12).getTimezoneOffset()
const systemZone = Intl.DateTimeFormat().resolvedOptions().timeZone

describe.each(TEST_TIMEZONES)('useTimezone %s', (timezone) => {
  describe('inside the block', () => {
    useTimezone(timezone)

    it('moves Date to the requested zone', () => {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timezone)
    })
  })

  // Sibling tests run after the block above, once its afterEach has run. With
  // one zone west and one east of UTC, a machine in either of them still sees
  // a failed restore after one of the two blocks.
  it('gives the machine zone back after the block', () => {
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(systemOffset)
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(systemZone)
  })
})
