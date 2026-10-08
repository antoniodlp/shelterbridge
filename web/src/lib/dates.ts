// Calendar dates ('YYYY-MM-DD') and shelter wall-clock times for form controls.
// Nothing here uses the browser's timezone to decide which day something happened.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'YYYY-MM-DD' as a Date at local midnight, the shape date pickers work with. */
export function toLocalDate(value: string | null | undefined): Date | null {
  const match = value ? DATE_ONLY.exec(value) : null
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

/** A date picker value back to 'YYYY-MM-DD', read from the calendar day it shows. */
export function fromLocalDate(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

/** Calendar arithmetic on 'YYYY-MM-DD' values. */
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function wallClockIn(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** How far the timezone's wall clock is ahead of UTC at a given instant. */
function offsetMs(instantMs: number, timeZone: string): number {
  const wall = wallClockIn(new Date(instantMs), timeZone)
  const wholeSecond = Math.floor(instantMs / 1000) * 1000
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - wholeSecond
}

function zonedToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute)
  let instant = asUtc - offsetMs(asUtc, timeZone)
  // A second pass fixes the guess when the offset changes in between (daylight saving time).
  const corrected = asUtc - offsetMs(instant, timeZone)
  if (corrected !== instant) instant = corrected
  return new Date(instant).toISOString()
}

/** The instant local midnight starts the given day in the timezone. */
export function startOfDayInstant(value: string, timeZone: string): string {
  const match = DATE_ONLY.exec(value)
  if (!match) throw new Error('startOfDayInstant expects YYYY-MM-DD')
  return zonedToInstant(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, timeZone)
}

/**
 * An instant as a Date whose local fields show the wall-clock time in `timeZone`.
 * Date-time pickers display local fields, so this makes them show shelter time.
 */
export function toWallClock(value: string | null | undefined, timeZone: string): Date | null {
  if (!value) return null
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) return null
  const wall = wallClockIn(instant, timeZone)
  return new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
}

/** The reverse of toWallClock: a picker value read as shelter wall-clock time. */
export function fromWallClock(value: Date | null | undefined, timeZone: string): string | null {
  if (!value || Number.isNaN(value.getTime())) return null
  return zonedToInstant(
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
    value.getHours(),
    value.getMinutes(),
    timeZone,
  )
}
