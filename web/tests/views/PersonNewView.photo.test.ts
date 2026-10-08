import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerAndCheckIn } from '@/api/people'
import { uploadPersonPhoto } from '@/api/photos'
import { usePendingPhotos } from '@/composables/usePendingPhotos'
import { makePhotoPair } from '@/lib/imageResize'
import PersonNewView from '@/views/PersonNewView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/lib/imageResize', () => ({ makePhotoPair: vi.fn() }))
vi.mock('@/api/people', () => ({ registerAndCheckIn: vi.fn(), findPossibleDuplicates: vi.fn(async () => []) }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(async () => []) }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const pair = {
  full: new Blob(['full'], { type: 'image/jpeg' }),
  thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
}
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL

beforeAll(() => {
  // jsdom has no object URLs; the preview only needs a string.
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterAll(() => {
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(makePhotoPair).mockResolvedValue(pair)
  vi.mocked(registerAndCheckIn).mockResolvedValue({ person_id: uuid(1), stay_id: uuid(101) })
  usePendingPhotos().clear(uuid(1))
})

afterEach(() => {
  document.body.innerHTML = ''
})

async function registerWithPhoto() {
  const result = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
  const input = result.wrapper.find('#registration-photo-file')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['raw'], 'foto.png', { type: 'image/png' })],
    configurable: true,
  })
  await input.trigger('change')
  await vi.waitFor(() => expect(result.wrapper.find('[data-testid="photo-ready"]').exists()).toBe(true))
  await result.wrapper.find('#person-first-name').setValue('Rosa Elena')
  await result.wrapper.find('form.registration-form').trigger('submit')
  await vi.waitFor(() => expect(result.router.currentRoute.value.name).toBe('person'))
  return result
}

describe('PersonNewView photo', () => {
  it('uploads the photo after registering, then opens the record', async () => {
    vi.mocked(uploadPersonPhoto).mockResolvedValue(`${uuid(1)}.jpg`)
    await registerWithPhoto()
    expect(uploadPersonPhoto).toHaveBeenCalledWith(uuid(1), pair.full, pair.thumb)
    expect(usePendingPhotos().get(uuid(1))).toBeNull()
  })

  it('still opens the record when the upload fails and keeps the photo for a retry', async () => {
    vi.mocked(uploadPersonPhoto).mockRejectedValue(new Error('offline'))
    const { router } = await registerWithPhoto()
    expect(router.currentRoute.value.params.id).toBe(uuid(1))
    expect(usePendingPhotos().get(uuid(1))).toEqual(pair)
    // The person is registered, so a failed photo is not reported as a failed registration.
    expect(notify.error).not.toHaveBeenCalled()
  })
})
