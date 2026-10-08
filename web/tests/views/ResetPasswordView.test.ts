import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import { ApiError } from '@/api/errors'
import { pendingNotifications } from '@/composables/useNotify'
import { useOnline } from '@/composables/useOnline'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import { fakeAppUser, mountWithApp } from '../utils/mountWithApp'

vi.mock('@/api/auth')

// reportNetworkFailure starts a 15 s timer that re-reads navigator.onLine. Faking the
// timer keeps it from firing during another test, and the flag is reset after each test.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  useOnline()
  window.dispatchEvent(new Event('online'))
  document.body.innerHTML = ''
  pendingNotifications.value.splice(0)
  sessionStorage.clear()
  vi.resetAllMocks()
})

describe('ResetPasswordView', () => {
  it('saves the new password and goes to residents', async () => {
    vi.mocked(auth.updatePassword).mockResolvedValue()
    vi.mocked(auth.getSession).mockResolvedValue({ user: { id: 'user-1' } } as unknown as auth.Session)
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser('admin'))
    const { wrapper, router } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: 'admin' } })
    await wrapper.get('#reset-password').setValue('una-clave-nueva')
    await wrapper.get('#reset-confirm').setValue('una-clave-nueva')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
    expect(auth.updatePassword).toHaveBeenCalledWith('una-clave-nueva')
    expect(pendingNotifications.value.at(-1)?.text).toBe('Listo, tu contraseña quedó guardada.')
  })

  it('rejects mismatched passwords', async () => {
    const { wrapper } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: 'admin' } })
    await wrapper.get('#reset-password').setValue('una-clave-nueva')
    await wrapper.get('#reset-confirm').setValue('otra-clave-nueva')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="reset-error"]').text()).toBe('Las contraseñas no coinciden.')
    expect(auth.updatePassword).not.toHaveBeenCalled()
  })

  it('shows the API error and keeps the form', async () => {
    vi.mocked(auth.updatePassword).mockRejectedValue(new ApiError('validation'))
    const { wrapper } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: 'admin' } })
    await wrapper.get('#reset-password').setValue('una-clave-nueva')
    await wrapper.get('#reset-confirm').setValue('una-clave-nueva')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="reset-error"]').text()).toBe('Revisa los datos, hay algo que no es válido.')
  })

  it('explains an expired link when there is no recovery session', async () => {
    const { wrapper } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: null } })
    expect(wrapper.get('[data-testid="reset-invalid"]').text()).toBe('El enlace no es válido o ya venció. Pide uno nuevo.')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('marks the app offline when saving fails with a network error', async () => {
    vi.mocked(auth.updatePassword).mockRejectedValue(new ApiError('network'))
    const { online } = useOnline()
    const { wrapper } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: 'admin' } })
    expect(online.value).toBe(true)
    await wrapper.get('#reset-password').setValue('una-clave-nueva')
    await wrapper.get('#reset-confirm').setValue('una-clave-nueva')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="reset-error"]').text()).toBe('Sin conexión. Revisa el internet e inténtalo de nuevo.')
    expect(online.value).toBe(false)
  })

  it('leaves the app online for other errors', async () => {
    vi.mocked(auth.updatePassword).mockRejectedValue(new ApiError('validation'))
    const { online } = useOnline()
    const { wrapper } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: 'admin' } })
    await wrapper.get('#reset-password').setValue('una-clave-nueva')
    await wrapper.get('#reset-confirm').setValue('una-clave-nueva')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(online.value).toBe(true)
  })
})
