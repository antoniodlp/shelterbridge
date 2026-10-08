import { beforeAll, describe, expect, it } from 'vitest'
import { getPerson } from '@/api/people'
import { getSignedPhotoUrls, thumbPathFor, uploadPersonPhoto } from '@/api/photos'
import { createPerson } from './factories'
import { signInAs } from './helpers'

function jpeg(content: string): Blob {
  return new Blob([content], { type: 'image/jpeg' })
}

describe('photos', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('uploads both sizes, links the photo and serves it through signed URLs', async () => {
    const personId = await createPerson()
    const path = await uploadPersonPhoto(personId, jpeg('full'), jpeg('thumb'))
    expect(path).toBe(`${personId}.jpg`)
    expect((await getPerson(personId)).photo_path).toBe(path)

    const missing = '00000000-0000-4000-8000-00000000beef.jpg'
    const urls = await getSignedPhotoUrls([path, thumbPathFor(path), missing])
    expect(Object.keys(urls).sort()).toEqual([path, thumbPathFor(path)].sort())
    const response = await fetch(urls[thumbPathFor(path)] ?? '')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('thumb')
  })

  it('replaces an existing photo', async () => {
    const personId = await createPerson()
    await uploadPersonPhoto(personId, jpeg('old'), jpeg('old thumb'))
    const path = await uploadPersonPhoto(personId, jpeg('new'), jpeg('new thumb'))
    const urls = await getSignedPhotoUrls([path])
    const response = await fetch(urls[path] ?? '')
    expect(await response.text()).toBe('new')
  })
})
