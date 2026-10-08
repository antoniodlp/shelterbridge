import { afterEach, describe, expect, it, vi } from 'vitest'
import DateField from '@/components/forms/DateField.vue'
import { mountWithApp } from '../../utils/mountWithApp'
import { typeInto } from '../../utils/syncfusion'

afterEach(() => {
  document.body.innerHTML = ''
})

function inputValue(wrapper: Awaited<ReturnType<typeof mountWithApp>>['wrapper']): string {
  return (wrapper.find('#field').element as HTMLInputElement).value
}

describe('DateField', () => {
  it('shows a calendar date as dd/MM/yyyy', async () => {
    const { wrapper } = await mountWithApp(DateField, { props: { id: 'field', modelValue: '2026-10-07' } })
    expect(inputValue(wrapper)).toBe('07/10/2026')
  })

  it('emits a typed date as the same calendar day in YYYY-MM-DD', async () => {
    const { wrapper } = await mountWithApp(DateField, { props: { id: 'field', modelValue: null } })
    await typeInto(wrapper.find('#field'), '03/02/2026')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2026-02-03'])
  })

  it('emits null when the field is cleared', async () => {
    const { wrapper } = await mountWithApp(DateField, { props: { id: 'field', modelValue: '2026-10-07' } })
    await typeInto(wrapper.find('#field'), '')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('follows a new value from the parent without echoing it back', async () => {
    const { wrapper } = await mountWithApp(DateField, { props: { id: 'field', modelValue: '2026-10-07' } })
    await wrapper.setProps({ modelValue: '2026-01-15' })
    await vi.waitFor(() => expect(inputValue(wrapper)).toBe('15/01/2026'))
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
