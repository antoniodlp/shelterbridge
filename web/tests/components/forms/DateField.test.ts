import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import DateField from '@/components/forms/DateField.vue'
import { mountWithApp } from '../../utils/mountWithApp'
import { typeInto } from '../../utils/syncfusion'
import { TEST_TIMEZONES, useTimezone } from '../../utils/timezone'

afterEach(() => {
  document.body.innerHTML = ''
})

function inputValue(wrapper: Awaited<ReturnType<typeof mountWithApp>>['wrapper']): string {
  return (wrapper.find('#field').element as HTMLInputElement).value
}

// The same calendar day must come out whatever the browser's timezone is.
describe.each(TEST_TIMEZONES)('DateField in %s', (timezone) => {
  useTimezone(timezone)

  it('runs in the zone under test', () => {
    // 2026-01-15 is winter in the north and summer in Auckland: UTC-6 and UTC+13.
    const expectedOffset = timezone === 'America/Mexico_City' ? 360 : -780
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(expectedOffset)
  })

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

// Syncfusion names its input "datepicker" unless the input already has an aria-label,
// which hides the visible <label for>. People using a screen reader need the label.
describe('DateField accessible name', () => {
  it('is named by the visible label, not by "datepicker"', async () => {
    const Host = defineComponent({
      render: () =>
        h('div', [
          h('label', { for: 'field' }, 'Fecha de prueba'),
          h(DateField, { id: 'field', modelValue: '2026-10-07' }),
        ]),
    })
    await mountWithApp(Host)
    const input = document.getElementById('field') as HTMLInputElement
    expect(input.hasAttribute('aria-label')).toBe(false)
    expect(Array.from(input.labels ?? []).map((label) => label.textContent)).toEqual(['Fecha de prueba'])
  })
})
