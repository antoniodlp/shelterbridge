import { afterEach, describe, expect, it } from 'vitest'
import HeadcountBar from '@/components/residents/HeadcountBar.vue'
import { mountWithApp } from '../../utils/mountWithApp'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HeadcountBar', () => {
  it('shows each count with its label', async () => {
    const { wrapper } = await mountWithApp(HeadcountBar, {
      props: { summary: { total: 12, inside: 9, outside: 3, minors: 2, unaccompanied: 1 } },
    })
    expect(wrapper.find('[data-testid="count-total"]').text()).toBe('12')
    expect(wrapper.find('[data-testid="count-inside"]').text()).toBe('9')
    expect(wrapper.find('[data-testid="count-outside"]').text()).toBe('3')
    expect(wrapper.find('[data-testid="count-minors"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="count-unaccompanied"]').text()).toBe('1')
    expect(wrapper.text()).toContain('Menores sin acompañante')
  })

  it('highlights unaccompanied minors only when there are some', async () => {
    const some = await mountWithApp(HeadcountBar, {
      props: { summary: { total: 1, inside: 1, outside: 0, minors: 1, unaccompanied: 1 } },
    })
    expect(some.wrapper.find('[data-testid="count-unaccompanied"]').classes()).toContain('text-danger')
    const none = await mountWithApp(HeadcountBar, {
      props: { summary: { total: 1, inside: 1, outside: 0, minors: 0, unaccompanied: 0 } },
    })
    expect(none.wrapper.find('[data-testid="count-unaccompanied"]').classes()).not.toContain('text-danger')
  })
})
