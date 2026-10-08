import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSignedPhotoUrls, uploadPersonPhoto } from '@/api/photos'
import PersonPhoto from '@/components/people/PersonPhoto.vue'
import PhotoCapture from '@/components/people/PhotoCapture.vue'
import { usePendingPhotos } from '@/composables/usePendingPhotos'
import { uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/lib/imageResize', () => ({ makePhotoPair: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
  uploadPersonPhoto: vi.fn(),
}))

const pair = {
  full: new Blob(['full'], { type: 'image/jpeg' }),
  thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
}
const path = `${uuid(1)}.jpg`

function mountPhoto(props: Record<string, unknown> = {}) {
  return mountWithApp(PersonPhoto, {
    props: { personId: uuid(1), photoPath: null, name: 'Rosa Pérez', ...props },
  })
}

function buttonLabeled(wrapper: Awaited<ReturnType<typeof mountPhoto>>['wrapper'], label: string) {
  const found = wrapper.findAll('button').find((button) => button.text() === label)
  if (!found) throw new Error(`No ${label} button`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSignedPhotoUrls).mockReset()
  vi.mocked(uploadPersonPhoto).mockReset()
  vi.mocked(getSignedPhotoUrls).mockResolvedValue({ [path]: 'https://storage.test/rosa.jpg' })
})

afterEach(() => {
  usePendingPhotos().clear(uuid(1))
  document.body.innerHTML = ''
})

describe('PersonPhoto', () => {
  it('shows the photo through a signed URL', async () => {
    const { wrapper } = await mountPhoto({ photoPath: path })
    await vi.waitFor(() => expect(wrapper.find('img').attributes('src')).toBe('https://storage.test/rosa.jpg'))
    expect(getSignedPhotoUrls).toHaveBeenCalledWith([path])
    expect(wrapper.find('img').attributes('alt')).toBe('Foto de Rosa Pérez')
  })

  it('uploads a new photo and tells the record to reload', async () => {
    vi.mocked(uploadPersonPhoto).mockResolvedValue(path)
    const { wrapper } = await mountPhoto()
    expect(wrapper.text()).toContain('Sin foto')
    await buttonLabeled(wrapper, 'Agregar foto').trigger('click')
    wrapper.findComponent(PhotoCapture).vm.$emit('captured', pair)
    await vi.waitFor(() => expect(uploadPersonPhoto).toHaveBeenCalledWith(uuid(1), pair.full, pair.thumb))
    await vi.waitFor(() => expect(wrapper.emitted('updated')).toHaveLength(1))
    expect(notify.success).toHaveBeenCalledWith('photos.saved')
  })

  it('shows a replacement photo although the photo path does not change', async () => {
    vi.mocked(getSignedPhotoUrls)
      .mockResolvedValueOnce({ [path]: 'https://storage.test/rosa.jpg?token=old' })
      .mockResolvedValueOnce({ [path]: 'https://storage.test/rosa.jpg?token=new' })
    vi.mocked(uploadPersonPhoto).mockResolvedValue(path)
    const { wrapper } = await mountPhoto({ photoPath: path })
    await vi.waitFor(() =>
      expect(wrapper.find('img').attributes('src')).toBe('https://storage.test/rosa.jpg?token=old'),
    )
    await buttonLabeled(wrapper, 'Cambiar foto').trigger('click')
    wrapper.findComponent(PhotoCapture).vm.$emit('captured', pair)
    await vi.waitFor(() =>
      expect(wrapper.find('img').attributes('src')).toBe('https://storage.test/rosa.jpg?token=new'),
    )
    expect(getSignedPhotoUrls).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('updated')).toHaveLength(1)
  })

  it('keeps a failed photo and retries it with Reintentar foto', async () => {
    vi.mocked(uploadPersonPhoto).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(path)
    const { wrapper } = await mountPhoto()
    await buttonLabeled(wrapper, 'Agregar foto').trigger('click')
    wrapper.findComponent(PhotoCapture).vm.$emit('captured', pair)
    await vi.waitFor(() => expect(wrapper.find('[data-testid="photo-pending"]').exists()).toBe(true))
    await buttonLabeled(wrapper, 'Reintentar foto').trigger('click')
    await vi.waitFor(() => expect(uploadPersonPhoto).toHaveBeenCalledTimes(2))
    expect(vi.mocked(uploadPersonPhoto).mock.calls[1]).toEqual([uuid(1), pair.full, pair.thumb])
    await vi.waitFor(() => expect(wrapper.find('[data-testid="photo-pending"]').exists()).toBe(false))
  })

  it('does not report a saved photo as failed when showing it again fails', async () => {
    vi.mocked(getSignedPhotoUrls)
      .mockResolvedValueOnce({ [path]: 'https://storage.test/rosa.jpg?token=old' })
      .mockRejectedValueOnce(new Error('offline'))
    vi.mocked(uploadPersonPhoto).mockResolvedValue(path)
    const { wrapper } = await mountPhoto({ photoPath: path })
    await vi.waitFor(() => expect(wrapper.find('img').exists()).toBe(true))
    await buttonLabeled(wrapper, 'Cambiar foto').trigger('click')
    wrapper.findComponent(PhotoCapture).vm.$emit('captured', pair)
    await vi.waitFor(() => expect(getSignedPhotoUrls).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(wrapper.emitted('updated')).toHaveLength(1))
    expect(notify.success).toHaveBeenCalledWith('photos.saved')
    expect(notify.error).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="photo-pending"]').exists()).toBe(false)
    expect(usePendingPhotos().get(uuid(1))).toBeNull()
    // The picture that was there stays on screen instead of turning into "Sin foto".
    expect(wrapper.find('img').attributes('src')).toBe('https://storage.test/rosa.jpg?token=old')
  })

  it('offers the retry for a photo that failed during registration', async () => {
    usePendingPhotos().set(uuid(1), pair)
    const { wrapper } = await mountPhoto()
    expect(wrapper.find('[data-testid="photo-pending"]').text()).toContain('La foto no se pudo guardar.')
  })

  it('offers no changes on a merged record', async () => {
    const { wrapper } = await mountPhoto({ readonly: true })
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
