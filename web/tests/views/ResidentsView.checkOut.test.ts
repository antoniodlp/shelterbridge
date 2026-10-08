import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { checkOut, listCurrentResidents } from '@/api/stays'
import { todayIn } from '@/lib/shelterTime'
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

async function mountLoaded(): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(ResidentsView)
  await vi.waitFor(() => expect(wrapper.findAll('.e-row')).toHaveLength(1), { timeout: 5000 })
  return wrapper
}

async function checkOutFirstRow(w: Wrapper): Promise<void> {
  const button = w.find('.e-row').findAll('button').find((b) => b.text() === 'Egreso')
  if (!button) throw new Error('No Egreso button')
  await button.trigger('click')
  await vi.waitFor(() => expect(body().find('form.check-out-form').exists()).toBe(true))
  await body().find('form.check-out-form').trigger('submit')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue([
    makeResident({ stay_id: uuid(101), phone_status: 'in_custody' }),
  ])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ResidentsView check-out', () => {
  it('checks the person out on today and reloads the list', async () => {
    vi.mocked(checkOut).mockResolvedValue()
    const w = await mountLoaded()
    await checkOutFirstRow(w)
    await vi.waitFor(() =>
      expect(checkOut).toHaveBeenCalledWith(uuid(101), todayIn('America/Mexico_City')),
    )
    expect(notify.success).toHaveBeenCalledWith('stays.checkOut.done', { name: 'Rosa Elena Pérez Lara' })
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })

  it('shows the error and reloads when another computer already checked the person out', async () => {
    vi.mocked(checkOut).mockRejectedValue(new ApiError('stay_not_open'))
    const w = await mountLoaded()
    await checkOutFirstRow(w)
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'stay_not_open' })),
    )
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })
})
