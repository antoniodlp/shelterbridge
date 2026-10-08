import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ConfirmHost from '@/components/common/ConfirmHost.vue'
import { activeConfirm, useConfirm } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

function buttonWithText(text: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)
  if (!button) throw new Error(`No button "${text}"`)
  return button
}

afterEach(() => {
  activeConfirm.value = null
  document.body.innerHTML = ''
})

describe('useConfirm with ConfirmHost', () => {
  it('shows the question and resolves true on confirm', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const answer = useConfirm().confirm({ titleKey: 'shift.title', messageKey: 'errors.outing_exception_needs_confirmation' })
    await flushPromises()
    expect(document.body.textContent).toContain('Ya salió hoy, ¿registrar como excepción?')
    buttonWithText('Confirmar').click()
    await expect(answer).resolves.toBe(true)
    wrapper.unmount()
  })

  it('resolves false on cancel, with custom button labels', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const answer = useConfirm().confirm({
      titleKey: 'shift.title',
      messageKey: 'errors.unknown',
      confirmKey: 'common.continue',
      cancelKey: 'common.close',
    })
    await flushPromises()
    buttonWithText('Cerrar').click()
    await expect(answer).resolves.toBe(false)
    wrapper.unmount()
  })

  it('resolves false when the close icon is used', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const answer = useConfirm().confirm({ titleKey: 'shift.title', messageKey: 'errors.unknown' })
    await flushPromises()
    const closeIcon = document.body.querySelector<HTMLButtonElement>('.e-dlg-closeicon-btn')
    expect(closeIcon).not.toBeNull()
    closeIcon?.click()
    await expect(answer).resolves.toBe(false)
    wrapper.unmount()
  })

  it('a confirmed question does not cancel the next one', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const { confirm } = useConfirm()
    const first = confirm({ titleKey: 'shift.title', messageKey: 'errors.unknown' })
    await flushPromises()
    buttonWithText('Confirmar').click()
    await expect(first).resolves.toBe(true)
    const second = confirm({ titleKey: 'shift.title', messageKey: 'errors.network' })
    await flushPromises()
    expect(activeConfirm.value?.options.messageKey).toBe('errors.network')
    expect(document.body.querySelector('[data-testid="confirm-message"]')?.textContent).toBe(
      'Sin conexión. Revisa el internet e inténtalo de nuevo.',
    )
    buttonWithText('Confirmar').click()
    await expect(second).resolves.toBe(true)
    wrapper.unmount()
  })

  it('shows message parameters as plain text, never as HTML', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    void useConfirm().confirm({ titleKey: 'shift.title', messageKey: 'nav.onShift', messageParams: { name: '<b>Ana</b>' } })
    await flushPromises()
    const message = document.body.querySelector('[data-testid="confirm-message"]')
    expect(message?.textContent).toBe('De turno: <b>Ana</b>')
    expect(document.body.querySelector('.e-dialog b')).toBeNull()
    wrapper.unmount()
  })

  it('answers false to an open question when a new one is asked', async () => {
    const { confirm } = useConfirm()
    const first = confirm({ titleKey: 'shift.title', messageKey: 'errors.unknown' })
    const second = confirm({ titleKey: 'shift.title', messageKey: 'errors.network' })
    await expect(first).resolves.toBe(false)
    expect(activeConfirm.value?.options.messageKey).toBe('errors.network')
    activeConfirm.value?.resolve(true)
    await expect(second).resolves.toBe(true)
  })
})
