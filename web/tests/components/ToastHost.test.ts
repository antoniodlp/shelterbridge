import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ToastHost from '@/components/common/ToastHost.vue'
import { ApiError } from '@/api/errors'
import { pendingNotifications, useNotify } from '@/composables/useNotify'
import { useOnline } from '@/composables/useOnline'
import { i18n } from '@/i18n'

afterEach(() => {
  pendingNotifications.value.splice(0)
  document.body.innerHTML = ''
})

describe('useNotify', () => {
  it('queues a translated success message', () => {
    useNotify().success('auth.passwordSaved')
    expect(pendingNotifications.value.at(-1)).toMatchObject({ kind: 'success', text: 'Listo, tu contraseña quedó guardada.' })
  })

  it('queues the translated message for an ApiError', () => {
    useNotify().error(new ApiError('stale_record'))
    expect(pendingNotifications.value.at(-1)?.text).toBe(i18n.global.t('errors.stale_record'))
  })

  it('maps raw errors through toApiError', () => {
    useNotify().error({ code: '23P01', message: 'conflicting key value' })
    expect(pendingNotifications.value.at(-1)?.text).toBe(i18n.global.t('errors.overlapping_stays'))
  })

  it('marks the app offline on a network error', () => {
    const { online } = useOnline()
    useNotify().error(new ApiError('network'))
    expect(online.value).toBe(false)
  })
})

describe('ToastHost', () => {
  it('shows queued notifications as toasts', async () => {
    const wrapper = mount(ToastHost, { attachTo: document.body, global: { plugins: [i18n] } })
    useNotify().error(new ApiError('not_authorized'))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('No tienes permiso para hacer esto.')
    expect(pendingNotifications.value).toHaveLength(0)
    wrapper.unmount()
  })

  it('shows notifications queued before the host mounted', async () => {
    useNotify().error(new ApiError('not_authorized'))
    const wrapper = mount(ToastHost, { attachTo: document.body, global: { plugins: [i18n] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('No tienes permiso para hacer esto.')
    expect(pendingNotifications.value).toHaveLength(0)
    wrapper.unmount()
  })

  it('shows names as plain text, never as HTML', async () => {
    const wrapper = mount(ToastHost, { attachTo: document.body, global: { plugins: [i18n] } })
    useNotify().success('nav.onShift', { name: '<b>Ana</b>' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const toast = document.body.querySelector('.e-toast')
    expect(toast?.textContent).toContain('De turno: <b>Ana</b>')
    expect(toast?.querySelector('b')).toBeNull()
    wrapper.unmount()
  })
})
