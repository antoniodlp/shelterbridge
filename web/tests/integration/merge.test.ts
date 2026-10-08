import { describe, expect, it } from 'vitest'
import { getPerson, mergePeople } from '@/api/people'
import { listStaysForPerson } from '@/api/stays'
import type { AppRole } from '@/types/domain'
import { createPerson, createStay, daysAgo } from './factories'
import { signInAs, uniqueSuffix } from './helpers'

// Only an admin may merge; spec section 12 asks for each function as each seeded role.
const NON_ADMIN_ROLES: AppRole[] = ['legal', 'psychology', 'volunteer']

describe('merge', () => {
  it('lets an admin merge two records of the same person', async () => {
    await signInAs('admin')
    const suffix = uniqueSuffix()
    const survivor = await createPerson({ first_name: 'Jose', last_name: `Fusion ${suffix}` })
    const duplicate = await createPerson({ first_name: 'José', last_name: `Fusión ${suffix}` })
    await createStay(duplicate, { entry_date: daysAgo(30), exit_date: daysAgo(20) })
    await mergePeople(survivor, duplicate)
    expect((await getPerson(duplicate)).merged_into_id).toBe(survivor)
    expect(await listStaysForPerson(survivor)).toHaveLength(1)
  })

  it('refuses overlapping stays and the same record twice', async () => {
    await signInAs('admin')
    const first = await createPerson()
    const second = await createPerson()
    await createStay(first, { entry_date: daysAgo(10) })
    await createStay(second, { entry_date: daysAgo(5), exit_date: daysAgo(2) })
    await expect(mergePeople(first, second)).rejects.toMatchObject({ code: 'overlapping_stays' })
    await expect(mergePeople(first, first)).rejects.toMatchObject({ code: 'merge_same_person' })
    expect((await getPerson(second)).merged_into_id).toBeNull()
    expect(await listStaysForPerson(second)).toHaveLength(1)
  })

  it.each(NON_ADMIN_ROLES)('refuses a merge from %s and changes nothing', async (role) => {
    await signInAs(role)
    const first = await createPerson()
    const second = await createPerson()
    await createStay(second, { entry_date: daysAgo(10), exit_date: daysAgo(5) })
    await expect(mergePeople(first, second)).rejects.toMatchObject({ code: 'not_authorized' })

    await signInAs('admin')
    expect((await getPerson(first)).merged_into_id).toBeNull()
    expect((await getPerson(second)).merged_into_id).toBeNull()
    expect(await listStaysForPerson(first)).toHaveLength(0)
    expect(await listStaysForPerson(second)).toHaveLength(1)
  })
})
