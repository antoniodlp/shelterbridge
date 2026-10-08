import { afterEach, describe, expect, it, vi } from 'vitest'
import DateTimeField from '@/components/forms/DateTimeField.vue'
import { mountWithApp } from '../../utils/mountWithApp'
import { typeInto } from '../../utils/syncfusion'
import { TEST_TIMEZONES, useTimezone } from '../../utils/timezone'

afterEach(() => {
  document.body.innerHTML = ''
})

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

function inputValue(wrapper: Wrapper): string {
  return (wrapper.find('#when').element as HTMLInputElement).value
}

// The picker shows the shelter's wall clock whatever the browser's timezone is.
describe.each(TEST_TIMEZONES)('DateTimeField with the browser in %s', (browserZone) => {
  useTimezone(browserZone)

  it('shows the instant as the shelter wall-clock time', async () => {
    const { wrapper } = await mountWithApp(DateTimeField, {
      props: { id: 'when', modelValue: '2026-10-07T16:30:00.000Z' },
      timezone: 'America/Mexico_City',
    })
    expect(inputValue(wrapper)).toBe('07/10/2026 10:30')
  })

  it('emits a typed time as the instant it means in the shelter timezone', async () => {
    const { wrapper } = await mountWithApp(DateTimeField, {
      props: { id: 'when', modelValue: null },
      timezone: 'America/Tijuana',
    })
    await typeInto(wrapper.find('#when'), '01/07/2026 12:15')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2026-07-01T19:15:00.000Z'])
  })

  it('follows the parent without echoing a value that only differs in seconds', async () => {
    const { wrapper } = await mountWithApp(DateTimeField, {
      props: { id: 'when', modelValue: '2026-10-07T16:30:45.000Z' },
      timezone: 'America/Mexico_City',
    })
    await wrapper.setProps({ modelValue: '2026-10-07T17:00:20.000Z' })
    await vi.waitFor(() => expect(inputValue(wrapper)).toBe('07/10/2026 11:00'))
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('emits null when cleared', async () => {
    const { wrapper } = await mountWithApp(DateTimeField, {
      props: { id: 'when', modelValue: '2026-10-07T16:30:00.000Z' },
      timezone: 'America/Mexico_City',
    })
    await typeInto(wrapper.find('#when'), '')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })
})
