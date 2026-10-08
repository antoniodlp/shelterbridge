import { describe, expect, it } from 'vitest'
import { getSignedPhotoUrls, photoPathFor, thumbPathFor } from '@/api/photos'

const id = '00000000-0000-4000-8000-000000000001'

describe('photo paths', () => {
  it('builds object names from the person id only', () => {
    expect(photoPathFor(id)).toBe(`${id}.jpg`)
    expect(thumbPathFor(`${id}.jpg`)).toBe(`${id}_thumb.jpg`)
  })

  it('does not call storage when there is nothing to sign', async () => {
    await expect(getSignedPhotoUrls([])).resolves.toEqual({})
  })
})
