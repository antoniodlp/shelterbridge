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
