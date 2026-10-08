import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PageHeader from '@/components/common/PageHeader.vue'
import { i18n } from '@/i18n'

describe('PageHeader', () => {
  it('shows the translated title with parameters and the actions slot', () => {
    const wrapper = mount(PageHeader, {
      props: { titleKey: 'nav.onShift', titleParams: { name: 'Ana' } },
      slots: { actions: '<button type="button">Acción</button>' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.get('h1').text()).toBe('De turno: Ana')
    expect(wrapper.get('button').text()).toBe('Acción')
  })
})
