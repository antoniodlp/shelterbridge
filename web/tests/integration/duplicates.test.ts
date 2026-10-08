import { beforeAll, describe, expect, it } from 'vitest'
import { findPossibleDuplicates } from '@/api/people'
import { createPerson } from './factories'
import { signInAs, uniqueSuffix } from './helpers'

describe('duplicate detection', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('finds a person typed with swapped names, no accents and swapped day and month', async () => {
    const surname = `Quintanilla ${uniqueSuffix()}`
    const personId = await createPerson({ first_name: 'Xóchitl', last_name: surname, birth_date: '1991-03-07' })
    const found = await findPossibleDuplicates({
      first_name: surname.toUpperCase(),
      last_name: 'xochitl',
      birth_date: '1991-07-03',
    })
    expect(found[0]?.person_id).toBe(personId)
  })

  it('returns nothing for a one-letter name', async () => {
    await expect(findPossibleDuplicates({ first_name: 'X' })).resolves.toEqual([])
  })
})
