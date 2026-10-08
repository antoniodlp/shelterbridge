import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteOuting, endOuting, listOutingsForStay, startOuting, updateOuting } from '@/api/outings'
import { checkOut, deleteStay, listCurrentResidents, listStaysForPerson, updateStay } from '@/api/stays'
import { createResident, daysAgo } from './factories'
import { signInAs } from './helpers'

describe('corrections', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  afterAll(async () => {
    await signInAs('volunteer')
  })

  it('updates a stay with optimistic concurrency and trims text', async () => {
    const { personId, stayId } = await createResident({}, { bed: 'A1' })
    const [stay] = await listStaysForPerson(personId)
    if (!stay) throw new Error('missing stay')
    const updated = await updateStay(stayId, stay.updated_at, { bed: ' B3 ', notes: '  ' })
    expect(updated).toMatchObject({ bed: 'B3', notes: null })
    await expect(updateStay(stayId, stay.updated_at, { bed: 'C1' })).rejects.toMatchObject({ code: 'stale_record' })
  })

  it('reopens a stay checked out today by mistake', async () => {
    const { personId, stayId } = await createResident()
    await checkOut(stayId)
    const [closed] = await listStaysForPerson(personId)
    if (!closed) throw new Error('missing stay')
    await updateStay(stayId, closed.updated_at, { exit_date: null })
    expect((await listCurrentResidents()).some((resident) => resident.stay_id === stayId)).toBe(true)
  })

  it('corrects an outing and trims its comment', async () => {
    const { stayId } = await createResident({}, { entry_date: daysAgo(2) })
    await startOuting(stayId)
    await endOuting(stayId)
    const [outing] = await listOutingsForStay(stayId)
    if (!outing) throw new Error('missing outing')
    const updated = await updateOuting(outing.id, outing.updated_at, {
      returned_at: null,
      comment: '  Olvidó registrar el regreso  ',
    })
    expect(updated).toMatchObject({ returned_at: null, comment: 'Olvidó registrar el regreso' })
  })

  it('lets only an admin delete stays and outings', async () => {
    const { stayId } = await createResident({}, { entry_date: daysAgo(2) })
    const outingId = await startOuting(stayId)
    await expect(deleteOuting(outingId)).rejects.toMatchObject({ code: 'not_found' })
    await expect(deleteStay(stayId)).rejects.toMatchObject({ code: 'not_found' })
    await signInAs('admin')
    await expect(deleteOuting(outingId)).resolves.toBeUndefined()
    await expect(deleteStay(stayId)).resolves.toBeUndefined()
  })
})
