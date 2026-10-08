import { beforeAll, describe, expect, it } from 'vitest'
import { searchPeople } from '@/api/people'
import { createPerson, createStay } from './factories'
import { signInAs, uniqueSuffix } from './helpers'

describe('people search', () => {
  beforeAll(async () => {
    await signInAs('psychology')
  })

  it('finds people ignoring accents and reports an open stay', async () => {
    const surname = `Ñúñez${uniqueSuffix()}`
    const personId = await createPerson({ first_name: 'Itzel', last_name: surname })
    await createStay(personId)
    const found = await searchPeople(surname.replace('Ñúñez', 'nunez'))
    expect(found.find((row) => row.person_id === personId)?.has_open_stay).toBe(true)
  })

  it('returns nothing for one letter', async () => {
    await expect(searchPeople('a')).resolves.toEqual([])
  })
})
