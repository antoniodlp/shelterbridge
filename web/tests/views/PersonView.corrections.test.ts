import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { deleteOuting, listOutingsForStay, updateOuting } from '@/api/outings'
import { getPerson } from '@/api/people'
import { deleteStay, listStaysForPerson, updateStay } from '@/api/stays'
import { todayIn } from '@/lib/shelterTime'
import PersonView from '@/views/PersonView.vue'
import { makeOuting, makePerson, makeStay, STAMP, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'
import { body, typeInto } from '../utils/syncfusion'
import { TEST_TIMEZONES, useTimezone } from '../utils/timezone'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/people', () => ({ getPerson: vi.fn(), updatePerson: vi.fn() }))
vi.mock('@/api/stays', () => ({
  listStaysForPerson: vi.fn(),
  checkIn: vi.fn(),
  listCurrentResidents: vi.fn(async () => []),
  updateStay: vi.fn(),
  deleteStay: vi.fn(),
}))
vi.mock('@/api/outings', () => ({
  listOutingsForStay: vi.fn(),
  updateOuting: vi.fn(),
  deleteOuting: vi.fn(),
}))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

const openStay = makeStay({ id: uuid(101), entry_date: '2026-10-03', bed: 'A1' })
const pastStay = makeStay({ id: uuid(100), entry_date: '2026-08-01', exit_date: '2026-08-15', bed: 'C4' })
const outing = makeOuting({ id: uuid(201), stay_id: uuid(101), returned_at: '2026-10-06T18:30:00+00:00' })

async function mountLoaded(role: 'volunteer' | 'admin' = 'volunteer'): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(PersonView, { initialRoute: `/people/${uuid(1)}`, session: { role } })
  await vi.waitFor(() => expect(wrapper.find('[data-testid="person-name"]').exists()).toBe(true))
  return wrapper
}

function rowButton(w: Wrapper, rowTestId: string, index: number, label: string) {
  const row = w.findAll(`[data-testid="${rowTestId}"]`)[index]
  const found = row?.findAll('button').find((candidate) => candidate.text() === label)
  if (!found) throw new Error(`No ${label} button in ${rowTestId} ${index}`)
  return found
}

function hasButton(w: Wrapper, label: string): boolean {
  return w.findAll('button').some((candidate) => candidate.text() === label)
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks keeps implementations, so reset the ones a test sets for its own flow.
  vi.mocked(updateStay).mockReset()
  vi.mocked(deleteStay).mockReset()
  vi.mocked(updateOuting).mockReset()
  vi.mocked(deleteOuting).mockReset()
  confirm.mockReset()
  confirm.mockResolvedValue(true)
  vi.mocked(getPerson).mockResolvedValue(makePerson())
  vi.mocked(listStaysForPerson).mockResolvedValue([openStay, pastStay])
  vi.mocked(listOutingsForStay).mockResolvedValue([outing])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonView stay corrections', () => {
  it('edits the open stay without touching its exit date', async () => {
    vi.mocked(updateStay).mockResolvedValue(makeStay({ bed: 'B3' }))
    const w = await mountLoaded()
    await rowButton(w, 'stay-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#stay-edit-bed').exists()).toBe(true))
    expect(body().find('#stay-edit-exit-date').exists()).toBe(false)
    await body().find('#stay-edit-bed').setValue('B3')
    await body().find('form.stay-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(updateStay).toHaveBeenCalledWith(uuid(101), STAMP, expect.objectContaining({ bed: 'B3' })),
    )
    expect(vi.mocked(updateStay).mock.calls[0]?.[2]).not.toHaveProperty('exit_date')
    expect(notify.success).toHaveBeenCalledWith('stays.edit.saved')
    await vi.waitFor(() => expect(body().find('#stay-edit-bed').exists()).toBe(false))
  })

  it('lets a closed stay have its exit date corrected', async () => {
    const w = await mountLoaded()
    await rowButton(w, 'stay-row', 1, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#stay-edit-exit-date').exists()).toBe(true))
  })

  it('keeps the dialog open with its input when the save fails for another reason', async () => {
    vi.mocked(updateStay).mockRejectedValue(new ApiError('overlapping_stays'))
    const w = await mountLoaded()
    await rowButton(w, 'stay-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#stay-edit-bed').exists()).toBe(true))
    await body().find('#stay-edit-bed').setValue('B3')
    await body().find('form.stay-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'overlapping_stays' })),
    )
    expect((body().find('#stay-edit-bed').element as HTMLInputElement).value).toBe('B3')
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('offers to reload when someone else changed the stay', async () => {
    vi.mocked(updateStay).mockRejectedValue(new ApiError('stale_record'))
    const w = await mountLoaded()
    await rowButton(w, 'stay-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#stay-edit-bed').exists()).toBe(true))
    await body().find('form.stay-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'person.staleMessage' })),
    )
    await vi.waitFor(() => expect(listStaysForPerson).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(body().find('#stay-edit-bed').exists()).toBe(false))
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('keeps a saved stay edit as a success when the reload after it fails', async () => {
    vi.mocked(updateStay).mockResolvedValue(makeStay({ bed: 'B3' }))
    const w = await mountLoaded()
    await rowButton(w, 'stay-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#stay-edit-bed').exists()).toBe(true))
    vi.mocked(getPerson).mockRejectedValue(new ApiError('network'))
    await body().find('form.stay-edit-form').trigger('submit')
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith('stays.edit.saved'))
    await vi.waitFor(() => expect(getPerson).toHaveBeenCalledTimes(2))
    // The write is committed: the dialog is closed, so there is no form to submit again.
    expect(body().find('#stay-edit-bed').exists()).toBe(false)
    expect(updateStay).toHaveBeenCalledTimes(1)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('shows delete only to admins, and asks first', async () => {
    const volunteerView = await mountLoaded()
    expect(hasButton(volunteerView, 'Eliminar')).toBe(false)
    document.body.innerHTML = ''
    vi.mocked(deleteStay).mockResolvedValue()
    const adminView = await mountLoaded('admin')
    await rowButton(adminView, 'stay-row', 1, 'Eliminar').trigger('click')
    await vi.waitFor(() => expect(deleteStay).toHaveBeenCalledWith(uuid(100)))
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ messageKey: 'stays.edit.deleteMessage', danger: true }),
    )
    expect(notify.success).toHaveBeenCalledWith('stays.edit.deleted')
  })

  it('deletes nothing when the admin does not confirm', async () => {
    confirm.mockResolvedValue(false)
    const w = await mountLoaded('admin')
    await rowButton(w, 'stay-row', 1, 'Eliminar').trigger('click')
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(deleteStay).not.toHaveBeenCalled()
  })

  it('shows the error and reloads when a delete fails', async () => {
    vi.mocked(deleteStay).mockRejectedValue(new ApiError('not_found'))
    const w = await mountLoaded('admin')
    await rowButton(w, 'stay-row', 1, 'Eliminar').trigger('click')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'not_found' })))
    await vi.waitFor(() => expect(listStaysForPerson).toHaveBeenCalledTimes(2))
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('reopens the most recent stay when it was closed by mistake', async () => {
    const closedToday = makeStay({
      id: uuid(102),
      entry_date: todayIn('America/Mexico_City'),
      exit_date: todayIn('America/Mexico_City'),
    })
    vi.mocked(listStaysForPerson).mockResolvedValue([closedToday, pastStay])
    vi.mocked(updateStay).mockResolvedValue(makeStay({ id: uuid(102), exit_date: null }))
    const w = await mountLoaded()
    expect(w.findAll('[data-testid="stay-row"]')[1]?.text()).not.toContain('Reabrir estancia')
    await rowButton(w, 'stay-row', 0, 'Reabrir estancia').trigger('click')
    await vi.waitFor(() => expect(updateStay).toHaveBeenCalledWith(uuid(102), STAMP, { exit_date: null }))
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'stays.reopen.message' }))
    expect(notify.success).toHaveBeenCalledWith('stays.reopen.done')
  })

  it('sends one reopen request when the button is clicked twice', async () => {
    const closedToday = makeStay({
      id: uuid(102),
      entry_date: todayIn('America/Mexico_City'),
      exit_date: todayIn('America/Mexico_City'),
    })
    vi.mocked(listStaysForPerson).mockResolvedValue([closedToday, pastStay])
    let finishWrite: () => void = () => {}
    vi.mocked(updateStay).mockReturnValue(
      new Promise((resolve) => {
        finishWrite = () => resolve(makeStay({ id: uuid(102), exit_date: null }))
      }),
    )
    const w = await mountLoaded()
    const reopen = rowButton(w, 'stay-row', 0, 'Reabrir estancia')
    // Two clicks before the question is answered, then a third while the write is running.
    await Promise.all([reopen.trigger('click'), reopen.trigger('click')])
    await vi.waitFor(() => expect(updateStay).toHaveBeenCalledTimes(1))
    await reopen.trigger('click')
    expect(confirm).toHaveBeenCalledTimes(2)
    finishWrite()
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith('stays.reopen.done'))
    expect(updateStay).toHaveBeenCalledTimes(1)
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('offers no reopen while a stay is open', async () => {
    const w = await mountLoaded()
    expect(hasButton(w, 'Reabrir estancia')).toBe(false)
  })

  it('offers no reopen for a stay closed on an earlier day', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    const w = await mountLoaded()
    expect(hasButton(w, 'Reabrir estancia')).toBe(false)
  })

  it('closes an open dialog when the page moves to another record', async () => {
    const second = makePerson({ id: uuid(2), first_name: 'Ana', last_name: 'Soto' })
    vi.mocked(getPerson).mockImplementation(async (id) => (id === uuid(2) ? second : makePerson()))
    const { wrapper, router } = await mountWithApp(PersonView, { initialRoute: `/people/${uuid(1)}` })
    await vi.waitFor(() => expect(wrapper.find('[data-testid="person-name"]').exists()).toBe(true))
    await rowButton(wrapper, 'stay-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#stay-edit-bed').exists()).toBe(true))
    await router.push(`/people/${uuid(2)}`)
    await vi.waitFor(() => expect(wrapper.find('[data-testid="person-name"]').text()).toBe('Ana Soto'))
    expect(body().find('#stay-edit-bed').exists()).toBe(false)
  })

  it('offers no corrections on a merged record', async () => {
    vi.mocked(getPerson).mockResolvedValue(makePerson({ merged_into_id: uuid(2) }))
    const w = await mountLoaded('admin')
    expect(w.findAll('[data-testid="stay-row"]')).toHaveLength(2)
    expect(hasButton(w, 'Editar')).toBe(false)
    expect(hasButton(w, 'Eliminar')).toBe(false)
    expect(hasButton(w, 'Reabrir estancia')).toBe(false)
  })
})

describe('PersonView outing corrections', () => {
  // The typed time is shelter wall-clock time, whatever the browser's timezone is.
  describe.each(TEST_TIMEZONES)('with the browser in %s', (browserZone) => {
    useTimezone(browserZone)

    it('corrects an outing return time, read as shelter time', async () => {
      vi.mocked(updateOuting).mockResolvedValue(outing)
      const w = await mountLoaded()
      await rowButton(w, 'outing-row', 0, 'Editar').trigger('click')
      await vi.waitFor(() => expect(body().find('#outing-returned-at').exists()).toBe(true))
      expect((body().find('#outing-returned-at').element as HTMLInputElement).value).toBe('06/10/2026 12:30')
      await typeInto(body().find('#outing-returned-at'), '06/10/2026 13:00')
      await body().find('form.outing-edit-form').trigger('submit')
      await vi.waitFor(() =>
        expect(updateOuting).toHaveBeenCalledWith(uuid(201), STAMP, { returned_at: '2026-10-06T19:00:00.000Z' }),
      )
      expect(notify.success).toHaveBeenCalledWith('outings.edit.saved')
    })
  })

  it('refuses an outing time in the future', async () => {
    const w = await mountLoaded()
    await rowButton(w, 'outing-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#outing-left-at').exists()).toBe(true))
    const nextYear = Number(todayIn('America/Mexico_City').slice(0, 4)) + 1
    await typeInto(body().find('#outing-left-at'), `01/01/${nextYear} 10:00`)
    await body().find('form.outing-edit-form').trigger('submit')
    expect(body().text()).toContain('La hora no puede ser posterior a este momento.')
    expect(updateOuting).not.toHaveBeenCalled()
  })

  it('closes without saving when nothing was changed', async () => {
    const w = await mountLoaded()
    await rowButton(w, 'outing-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('form.outing-edit-form').exists()).toBe(true))
    await body().find('form.outing-edit-form').trigger('submit')
    await vi.waitFor(() => expect(body().find('form.outing-edit-form').exists()).toBe(false))
    expect(updateOuting).not.toHaveBeenCalled()
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('lets an admin delete an outing recorded by mistake', async () => {
    vi.mocked(deleteOuting).mockResolvedValue()
    const w = await mountLoaded('admin')
    await rowButton(w, 'outing-row', 0, 'Eliminar').trigger('click')
    await vi.waitFor(() => expect(deleteOuting).toHaveBeenCalledWith(uuid(201)))
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ messageKey: 'outings.edit.deleteMessage', danger: true }),
    )
    expect(notify.success).toHaveBeenCalledWith('outings.edit.deleted')
  })

  it('does not show delete on outings to a volunteer', async () => {
    const w = await mountLoaded()
    const row = w.findAll('[data-testid="outing-row"]')[0]
    expect(row?.findAll('button').map((candidate) => candidate.text())).toEqual(['Editar'])
  })
})
