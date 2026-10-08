import { beforeAll, describe, expect, it } from 'vitest'
import { listCurrentResidents } from '@/api/stays'
import { createResident } from './factories'
import { signInAs } from './helpers'

describe('current residents', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('lists an open stay with derived presence and flags', async () => {
    const { personId, stayId } = await createResident()
    const row = (await listCurrentResidents()).find((resident) => resident.stay_id === stayId)
    expect(row).toMatchObject({
      person_id: personId,
      presence: 'inside',
      outings_today: 0,
      is_unaccompanied_minor: false,
    })
  })
})
