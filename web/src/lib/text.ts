// Same whitespace the database strips (app.trim_text): \s plus no-break (U+00A0),
// figure (U+2007), narrow no-break (U+202F) and zero-width no-break (U+FEFF) spaces.
const EDGE_WHITESPACE = /^[\s\u00a0\u2007\u202f\ufeff]+|[\s\u00a0\u2007\u202f\ufeff]+$/g

export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const cleaned = value.replace(EDGE_WHITESPACE, '')
  return cleaned === '' ? null : cleaned
}
