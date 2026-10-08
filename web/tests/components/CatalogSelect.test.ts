import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CatalogSelect from '@/components/common/CatalogSelect.vue'
import { i18n } from '@/i18n'
import type { CatalogItem } from '@/types/domain'

vi.mock('@/api/catalogs')

function item(code: string, es: string, sort_order: number, active = true): CatalogItem {
  return { code, labels: { es }, sort_order, active, updated_at: '2026-10-07T12:00:00Z' }
}

const countries = [item('MX', 'México', 1), item('HN', 'Honduras', 2), item('XK', 'Kosovo', 1000, false)]

function mountSelect(props: { modelValue: string | null; allowEmpty?: boolean }) {
  return mount(CatalogSelect, {
    attachTo: document.body,
    props: { catalog: 'countries', ...props },
    global: {
      plugins: [
        i18n,
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: { catalogs: { items: { countries, case_types: [], genders: [] }, loaded: true } },
        }),
      ],
    },
  })
}

type DropDownInstance = { dataSource: { value: string; text: string }[]; value: string | null; text: string | null; dataBind(): void }

function dropDown(wrapper: ReturnType<typeof mountSelect>): DropDownInstance {
  return (wrapper.findComponent({ name: 'DropDownListComponent' }).vm as unknown as { ej2Instances: DropDownInstance }).ej2Instances
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CatalogSelect', () => {
  it('offers the active items with Spanish labels', async () => {
    const wrapper = mountSelect({ modelValue: null })
    await flushPromises()
    expect(dropDown(wrapper).dataSource).toEqual([
      { value: 'MX', text: 'México' },
      { value: 'HN', text: 'Honduras' },
    ])
    wrapper.unmount()
  })

  it('keeps an inactive current value selectable', async () => {
    const wrapper = mountSelect({ modelValue: 'XK' })
    await flushPromises()
    expect(dropDown(wrapper).dataSource.map((o) => o.value)).toContain('XK')
    expect(dropDown(wrapper).text).toBe('Kosovo')
    wrapper.unmount()
  })

  it('emits the chosen code', async () => {
    const wrapper = mountSelect({ modelValue: 'MX' })
    await flushPromises()
    const instance = dropDown(wrapper)
    instance.value = 'HN'
    instance.dataBind()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['HN'])
    wrapper.unmount()
  })

  it('emits null when cleared', async () => {
    const wrapper = mountSelect({ modelValue: 'MX', allowEmpty: true })
    await flushPromises()
    const instance = dropDown(wrapper)
    instance.value = null
    instance.dataBind()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    wrapper.unmount()
  })

  it('shows the translated placeholder', async () => {
    const wrapper = mountSelect({ modelValue: null })
    await flushPromises()
    expect(document.body.querySelector('input.e-dropdownlist')?.getAttribute('placeholder')).toBe('Selecciona una opción')
    wrapper.unmount()
  })
})
