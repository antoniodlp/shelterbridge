import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ApiError } from '@/api/errors'
import { endOuting, startOuting } from '@/api/outings'
import { listCurrentResidents } from '@/api/stays'
import type { CurrentResident } from '@/types/domain'
import ResidentsView from '@/views/ResidentsView.vue'
import { makeResident, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'
import { body } from '../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(), checkOut: vi.fn() }))
vi.mock('@/api/outings', () => ({ startOuting: vi.fn(), endOuting: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
  uploadPersonPhoto: vi.fn(),
}))

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

const residents = [
  makeResident({ stay_id: uuid(101), person_id: uuid(1) }),
  makeResident({
    stay_id: uuid(102),
    person_id: uuid(2),
    first_name: 'Tomás',
    last_name: 'Gutiérrez',
    bed: 'B2',
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

function buttonIn(row: ReturnType<typeof rowFor>, label: string) {
  const button = row.findAll('button').find((candidate) => candidate.text() === label)
  if (!button) throw new Error(`No ${label} button`)
  return button
}

async function submitOutingDialog(comment?: string): Promise<void> {
  await vi.waitFor(() => expect(body().find('#outing-comment').exists()).toBe(true))
  if (comment !== undefined) await body().find('#outing-comment').setValue(comment)
  await body().find('form.outing-start-form').trigger('submit')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue(residents)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ResidentsView outings', () => {
  it('offers Salida to people inside and Regreso to people outside', async () => {
    const w = await mountLoaded()
    const rosaButtons = rowFor(w, 'Rosa Elena').findAll('button').map((b) => b.text())
    expect(rosaButtons).toContain('Salida')
    expect(rosaButtons).not.toContain('Regreso')
    const tomasButtons = rowFor(w, 'Tomás').findAll('button').map((b) => b.text())
    expect(tomasButtons).toContain('Regreso')
    expect(tomasButtons).not.toContain('Salida')
  })

  it('records an outing with an optional comment and reloads the list', async () => {
    vi.mocked(startOuting).mockResolvedValue(uuid(301))
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').trigger('click')
    await submitOutingDialog('Cita en el consulado')
    await vi.waitFor(() =>
      expect(startOuting).toHaveBeenCalledWith(uuid(101), 'Cita en el consulado', false),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(notify.success).toHaveBeenCalledWith('outings.started', { name: 'Rosa Elena Pérez Lara' })
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })

  it('asks before recording a second outing when the server says so (stale list)', async () => {
    vi.mocked(startOuting)
      .mockRejectedValueOnce(new ApiError('outing_exception_needs_confirmation'))
      .mockResolvedValueOnce(uuid(302))
    confirm.mockResolvedValue(true)
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').trigger('click')
    await submitOutingDialog()
    await vi.waitFor(() => expect(startOuting).toHaveBeenCalledTimes(2))
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ messageKey: 'errors.outing_exception_needs_confirmation', confirmKey: 'outings.exception.confirm' }),
    )
    expect(startOuting).toHaveBeenNthCalledWith(1, uuid(101), null, false)
    expect(startOuting).toHaveBeenNthCalledWith(2, uuid(101), null, true)
    expect(notify.success).toHaveBeenCalledWith('outings.started', { name: 'Rosa Elena Pérez Lara' })
  })

  it('records nothing when the exception is declined', async () => {
    vi.mocked(startOuting).mockRejectedValueOnce(new ApiError('outing_exception_needs_confirmation'))
    confirm.mockResolvedValue(false)
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').trigger('click')
    await submitOutingDialog()
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled())
    await flushPromises()
    expect(startOuting).toHaveBeenCalledTimes(1)
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
  })

  describe('when the person already went out today', () => {
    beforeEach(() => {
      vi.mocked(listCurrentResidents).mockResolvedValue([
        makeResident({ stay_id: uuid(101), person_id: uuid(1), outings_today: 1 }),
        residents[1]!,
      ])
    })

    it('asks for the exception first and records the outing once, already confirmed', async () => {
      vi.mocked(startOuting).mockResolvedValue(uuid(303))
      confirm.mockResolvedValue(true)
      const w = await mountLoaded()
      await buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').trigger('click')
      await submitOutingDialog('Otra cita')
      await vi.waitFor(() => expect(startOuting).toHaveBeenCalledTimes(1))
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(confirm).toHaveBeenCalledWith({
        titleKey: 'outings.exception.title',
        messageKey: 'errors.outing_exception_needs_confirmation',
        confirmKey: 'outings.exception.confirm',
      })
      expect(confirm.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(startOuting).mock.invocationCallOrder[0]!,
      )
      expect(startOuting).toHaveBeenCalledWith(uuid(101), 'Otra cita', true)
      expect(notify.success).toHaveBeenCalledWith('outings.started', { name: 'Rosa Elena Pérez Lara' })
    })

    it('records nothing when the exception is declined', async () => {
      confirm.mockResolvedValue(false)
      const w = await mountLoaded()
      await buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').trigger('click')
      await submitOutingDialog()
      await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
      await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
      expect(startOuting).not.toHaveBeenCalled()
      expect(notify.success).not.toHaveBeenCalled()
      expect(notify.error).not.toHaveBeenCalled()
    })
  })

  it('records a return', async () => {
    vi.mocked(endOuting).mockResolvedValue(uuid(201))
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Tomás'), 'Regreso').trigger('click')
    await vi.waitFor(() => expect(endOuting).toHaveBeenCalledWith(uuid(102)))
    expect(notify.success).toHaveBeenCalledWith('outings.ended', { name: 'Tomás Gutiérrez' })
  })

  it('shows the error and reloads when another computer already recorded the return', async () => {
    vi.mocked(endOuting).mockRejectedValue(new ApiError('no_open_outing'))
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Tomás'), 'Regreso').trigger('click')
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'no_open_outing' })),
    )
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })

  it('sends one request when Regreso is clicked twice', async () => {
    vi.mocked(endOuting).mockReturnValue(new Promise(() => {}))
    const w = await mountLoaded()
    const button = buttonIn(rowFor(w, 'Tomás'), 'Regreso').element as HTMLButtonElement
    button.click()
    button.click()
    await flushPromises()
    expect(endOuting).toHaveBeenCalledTimes(1)
  })

  it('keeps the row actions locked until the reload after an action returns', async () => {
    vi.mocked(endOuting).mockResolvedValue(uuid(201))
    const w = await mountLoaded()
    let finishReload: (rows: CurrentResident[]) => void = () => {}
    vi.mocked(listCurrentResidents).mockReturnValueOnce(
      new Promise<CurrentResident[]>((resolve) => {
        finishReload = resolve
      }),
    )
    await buttonIn(rowFor(w, 'Tomás'), 'Regreso').trigger('click')
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 100))

    // The list still shows the old state, so a second click must not reach the server.
    const stale = buttonIn(rowFor(w, 'Tomás'), 'Regreso').element as HTMLButtonElement
    expect(stale.disabled).toBe(true)
    stale.click()
    await flushPromises()
    expect(endOuting).toHaveBeenCalledTimes(1)

    finishReload([residents[0]!, makeResident({ ...residents[1]!, presence: 'inside', out_since: null, open_outing_id: null })])
    await vi.waitFor(
      () => {
        const salida = buttonIn(rowFor(w, 'Tomás'), 'Salida').element as HTMLButtonElement
        expect(salida.disabled).toBe(false)
      },
      { timeout: 5000 },
    )
    expect((buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables every row action while one action is running', async () => {
    vi.mocked(endOuting).mockReturnValue(new Promise(() => {}))
    const w = await mountLoaded()
    const salida = () => buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').element as HTMLButtonElement
    expect(salida().disabled).toBe(false)
    await buttonIn(rowFor(w, 'Tomás'), 'Regreso').trigger('click')
    await vi.waitFor(() => expect(salida().disabled).toBe(true), { timeout: 5000 })
    const regreso = buttonIn(rowFor(w, 'Tomás'), 'Regreso').element as HTMLButtonElement
    expect(regreso.disabled).toBe(true)
  })
})
