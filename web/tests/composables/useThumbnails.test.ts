import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSignedPhotoUrls } from '@/api/photos'
import { useThumbnails } from '@/composables/useThumbnails'

vi.mock('@/api/photos', () => ({
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
}))

const signed = vi.mocked(getSignedPhotoUrls)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T15:00:00Z'))
  signed.mockReset()
  signed.mockImplementation(async (paths: string[]) =>
    Object.fromEntries(paths.map((path) => [path, `https://storage.test/${path}?token=1`])),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useThumbnails', () => {
  it('signs every thumbnail in one request and skips people without a photo', async () => {
    const thumbs = useThumbnails()
    await thumbs.load(['a.jpg', null, 'b.jpg', 'a.jpg', undefined])
    expect(signed).toHaveBeenCalledTimes(1)
    expect(signed).toHaveBeenCalledWith(['a_thumb.jpg', 'b_thumb.jpg'], 600)
    expect(thumbs.thumbUrl('a.jpg')).toBe('https://storage.test/a_thumb.jpg?token=1')
    expect(thumbs.thumbUrl(null)).toBeNull()
  })

  it('reuses URLs that are still fresh', async () => {
    const thumbs = useThumbnails()
    await thumbs.load(['a.jpg'])
    vi.setSystemTime(new Date('2026-10-07T15:05:00Z'))
    await thumbs.load(['a.jpg'])
    expect(signed).toHaveBeenCalledTimes(1)
  })

  it('signs again shortly before a URL expires, for a page left open all day', async () => {
    const thumbs = useThumbnails()
    await thumbs.load(['a.jpg'])
    vi.setSystemTime(new Date('2026-10-07T15:09:30Z'))
    await thumbs.load(['a.jpg'])
    expect(signed).toHaveBeenCalledTimes(2)
  })

  it('keeps working when signing fails', async () => {
    signed.mockRejectedValueOnce(new Error('offline'))
    const thumbs = useThumbnails()
    await expect(thumbs.load(['a.jpg'])).resolves.toBeUndefined()
    expect(thumbs.thumbUrl('a.jpg')).toBeNull()
  })
})
