import { beforeAll, describe, expect, it } from 'vitest'
import { endOuting, listOutingsForStay, startOuting } from '@/api/outings'
import { getPerson, updatePerson } from '@/api/people'
import { checkIn, checkOut, listStaysForPerson } from '@/api/stays'
import { createPerson, createResident, daysAgo } from './factories'
import { signInAs } from './helpers'

describe('person record', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('reads a person and reports an unknown id as not found', async () => {
    const id = await createPerson()
    await expect(getPerson(id)).resolves.toMatchObject({ id })
    await expect(getPerson('00000000-0000-4000-8000-00000000dead')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('updates a person with optimistic concurrency and trims text', async () => {
    const id = await createPerson()
    const loaded = await getPerson(id)
    const updated = await updatePerson(id, loaded.updated_at, { last_name: '  Ríos  ', region: '   ' })
    expect(updated).toMatchObject({ last_name: 'Ríos', region: null })
    await expect(updatePerson(id, loaded.updated_at, { region: 'Cortés' })).rejects.toMatchObject({
      code: 'stale_record',
    })
  })

  it('lists stays newest first and checks a returning person in', async () => {
    const { personId, stayId } = await createResident({}, { entry_date: daysAgo(20) })
    await checkOut(stayId, daysAgo(10))
    await expect(checkIn(personId, { bed: ' B7 ' })).resolves.toEqual(expect.any(String))
    await expect(checkIn(personId, {})).rejects.toMatchObject({ code: 'already_checked_in' })
    const stays = await listStaysForPerson(personId)
    expect(stays.map((stay) => stay.exit_date)).toEqual([null, daysAgo(10)])
    expect(stays[0]?.bed).toBe('B7')
  })

  it('refuses a new stay today after a same-day check-out', async () => {
    const { personId, stayId } = await createResident()
    await checkOut(stayId)
    await expect(checkIn(personId, {})).rejects.toMatchObject({ code: 'overlapping_stays' })
  })

  it('lists the outings of a stay newest first', async () => {
    const { stayId } = await createResident({}, { entry_date: daysAgo(2) })
    await startOuting(stayId)
    await endOuting(stayId)
    await startOuting(stayId, null, true)
    const outings = await listOutingsForStay(stayId)
    expect(outings).toHaveLength(2)
    expect(outings[0]?.returned_at).toBeNull()
    expect(outings[1]?.returned_at).not.toBeNull()
  })
})
