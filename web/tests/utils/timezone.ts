import { afterEach, beforeEach } from 'vitest'

/**
 * One zone west of UTC and one east of it. A calendar-day bug shifts the day in
 * only one direction, so the date tests run under both. Under a UTC machine
 * zone alone, such a bug would pass unnoticed.
 */
export const TEST_TIMEZONES = ['America/Mexico_City', 'Pacific/Auckland'] as const

/**
 * Runs the tests of the enclosing describe block with the process in `timezone`.
 * The original TZ is restored after every test, also when the test fails, so
 * other tests keep the machine's zone (Node reads a runtime TZ change for Date).
 */
export function useTimezone(timezone: string): void {
  let original: string | undefined
  beforeEach(() => {
    original = process.env.TZ
    process.env.TZ = timezone
  })
  afterEach(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })
}
