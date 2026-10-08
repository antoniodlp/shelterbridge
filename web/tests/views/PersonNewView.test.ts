import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ApiError } from '@/api/errors'
import { registerAndCheckIn } from '@/api/people'
import { todayIn } from '@/lib/shelterTime'
import PersonNewView from '@/views/PersonNewView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/people', () => ({
  registerAndCheckIn: vi.fn(),
  findPossibleDuplicates: vi.fn(async () => []),
}))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(async () => []) }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const tz = 'America/Mexico_City'

function mountView() {
  return mountWithApp(PersonNewView, { initialRoute: '/people/new' })
}

function valueOf(wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], selector: string): string {
  return (wrapper.find(selector).element as HTMLInputElement).value
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonNewView', () => {
  it('registers the person and the first stay in one call, then opens the record', async () => {
    vi.mocked(registerAndCheckIn).mockResolvedValue({ person_id: uuid(1), stay_id: uuid(101) })
    const { wrapper, router } = await mountView()
    await wrapper.find('#person-first-name').setValue('Rosa Elena')
    await wrapper.find('#person-last-name').setValue('Pérez Lara')
    await wrapper.find('#stay-bed').setValue('A1')
    await wrapper.find('#stay-phone-status').setValue('in_custody')
    await wrapper.find('form.registration-form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(router.currentRoute.value.params.id).toBe(uuid(1))
    expect(registerAndCheckIn).toHaveBeenCalledWith(
      {
        first_name: 'Rosa Elena',
        last_name: 'Pérez Lara',
        birth_date: null,
        birth_date_estimated: false,
        gender_code: null,
        country_code: null,
        region: '',
        carer_id: null,
      },
      { entry_date: todayIn(tz), case_type_code: null, bed: 'A1', phone_status: 'in_custody', notes: '' },
    )
    expect(notify.success).toHaveBeenCalledWith('registration.saved')
  })

  it('does not call the server when the first name is blank', async () => {
    const { wrapper } = await mountView()
    await wrapper.find('form.registration-form').trigger('submit')
    expect(registerAndCheckIn).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Este dato es obligatorio.')
    expect(wrapper.text()).toContain('Revisa los campos marcados.')
  })

  it('keeps everything typed when the server fails', async () => {
    vi.mocked(registerAndCheckIn).mockRejectedValue(new ApiError('network'))
    const { wrapper, router } = await mountView()
    await wrapper.find('#person-first-name').setValue('Rosa Elena')
    await wrapper.find('#stay-bed').setValue('A1')
    await wrapper.find('form.registration-form').trigger('submit')
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'network' })),
    )
    expect(valueOf(wrapper, '#person-first-name')).toBe('Rosa Elena')
    expect(valueOf(wrapper, '#stay-bed')).toBe('A1')
    expect(router.currentRoute.value.name).toBe('person-new')
  })

  it('stays locked and never registers twice when opening the saved record fails', async () => {
    vi.mocked(registerAndCheckIn).mockResolvedValue({ person_id: uuid(1), stay_id: uuid(101) })
    const { wrapper, router } = await mountView()
    const failure = new Error('chunk failed to load')
    vi.spyOn(router, 'push').mockRejectedValue(failure)
    await wrapper.find('#person-first-name').setValue('Rosa Elena')
    const form = wrapper.find('form.registration-form')
    await form.trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(failure))
    await flushPromises()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    await flushPromises()
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
  })

  it('sends one request when the form is submitted twice', async () => {
    vi.mocked(registerAndCheckIn).mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountView()
    await wrapper.find('#person-first-name').setValue('Rosa Elena')
    const form = wrapper.find('form.registration-form')
    void form.trigger('submit')
    void form.trigger('submit')
    await flushPromises()
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
  })
})
