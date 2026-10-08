import { afterEach, describe, expect, it } from 'vitest'
import PersonThumb from '@/components/people/PersonThumb.vue'
import { mountWithApp } from '../../utils/mountWithApp'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonThumb', () => {
  it('shows the photo with an accessible name', async () => {
    const { wrapper } = await mountWithApp(PersonThumb, {
      props: { url: 'https://storage.test/t.jpg', name: 'Rosa Pérez' },
    })
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('https://storage.test/t.jpg')
    expect(img.attributes('alt')).toBe('Foto de Rosa Pérez')
  })

  it('shows initials when there is no photo', async () => {
    const { wrapper } = await mountWithApp(PersonThumb, { props: { url: null, name: 'Rosa Pérez' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('RP')
  })

  it('falls back to initials when the image fails, for example an expired URL', async () => {
    const { wrapper } = await mountWithApp(PersonThumb, {
      props: { url: 'https://storage.test/expired.jpg', name: 'Rosa Pérez' },
    })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('RP')
  })
})
