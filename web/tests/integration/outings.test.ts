import { beforeAll, describe, expect, it } from 'vitest'
import { endOuting, startOuting } from '@/api/outings'
import { listCurrentResidents } from '@/api/stays'
import { createResident } from './factories'
import { signInAs } from './helpers'

async function presenceOf(stayId: string): Promise<string | null | undefined> {
  return (await listCurrentResidents()).find((resident) => resident.stay_id === stayId)?.presence
}

describe('outings', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('records an outing and a return, and asks before a second outing the same day', async () => {
    const { stayId } = await createResident()
    await expect(startOuting(stayId, '  Cita en el consulado  ')).resolves.toEqual(expect.any(String))
    expect(await presenceOf(stayId)).toBe('outside')
    await expect(startOuting(stayId)).rejects.toMatchObject({ code: 'outing_already_open' })

    await expect(endOuting(stayId)).resolves.toEqual(expect.any(String))
    expect(await presenceOf(stayId)).toBe('inside')
    await expect(endOuting(stayId)).rejects.toMatchObject({ code: 'no_open_outing' })

    await expect(startOuting(stayId)).rejects.toMatchObject({
      code: 'outing_exception_needs_confirmation',
    })
    await expect(startOuting(stayId, null, true)).resolves.toEqual(expect.any(String))
    expect(await presenceOf(stayId)).toBe('outside')
  })
})
