import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type DOMWrapper, flushPromises } from '@vue/test-utils'
import { ApiError } from '@/api/errors'
import { endOuting } from '@/api/outings'
import { listCurrentResidents, updateStay } from '@/api/stays'
import ResidentsView from '@/views/ResidentsView.vue'
import { STAMP, makeResident, makeStay, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(), checkOut: vi.fn(), updateStay: vi.fn() }))
vi.mock('@/api/outings', () => ({ startOuting: vi.fn(), endOuting: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
  uploadPersonPhoto: vi.fn(),
}))

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

const residents = [
  makeResident({ stay_id: uuid(101), person_id: uuid(1), bed: 'A1', phone_status: 'none' }),
  makeResident({
    stay_id: uuid(102),
    person_id: uuid(2),
    first_name: 'Tomás',
    last_name: 'Gutiérrez',
    bed: 'B2',
    phone_status: 'in_custody',
    presence: 'outside',
    out_since: '2026-10-07T16:30:00+00:00',
    open_outing_id: uuid(201),
  }),
]

async function mountLoaded(): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(ResidentsView)
  await vi.waitFor(() => expect(wrapper.findAll('.e-row')).toHaveLength(residents.length), { timeout: 5000 })
  return wrapper
}

function rowFor(w: Wrapper, text: string) {
  const row = w.findAll('.e-row').find((candidate) => candidate.text().includes(text))
  if (!row) throw new Error(`No row contains ${text}`)
  return row
}

/** A row is found by first name (its cells join without spaces); the fields are named by the full name. */
interface Who {
  row: string
  name: string
}
const ROSA: Who = { row: 'Rosa Elena', name: 'Rosa Elena Pérez Lara' }
const TOMAS: Who = { row: 'Tomás', name: 'Tomás Gutiérrez' }

function bedInput(w: Wrapper, who: Who): DOMWrapper<HTMLInputElement> {
  return rowFor(w, who.row).find<HTMLInputElement>(`input[aria-label="Cama de ${who.name}"]`)
}

function phoneSelect(w: Wrapper, who: Who): DOMWrapper<HTMLSelectElement> {
  return rowFor(w, who.row).find<HTMLSelectElement>(`select[aria-label="Teléfono de ${who.name}"]`)
}

/** Types a new bed and leaves the field, which is when a browser fires change. */
async function typeBed(input: DOMWrapper<HTMLInputElement>, bed: string): Promise<void> {
  input.element.value = bed
  await input.trigger('input')
  await input.trigger('change')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue(residents)
  vi.mocked(updateStay).mockResolvedValue(makeStay())
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ResidentsView inline editing', () => {
  it('shows the bed in a text field and the phone status in a select, each named after the person', async () => {
    const w = await mountLoaded()
    expect(bedInput(w, ROSA).element.value).toBe('A1')
    expect(bedInput(w, TOMAS).element.value).toBe('B2')

    const select = phoneSelect(w, TOMAS)
    expect(select.element.value).toBe('in_custody')
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'Sin teléfono',
      'Lo tiene la persona',
      'En resguardo',
    ])
  })

  it('saves the bed when the field is left with a new value and reloads the list', async () => {
    const w = await mountLoaded()
    await typeBed(bedInput(w, ROSA), 'C3')
    await vi.waitFor(() => expect(updateStay).toHaveBeenCalledWith(uuid(101), STAMP, { bed: 'C3' }))
    expect(notify.success).toHaveBeenCalledWith('residents.inline.bedSaved', { name: ROSA.name })
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })

  it('saves the bed on Enter', async () => {
    const w = await mountLoaded()
    const input = bedInput(w, ROSA)
    input.element.value = 'C3'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Enter' })
    await vi.waitFor(() => expect(updateStay).toHaveBeenCalledWith(uuid(101), STAMP, { bed: 'C3' }))
  })

  it('sends one request when Enter is followed by leaving the field', async () => {
    vi.mocked(updateStay).mockReturnValue(new Promise(() => {}))
    const w = await mountLoaded()
    const input = bedInput(w, ROSA)
    input.element.value = 'C3'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('change')
    await flushPromises()
    expect(updateStay).toHaveBeenCalledTimes(1)
  })

  it('sends nothing when the field is left with the same bed', async () => {
    const w = await mountLoaded()
    await typeBed(bedInput(w, ROSA), ' A1 ')
    await flushPromises()
    expect(updateStay).not.toHaveBeenCalled()
    expect(listCurrentResidents).toHaveBeenCalledTimes(1)
  })

  it('restores the bed on Escape without saving', async () => {
    const w = await mountLoaded()
    const input = bedInput(w, ROSA)
    input.element.value = 'C3'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Escape' })
    expect(input.element.value).toBe('A1')
    await flushPromises()
    expect(updateStay).not.toHaveBeenCalled()
  })

  it('saves the phone status as soon as another option is picked', async () => {
    const w = await mountLoaded()
    await phoneSelect(w, ROSA).setValue('with_person')
    await vi.waitFor(() =>
      expect(updateStay).toHaveBeenCalledWith(uuid(101), STAMP, { phone_status: 'with_person' }),
    )
    expect(notify.success).toHaveBeenCalledWith('residents.inline.phoneSaved', { name: ROSA.name })
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })

  it('shows the error and reloads when someone else changed the stay first', async () => {
    vi.mocked(updateStay).mockRejectedValue(new ApiError('stale_record'))
    const w = await mountLoaded()
    await typeBed(bedInput(w, ROSA), 'C3')
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'stale_record' })),
    )
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('disables the fields while a row action runs', async () => {
    vi.mocked(endOuting).mockReturnValue(new Promise(() => {}))
    const w = await mountLoaded()
    expect(bedInput(w, ROSA).element.disabled).toBe(false)
    const regreso = rowFor(w, 'Tomás').findAll('button').find((button) => button.text() === 'Regreso')
    await regreso?.trigger('click')
    await vi.waitFor(() => expect(bedInput(w, ROSA).element.disabled).toBe(true), {
      timeout: 5000,
    })
    expect(phoneSelect(w, ROSA).element.disabled).toBe(true)
  })

  it('keeps key presses inside the fields away from the grid', async () => {
    const w = await mountLoaded()
    const reachedGrid = vi.fn()
    w.find('.e-grid').element.addEventListener('keydown', reachedGrid)
    await bedInput(w, ROSA).trigger('keydown', { key: 'ArrowLeft' })
    await phoneSelect(w, ROSA).trigger('keydown', { key: 'ArrowDown' })
    expect(reachedGrid).not.toHaveBeenCalled()
  })
})
