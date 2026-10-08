import { beforeAll, describe, expect, it } from 'vitest'
import { registerAndCheckIn } from '@/api/people'
import { listCurrentResidents } from '@/api/stays'
import { signInAs, uniqueSuffix } from './helpers'

describe('registration', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('creates the person and an open stay in one call, trimming text', async () => {
    const name = `Prueba ${uniqueSuffix()}`
    const { person_id, stay_id } = await registerAndCheckIn(
      { first_name: `  ${name}  `, last_name: '   ', region: ' Cortés ' },
      { bed: ' A1 ', phone_status: 'with_person' },
    )
    const row = (await listCurrentResidents()).find((resident) => resident.stay_id === stay_id)
    expect(row).toMatchObject({
      person_id,
      first_name: name,
      last_name: null,
      region: 'Cortés',
      bed: 'A1',
      phone_status: 'with_person',
    })
  })

  it('rejects a blank first name and creates nothing', async () => {
    await expect(registerAndCheckIn({ first_name: '   ' }, {})).rejects.toMatchObject({ code: 'validation' })
  })
})
