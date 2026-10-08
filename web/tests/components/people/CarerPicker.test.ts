import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DropDownListComponent } from '@syncfusion/ej2-vue-dropdowns'
import { listCurrentResidents } from '@/api/stays'
import CarerPicker from '@/components/people/CarerPicker.vue'
import { makeResident, uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue([
    makeResident({ person_id: uuid(1), bed: 'A1' }),
    makeResident({ person_id: uuid(2), first_name: 'Tomás', last_name: 'Gutiérrez', bed: null }),
  ])
})

afterEach(() => {
  document.body.innerHTML = ''
})

async function mountPicker(props: Record<string, unknown>) {
  const { wrapper } = await mountWithApp(CarerPicker, { props: { id: 'carer', modelValue: null, ...props } })
  await vi.waitFor(() => expect(wrapper.findComponent(DropDownListComponent).exists()).toBe(true))
  return wrapper
}

describe('CarerPicker', () => {
  it('offers the current residents except the person being edited, with their bed', async () => {
    const wrapper = await mountPicker({ excludeId: uuid(2) })
    expect(wrapper.findComponent(DropDownListComponent).props('dataSource')).toEqual([
      { value: uuid(1), text: 'Rosa Elena Pérez Lara (A1)' },
    ])
  })

  it('keeps a carer who is no longer staying, using the label it is given', async () => {
    const wrapper = await mountPicker({ modelValue: uuid(9), currentLabel: 'Carmen Ríos' })
    expect(wrapper.findComponent(DropDownListComponent).props('dataSource')).toContainEqual({
      value: uuid(9),
      text: 'Carmen Ríos',
    })
    expect((wrapper.find('#carer').element as HTMLInputElement).value).toBe('Carmen Ríos')
  })

  it('emits the chosen carer', async () => {
    const wrapper = await mountPicker({})
    wrapper.findComponent(DropDownListComponent).vm.$emit('change', { value: uuid(1), isInteracted: true })
    expect(wrapper.emitted('update:modelValue')).toEqual([[uuid(1)]])
  })
})
