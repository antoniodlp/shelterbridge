import { describe, expect, it } from 'vitest'
import { formatAge, fullName, initials, normalizeForSearch } from '@/lib/people'

describe('fullName', () => {
  it('joins first and last names', () => {
    expect(fullName('Rosa Elena', 'Pérez Lara')).toBe('Rosa Elena Pérez Lara')
  })

  it('handles a single name', () => {
    expect(fullName('Wilmer', null)).toBe('Wilmer')
  })
})

describe('formatAge', () => {
  it('shows the age as a plain number', () => {
    expect(formatAge(25)).toBe('25')
  })

  it('is empty when the age is unknown', () => {
    expect(formatAge(null)).toBe('')
  })
})

describe('normalizeForSearch', () => {
  it('drops accents, case and extra spaces', () => {
    expect(normalizeForSearch('  José   ÑÚÑEZ ')).toBe('jose nunez')
  })
})

describe('initials', () => {
  it('uses the first letter of the first two words', () => {
    expect(initials('rosa elena pérez')).toBe('RE')
  })

  it('handles an empty name', () => {
    expect(initials('')).toBe('')
  })
})
