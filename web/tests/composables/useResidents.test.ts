import { describe, expect, it, vi } from 'vitest'
import { countResidents, matchesQuery } from '@/composables/useResidents'
import { makeResident } from '../fixtures/data'

vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn() }))
vi.mock('@/api/photos', () => ({
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
}))

describe('countResidents', () => {
  it('counts presence, minors and unaccompanied minors', () => {
    const summary = countResidents([
      makeResident(),
      makeResident({ presence: 'outside' }),
      makeResident({ is_minor: true, is_unaccompanied_minor: false }),
      makeResident({ is_minor: true, is_unaccompanied_minor: true, presence: 'outside' }),
      makeResident({ age: null, is_minor: null }),
    ])
    expect(summary).toEqual({ total: 5, inside: 3, outside: 2, minors: 2, unaccompanied: 1 })
  })
})

describe('matchesQuery', () => {
  const row = { full_name: 'Rosa Elena Pérez Lara', bed: 'A1' }

  it('matches names without accents or case', () => {
    expect(matchesQuery(row, 'perez')).toBe(true)
    expect(matchesQuery(row, 'ROSA ELENA')).toBe(true)
  })

  it('matches the bed', () => {
    expect(matchesQuery(row, 'a1')).toBe(true)
  })

  it('treats a blank query as a match', () => {
    expect(matchesQuery(row, '   ')).toBe(true)
  })

  it('rejects other names', () => {
    expect(matchesQuery(row, 'tomás')).toBe(false)
  })
})
