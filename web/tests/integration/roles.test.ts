import { describe, expect, it } from 'vitest'
import { endOuting, listOutingsForStay, startOuting } from '@/api/outings'
import { findPossibleDuplicates, getPerson, registerAndCheckIn, searchPeople, updatePerson } from '@/api/people'
import { checkIn, checkOut, listCurrentResidents, listStaysForPerson } from '@/api/stays'
import type { AppRole } from '@/types/domain'
import { daysAgo } from './factories'
import { signInAs, uniqueSuffix } from './helpers'

// Spec section 12: every daily function works for every seeded role. What each role may or
// may not see or change in the database is covered in depth by the pgTAP tests.
const ROLES: AppRole[] = ['admin', 'legal', 'psychology', 'volunteer']

describe('daily operations for every role', () => {
  it.each(ROLES)('works for %s', async (role) => {
    await signInAs(role)
    const surname = `Roles ${uniqueSuffix()}`

    // Registration. The stay starts three days ago so that checking out today leaves room
    // to check in again today (a stay that starts and ends today occupies today).
    const { person_id: personId, stay_id: stayId } = await registerAndCheckIn(
      { first_name: 'Prueba', last_name: surname },
      { entry_date: daysAgo(3) },
    )
    expect((await listCurrentResidents()).some((resident) => resident.stay_id === stayId)).toBe(true)

    // Finding the person again.
    expect((await searchPeople(surname)).map((row) => row.person_id)).toContain(personId)
    const duplicates = await findPossibleDuplicates({ first_name: 'Prueba', last_name: surname })
    expect(duplicates.map((row) => row.person_id)).toContain(personId)

    // The person record and its correction.
    const person = await getPerson(personId)
    expect(person.last_name).toBe(surname)
    const updated = await updatePerson(personId, person.updated_at, { region: 'Jalisco' })
    expect(updated.region).toBe('Jalisco')

    // An outing and the return.
    await expect(startOuting(stayId)).resolves.toEqual(expect.any(String))
    await expect(endOuting(stayId)).resolves.toEqual(expect.any(String))
    const outings = await listOutingsForStay(stayId)
    expect(outings).toHaveLength(1)
    expect(outings[0]?.returned_at).not.toBeNull()

    // Check-out, then a new stay for the same person.
    await expect(checkOut(stayId)).resolves.toBeUndefined()
    expect((await listCurrentResidents()).some((resident) => resident.stay_id === stayId)).toBe(false)
    const newStayId = await checkIn(personId, {})
    expect(newStayId).toEqual(expect.any(String))
    const stays = await listStaysForPerson(personId)
    expect(stays.map((stay) => stay.id)).toEqual([newStayId, stayId])
    expect(stays.map((stay) => stay.exit_date === null)).toEqual([true, false])
  })
})
