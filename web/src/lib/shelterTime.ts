// Dates and times are always shown in the shelter timezone, never the browser's.
// Date-only values (YYYY-MM-DD, such as birth_date or entry_date) are calendar
// days with no time, so they are formatted as-is and never shifted.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

interface Parts {
  year: string
  month: string
  day: string
  hour: string
  minute: string
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

function partsIn(date: Date, timeZone: string): Parts {
  const parts: Record<string, string> = {}
  for (const part of formatterFor(timeZone).formatToParts(date)) parts[part.type] = part.value
  return {
    year: parts.year ?? '',
    month: parts.month ?? '',
    day: parts.day ?? '',
    hour: parts.hour ?? '',
    minute: parts.minute ?? '',
  }
}

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | Date | null | undefined, timeZone: string): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') {
    const match = DATE_ONLY.exec(value)
    if (match) return `${match[3]}/${match[2]}/${match[1]}`
  }
  const date = toDate(value)
  if (!date) return ''
  const p = partsIn(date, timeZone)
  return `${p.day}/${p.month}/${p.year}`
}

export function formatTime(value: string | Date | null | undefined, timeZone: string): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string' && DATE_ONLY.test(value)) return ''
  const date = toDate(value)
  if (!date) return ''
  const p = partsIn(date, timeZone)
  return `${p.hour}:${p.minute}`
}

export function formatDateTime(value: string | Date | null | undefined, timeZone: string): string {
  const date = formatDate(value, timeZone)
  const time = formatTime(value, timeZone)
  return time === '' ? date : `${date} ${time}`
}

export function todayIn(timeZone: string): string {
  const p = partsIn(new Date(), timeZone)
  return `${p.year}-${p.month}-${p.day}`
}

function wholeYears(from: RegExpExecArray, to: RegExpExecArray): number {
  const [fy, fm, fd] = [Number(from[1]), Number(from[2]), Number(from[3])]
  const [ty, tm, td] = [Number(to[1]), Number(to[2]), Number(to[3])]
  let years = ty - fy
  if (tm < fm || (tm === fm && td < fd)) years -= 1
  return years
}

export function ageOn(birthDate: string | null, onDate: string): number | null {
  if (!birthDate) return null
  const birth = DATE_ONLY.exec(birthDate)
  const on = DATE_ONLY.exec(onDate)
  if (!birth || !on) return null
  // app.age_on truncates toward zero. The database never stores a birth date after
  // today, but if one is passed, the age is the negated span the other way round.
  return birthDate <= onDate ? wholeYears(birth, on) : 0 - wholeYears(on, birth)
}
