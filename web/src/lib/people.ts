export function fullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [firstName, lastName]
    .map((part) => (part ?? '').trim())
    .filter((part) => part !== '')
    .join(' ')
}

/** "25", or empty when the age is unknown. */
export function formatAge(age: number | null | undefined): string {
  if (age === null || age === undefined) return ''
  return String(age)
}

/** Lowercase, without accents and with single spaces, for matching on the client. */
export function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}
