import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { listOutingsForStay } from '@/api/outings'
import { getPerson, updatePerson } from '@/api/people'
import { checkIn, listStaysForPerson } from '@/api/stays'
import { todayIn } from '@/lib/shelterTime'
import PersonView from '@/views/PersonView.vue'
import { makeOuting, makePerson, makeStay, STAMP, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

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

const tz = 'America/Mexico_City'
const person = makePerson({ id: uuid(1) })
const openStay = makeStay({ id: uuid(101), entry_date: '2026-10-03', bed: 'A1' })
const pastStay = makeStay({
  id: uuid(100),
  entry_date: '2026-08-01',
  exit_date: '2026-08-15',
  bed: 'C4',
  phone_status: 'none',
})
const outing = makeOuting({ id: uuid(201), stay_id: uuid(101), comment: 'Cita en el consulado' })

async function mountLoaded(path = `/people/${uuid(1)}`) {
  const result = await mountWithApp(PersonView, { initialRoute: path })
  await vi.waitFor(() => expect(result.wrapper.find('[data-testid="person-name"]').exists()).toBe(true))
  return result
}

function button(wrapper: Awaited<ReturnType<typeof mountLoaded>>['wrapper'], label: string) {
  const found = wrapper.findAll('button').find((candidate) => candidate.text() === label)
  if (!found) throw new Error(`No ${label} button`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks keeps implementations, so reset the ones a test sets for its own flow.
  vi.mocked(updatePerson).mockReset()
  vi.mocked(checkIn).mockReset()
  confirm.mockReset()
  vi.mocked(getPerson).mockResolvedValue(person)
  vi.mocked(listStaysForPerson).mockResolvedValue([openStay, pastStay])
  vi.mocked(listOutingsForStay).mockResolvedValue([outing])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonView', () => {
  it('shows the details, the open stay, its outings and the stay history', async () => {
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('[data-testid="person-name"]').text()).toBe('Rosa Elena Pérez Lara')
    expect(wrapper.find('[data-testid="stay-status"]').text()).toBe('En el albergue desde 03/10/2026')
    const details = wrapper.find('[data-testid="person-details"]').text()
    expect(details).toContain('12/04/1996')
    expect(details).toContain('Mujer')
    expect(details).toContain('Honduras')
    expect(details).toContain('Cortés')

    const stays = wrapper.findAll('[data-testid="stay-row"]')
    expect(stays).toHaveLength(2)
    expect(stays[0]?.text()).toContain('Abierta')
    expect(stays[1]?.text()).toContain('15/08/2026')

    expect(listOutingsForStay).toHaveBeenCalledWith(uuid(101))
    const outingRow = wrapper.find('[data-testid="outing-row"]')
    expect(outingRow.text()).toContain('06/10/2026 10:00')
    expect(outingRow.text()).toContain('06/10/2026 12:30')
    expect(outingRow.text()).toContain('Cita en el consulado')
    expect(wrapper.findAll('button').some((candidate) => candidate.text() === 'Nueva estancia')).toBe(false)
  })

  it('points a merged record to the one that was kept and hides the actions', async () => {
    vi.mocked(getPerson).mockResolvedValue(makePerson({ merged_into_id: uuid(2) }))
    vi.mocked(listStaysForPerson).mockResolvedValue([])
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('[data-testid="merged-alert"] a').attributes('href')).toBe(`/people/${uuid(2)}`)
    const labels = wrapper.findAll('button').map((candidate) => candidate.text())
    expect(labels).not.toContain('Editar datos')
    expect(labels).not.toContain('Nueva estancia')
  })

  it('says when the record does not exist', async () => {
    vi.mocked(getPerson).mockRejectedValue(new ApiError('not_found'))
    const { wrapper } = await mountWithApp(PersonView, { initialRoute: `/people/${uuid(9)}` })
    await vi.waitFor(() => expect(wrapper.text()).toContain('No encontramos este registro.'))
  })

  it('saves edited details with the version that was loaded', async () => {
    vi.mocked(updatePerson).mockResolvedValue(makePerson({ last_name: 'Pérez de Ríos' }))
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Editar datos').trigger('click')
    await wrapper.find('#person-last-name').setValue('Pérez de Ríos')
    await wrapper.find('form.person-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(updatePerson).toHaveBeenCalledWith(
        uuid(1),
        STAMP,
        expect.objectContaining({ first_name: 'Rosa Elena', last_name: 'Pérez de Ríos' }),
      ),
    )
    expect(notify.success).toHaveBeenCalledWith('person.saved')
    await vi.waitFor(() => expect(wrapper.find('form.person-edit-form').exists()).toBe(false))
  })

  it('offers to reload when someone else changed the record', async () => {
    vi.mocked(updatePerson).mockRejectedValue(new ApiError('stale_record'))
    confirm.mockResolvedValue(true)
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Editar datos').trigger('click')
    await wrapper.find('form.person-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'person.staleMessage' })),
    )
    await vi.waitFor(() => expect(getPerson).toHaveBeenCalledTimes(2))
    expect(notify.error).not.toHaveBeenCalled()
    expect(wrapper.find('form.person-edit-form').exists()).toBe(false)
  })

  it('opens a new stay for a person who is not staying', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockResolvedValue(uuid(102))
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('[data-testid="stay-status"]').text()).toBe('No está en el albergue')
    await button(wrapper, 'Nueva estancia').trigger('click')
    await wrapper.find('#new-stay-bed').setValue('B7')
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() =>
      expect(checkIn).toHaveBeenCalledWith(uuid(1), {
        entry_date: todayIn(tz),
        case_type_code: null,
        bed: 'B7',
        phone_status: 'none',
        notes: '',
      }),
    )
    expect(notify.success).toHaveBeenCalledWith('stays.newStay.saved')
    await vi.waitFor(() => expect(listStaysForPerson).toHaveBeenCalledTimes(2))
  })

  it('opens the new stay form directly when coming from the duplicate panel', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    const { wrapper } = await mountLoaded(`/people/${uuid(1)}?checkIn=1`)
    await vi.waitFor(() => expect(wrapper.find('form.new-stay-form').exists()).toBe(true))
  })

  it('explains how to fix a new stay that overlaps one closed today by mistake', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockRejectedValue(new ApiError('overlapping_stays'))
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Nueva estancia').trigger('click')
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="overlap-hint"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="overlap-hint"]').text()).toContain('reabre esa estancia')
    expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'overlapping_stays' }))
  })

  it('reloads when another computer already checked the person in', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockRejectedValue(new ApiError('already_checked_in'))
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Nueva estancia').trigger('click')
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() => expect(listStaysForPerson).toHaveBeenCalledTimes(2))
    expect(wrapper.find('form.new-stay-form').exists()).toBe(false)
  })

  it('saves edits with the version the form was opened from, even after a reload', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockResolvedValue(uuid(102))
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Editar datos').trigger('click')
    // Another computer changes the person; the check-in below reloads the record.
    vi.mocked(getPerson).mockResolvedValue(makePerson({ updated_at: '2026-10-07T18:00:00+00:00' }))
    await button(wrapper, 'Nueva estancia').trigger('click')
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() => expect(getPerson).toHaveBeenCalledTimes(2))
    await wrapper.find('form.person-edit-form').trigger('submit')
    await vi.waitFor(() => expect(updatePerson).toHaveBeenCalled())
    expect(vi.mocked(updatePerson).mock.calls[0]?.[1]).toBe(STAMP)
  })

  it('keeps a saved check-in as a success when clearing the duplicate panel flag fails', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockResolvedValue(uuid(102))
    const { wrapper, router } = await mountLoaded(`/people/${uuid(1)}?checkIn=1`)
    await vi.waitFor(() => expect(wrapper.find('form.new-stay-form').exists()).toBe(true))
    vi.spyOn(router, 'replace').mockRejectedValue(new Error('chunk failed to load'))
    vi.mocked(listStaysForPerson).mockResolvedValue([openStay, pastStay])
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="stay-status"]').text()).toContain('En el albergue'))
    expect(router.replace).toHaveBeenCalled()
    expect(checkIn).toHaveBeenCalledTimes(1)
    expect(notify.success).toHaveBeenCalledWith('stays.newStay.saved')
    expect(notify.error).not.toHaveBeenCalled()
    expect(wrapper.find('form.new-stay-form').exists()).toBe(false)
    expect(button(wrapper, 'Editar datos').exists()).toBe(true)
    expect(wrapper.findAll('button').some((candidate) => candidate.text() === 'Nueva estancia')).toBe(false)
  })

  it('ignores a slow answer for a record the user has already left', async () => {
    let answerFirst: (value: ReturnType<typeof makePerson>) => void = () => {}
    const slow = new Promise<ReturnType<typeof makePerson>>((resolve) => {
      answerFirst = resolve
    })
    const second = makePerson({ id: uuid(2), first_name: 'Ana', last_name: 'Soto' })
    vi.mocked(getPerson).mockImplementation((id) => (id === uuid(1) ? slow : Promise.resolve(second)))
    const { wrapper, router } = await mountWithApp(PersonView, { initialRoute: `/people/${uuid(1)}` })
    await router.push(`/people/${uuid(2)}`)
    await vi.waitFor(() => expect(wrapper.find('[data-testid="person-name"]').text()).toBe('Ana Soto'))
    answerFirst(person)
    await flushPromises()
    expect(wrapper.find('[data-testid="person-name"]').text()).toBe('Ana Soto')
  })

  it('does not reset the check-in form of one record when a slow load for another one ends', async () => {
    let answerFirst: (value: ReturnType<typeof makePerson>) => void = () => {}
    const slow = new Promise<ReturnType<typeof makePerson>>((resolve) => {
      answerFirst = resolve
    })
    const second = makePerson({ id: uuid(2), first_name: 'Ana', last_name: 'Soto' })
    vi.mocked(getPerson).mockImplementation((id) => (id === uuid(1) ? slow : Promise.resolve(second)))
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    const { wrapper, router } = await mountWithApp(PersonView, { initialRoute: `/people/${uuid(1)}` })
    await router.push(`/people/${uuid(2)}?checkIn=1`)
    await vi.waitFor(() => expect(wrapper.find('form.new-stay-form').exists()).toBe(true))
    await wrapper.find('#new-stay-bed').setValue('B7')
    answerFirst(person)
    await flushPromises()
    expect((wrapper.find('#new-stay-bed').element as HTMLInputElement).value).toBe('B7')
  })

  it('does not show "not found" for a record that is still loading after one that was missing', async () => {
    let answerSecond: (value: ReturnType<typeof makePerson>) => void = () => {}
    const slow = new Promise<ReturnType<typeof makePerson>>((resolve) => {
      answerSecond = resolve
    })
    vi.mocked(getPerson).mockImplementation((id) => (id === uuid(9) ? Promise.reject(new ApiError('not_found')) : slow))
    const { wrapper, router } = await mountWithApp(PersonView, { initialRoute: `/people/${uuid(9)}` })
    await vi.waitFor(() => expect(wrapper.text()).toContain('No encontramos este registro.'))
    await router.push(`/people/${uuid(1)}`)
    await flushPromises()
    expect(wrapper.text()).not.toContain('No encontramos este registro.')
    expect(wrapper.text()).toContain('Cargando...')
    answerSecond(person)
    await vi.waitFor(() => expect(wrapper.find('[data-testid="person-name"]').exists()).toBe(true))
  })
})
