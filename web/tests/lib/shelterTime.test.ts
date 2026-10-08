import { afterEach, describe, expect, it, vi } from 'vitest'
import { ageOn, formatDate, formatDateTime, formatTime, todayIn } from '@/lib/shelterTime'

const MX = 'America/Mexico_City'

describe('formatDate', () => {
  it('formats a timestamp as dd/MM/yyyy in the shelter timezone', () => {
    expect(formatDate('2026-03-05T18:00:00Z', MX)).toBe('05/03/2026')
  })

  it('uses the shelter day, not the UTC day, late in the evening', () => {
    // 03:30 UTC on 6 March is 21:30 on 5 March in Mexico City.
    expect(formatDate('2026-03-06T03:30:00Z', MX)).toBe('05/03/2026')
  })

  it('never shifts a date-only value', () => {
    expect(formatDate('2026-03-05', MX)).toBe('05/03/2026')
    expect(formatDate('2026-03-05', 'Pacific/Kiritimati')).toBe('05/03/2026')
    expect(formatDate('2026-03-05', 'Pacific/Pago_Pago')).toBe('05/03/2026')
  })

  it('returns an empty string for missing or invalid values', () => {
    expect(formatDate(null, MX)).toBe('')
    expect(formatDate(undefined, MX)).toBe('')
    expect(formatDate('', MX)).toBe('')
    expect(formatDate('not a date', MX)).toBe('')
  })

  it('accepts Date objects', () => {
    expect(formatDate(new Date('2026-12-31T23:00:00Z'), MX)).toBe('31/12/2026')
  })
})

describe('formatTime and formatDateTime', () => {
  it('formats HH:mm on a 24 hour clock', () => {
    expect(formatTime('2026-03-05T21:07:00Z', MX)).toBe('15:07')
    expect(formatTime('2026-03-05T06:00:00Z', MX)).toBe('00:00')
  })

  it('has no daylight saving time in Mexico City', () => {
    // Mexico City stays at UTC-6 all year; Tijuana moves to UTC-7 in summer.
    expect(formatTime('2026-07-15T18:30:00Z', MX)).toBe('12:30')
    expect(formatTime('2026-01-15T18:30:00Z', MX)).toBe('12:30')
    expect(formatTime('2026-07-15T18:30:00Z', 'America/Tijuana')).toBe('11:30')
  })

  it('formats date and time together', () => {
    expect(formatDateTime('2026-03-06T03:30:00Z', MX)).toBe('05/03/2026 21:30')
  })

  it('returns an empty string for missing values', () => {
    expect(formatTime(null, MX)).toBe('')
    expect(formatDateTime(null, MX)).toBe('')
  })
})

describe('todayIn', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is still yesterday one second before shelter midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T05:59:59Z'))
    expect(todayIn(MX)).toBe('2025-12-31')
  })

  it('turns over exactly at shelter midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T06:00:00Z'))
    expect(todayIn(MX)).toBe('2026-01-01')
  })

  it('depends on the timezone it is given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T05:00:00Z'))
    expect(todayIn('UTC')).toBe('2026-01-01')
    expect(todayIn(MX)).toBe('2025-12-31')
  })
})

describe('ageOn', () => {
  it('is 17 the day before the 18th birthday and 18 on it', () => {
    expect(ageOn('2008-10-08', '2026-10-07')).toBe(17)
    expect(ageOn('2008-10-07', '2026-10-07')).toBe(18)
  })

  it('handles a 29 February birthday like the database', () => {
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17)
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18)
  })

  it('matches the database when the birth date is after the reference date', () => {
    // app.age_on truncates toward zero: a birth one day ahead is age 0, not -1.
    expect(ageOn('2026-10-08', '2026-10-07')).toBe(0)
    expect(ageOn('2027-03-01', '2026-02-28')).toBe(-1)
  })

  it('returns null for an unknown birth date', () => {
    expect(ageOn(null, '2026-10-07')).toBeNull()
  })
})
