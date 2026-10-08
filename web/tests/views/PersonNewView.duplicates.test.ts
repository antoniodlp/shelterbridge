import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type DuplicateCandidate, findPossibleDuplicates } from '@/api/people'
import PersonNewView from '@/views/PersonNewView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/people', () => ({ registerAndCheckIn: vi.fn(), findPossibleDuplicates: vi.fn() }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(async () => []) }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const returning: DuplicateCandidate = {
  person_id: uuid(7),
  first_name: 'Rosa Elena',
  last_name: 'Pérez Lara',
  birth_date: '1996-04-12',
  birth_date_estimated: false,
  country_code: 'HN',
  photo_path: null,
  score: 0.92,
  last_entry_date: '2026-08-01',
  last_exit_date: '2026-08-15',
}

async function mountWithCandidate() {
  const result = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
  await result.wrapper.find('#person-first-name').setValue('rosa elena')
  await result.wrapper.find('#person-last-name').setValue('perez')
  await vi.waitFor(
    () => expect(result.wrapper.find('[data-testid="duplicate-candidate"]').exists()).toBe(true),
    { timeout: 2000 },
  )
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findPossibleDuplicates).mockResolvedValue([returning])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonNewView duplicates', () => {
  it('looks for duplicates of what is being typed', async () => {
    await mountWithCandidate()
    expect(findPossibleDuplicates).toHaveBeenLastCalledWith({
      first_name: 'rosa elena',
      last_name: 'perez',
      birth_date: null,
      country_code: null,
    })
  })

  it('opens the existing record ready for a new stay when it is the same person', async () => {
    const { wrapper, router } = await mountWithCandidate()
    await wrapper.find('[data-testid="duplicate-candidate"] button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(router.currentRoute.value.params.id).toBe(uuid(7))
    expect(router.currentRoute.value.query.checkIn).toBe('1')
  })

  it('hides the panel and keeps the form when it is a new person', async () => {
    const { wrapper } = await mountWithCandidate()
    const newPerson = wrapper.findAll('button').find((button) => button.text() === 'Es una persona nueva')
    await newPerson?.trigger('click')
    expect(wrapper.find('[data-testid="duplicate-panel"]').exists()).toBe(false)
    expect((wrapper.find('#person-first-name').element as HTMLInputElement).value).toBe('rosa elena')
  })
})
