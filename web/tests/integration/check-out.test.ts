import { beforeAll, describe, expect, it } from 'vitest'
import { checkOut, listCurrentResidents } from '@/api/stays'
import { createResident, daysAgo } from './factories'
import { signInAs } from './helpers'

describe('check-out', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('closes the stay today and refuses a second check-out', async () => {
    const { stayId } = await createResident()
    await checkOut(stayId)
    expect((await listCurrentResidents()).some((resident) => resident.stay_id === stayId)).toBe(false)
    await expect(checkOut(stayId)).rejects.toMatchObject({ code: 'stay_not_open' })
  })

  it('accepts a past exit date and rejects one before the entry', async () => {
    const first = await createResident({}, { entry_date: daysAgo(10) })
    await expect(checkOut(first.stayId, daysAgo(4))).resolves.toBeUndefined()
    const second = await createResident({}, { entry_date: daysAgo(3) })
    await expect(checkOut(second.stayId, daysAgo(5))).rejects.toMatchObject({ code: 'validation' })
  })
})
