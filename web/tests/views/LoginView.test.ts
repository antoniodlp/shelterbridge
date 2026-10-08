import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import { ApiError } from '@/api/errors'
import { useOnline } from '@/composables/useOnline'
import { useSessionStore } from '@/stores/session'
import LoginView from '@/views/LoginView.vue'
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
  vi.resetAllMocks()
})

function mockSuccessfulSignIn(): void {
  vi.mocked(auth.signInWithPassword).mockResolvedValue()
  vi.mocked(auth.getSession).mockResolvedValue({ user: { id: 'user-1' } } as unknown as auth.Session)
  vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser('volunteer'))
}

async function mountLogin(initialRoute = '/login') {
  return mountWithApp(LoginView, { initialRoute, session: { role: null } })
}

function buttonByText(wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper'], text: string) {
  const button = wrapper.findAll('button').find((b) => b.text() === text)
  if (!button) throw new Error(`No button "${text}"`)
  return button
}

describe('LoginView', () => {
  it('signs in with email and password and follows the redirect', async () => {
    mockSuccessfulSignIn()
    const { wrapper, router } = await mountLogin('/login?redirect=/people/search')
    await wrapper.get('#login-email').setValue('  volunteer@shelterbridge.test ')
    await wrapper.get('#login-password').setValue('shelterbridge-dev')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.signInWithPassword).toHaveBeenCalledWith('volunteer@shelterbridge.test', 'shelterbridge-dev')
    expect(useSessionStore().refreshAppUser).toHaveBeenCalled()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/people/search'))
  })

  it.each(['//evil.example', '/\\evil.example'])('ignores a redirect to another site (%s)', async (target) => {
    mockSuccessfulSignIn()
    const { wrapper, router } = await mountLogin(`/login?redirect=${encodeURIComponent(target)}`)
    expect(router.currentRoute.value.query.redirect).toBe(target)
    await wrapper.get('#login-email').setValue('admin@shelterbridge.test')
    await wrapper.get('#login-password').setValue('shelterbridge-dev')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
  })

  it.each([
    ['invalid_credentials', 'El correo o la contraseña no son correctos.'],
    ['email_not_confirmed', 'Todavía no confirmas tu correo. Busca el mensaje que te enviamos y sigue el enlace.'],
    ['network', 'Sin conexión. Revisa el internet e inténtalo de nuevo.'],
  ] as const)('shows the Spanish message for %s', async (code, message) => {
    vi.mocked(auth.signInWithPassword).mockRejectedValue(new ApiError(code))
    const { wrapper } = await mountLogin()
    await wrapper.get('#login-email').setValue('admin@shelterbridge.test')
    await wrapper.get('#login-password').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe(message)
  })

  it('keeps what was typed after a failure', async () => {
    vi.mocked(auth.signInWithPassword).mockRejectedValue(new ApiError('invalid_credentials'))
    const { wrapper } = await mountLogin()
    await wrapper.get('#login-email').setValue('admin@shelterbridge.test')
    await wrapper.get('#login-password').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect((wrapper.get('#login-email').element as HTMLInputElement).value).toBe('admin@shelterbridge.test')
  })

  it('requires an email before calling Supabase', async () => {
    const { wrapper } = await mountLogin()
    await wrapper.get('#login-email').setValue('   ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('Este dato es obligatorio.')
  })

  it('starts Google sign-in', async () => {
    vi.mocked(auth.signInWithGoogle).mockResolvedValue()
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, 'Entrar con Google').trigger('click')
    expect(auth.signInWithGoogle).toHaveBeenCalled()
  })

  it('explains a failed Google sign-in', async () => {
    const { wrapper } = await mountLogin('/login?error=oauth')
    expect(wrapper.get('[data-testid="login-error"]').text()).toContain('No se pudo entrar con Google')
  })

  it('creates a first password and asks to confirm the email', async () => {
    vi.mocked(auth.signUp).mockResolvedValue()
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, '¿Es tu primera vez? Crea tu contraseña').trigger('click')
    await wrapper.get('#login-email').setValue('legal@shelterbridge.test')
    await wrapper.get('#login-password').setValue('una-clave-larga')
    await wrapper.get('#login-confirm').setValue('una-clave-larga')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.signUp).toHaveBeenCalledWith('legal@shelterbridge.test', 'una-clave-larga')
    expect(wrapper.get('[data-testid="login-info"]').text()).toContain('Te enviamos un correo')
  })

  it('tells an uninvited person to ask for access', async () => {
    vi.mocked(auth.signUp).mockRejectedValue(new ApiError('not_invited'))
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, '¿Es tu primera vez? Crea tu contraseña').trigger('click')
    await wrapper.get('#login-email').setValue('stranger@example.test')
    await wrapper.get('#login-password').setValue('una-clave-larga')
    await wrapper.get('#login-confirm').setValue('una-clave-larga')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe(
      'Este correo no tiene invitación a ShelterBridge. Pide acceso a una persona de administración.',
    )
  })

  it('checks the new password length and confirmation', async () => {
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, '¿Es tu primera vez? Crea tu contraseña').trigger('click')
    await wrapper.get('#login-email').setValue('legal@shelterbridge.test')
    await wrapper.get('#login-password').setValue('corta')
    await wrapper.get('#login-confirm').setValue('corta')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('La contraseña debe tener al menos 8 caracteres.')
    await wrapper.get('#login-password').setValue('una-clave-larga')
    await wrapper.get('#login-confirm').setValue('otra-clave-larga')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('Las contraseñas no coinciden.')
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('sends a password reset link', async () => {
    vi.mocked(auth.requestPasswordReset).mockResolvedValue()
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, '¿Olvidaste tu contraseña?').trigger('click')
    expect(wrapper.find('#login-password').exists()).toBe(false)
    await wrapper.get('#login-email').setValue('psychology@shelterbridge.test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('psychology@shelterbridge.test')
    expect(wrapper.get('[data-testid="login-info"]').text()).toContain('te llegará un enlace')
  })

  describe('when the request fails with a network error', () => {
    it('marks the app offline after a failed sign-in', async () => {
      vi.mocked(auth.signInWithPassword).mockRejectedValue(new ApiError('network'))
      const { online } = useOnline()
      const { wrapper } = await mountLogin()
      expect(online.value).toBe(true)
      await wrapper.get('#login-email').setValue('admin@shelterbridge.test')
      await wrapper.get('#login-password').setValue('shelterbridge-dev')
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(wrapper.get('[data-testid="login-error"]').text()).toBe('Sin conexión. Revisa el internet e inténtalo de nuevo.')
      expect(online.value).toBe(false)
    })

    it('marks the app offline after a failed password reset request', async () => {
      vi.mocked(auth.requestPasswordReset).mockRejectedValue(new ApiError('network'))
      const { online } = useOnline()
      const { wrapper } = await mountLogin()
      await buttonByText(wrapper, '¿Olvidaste tu contraseña?').trigger('click')
      await wrapper.get('#login-email').setValue('psychology@shelterbridge.test')
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(online.value).toBe(false)
    })

    it('marks the app offline after a failed Google sign-in', async () => {
      vi.mocked(auth.signInWithGoogle).mockRejectedValue(new ApiError('network'))
      const { online } = useOnline()
      const { wrapper } = await mountLogin()
      await buttonByText(wrapper, 'Entrar con Google').trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-testid="login-error"]').text()).toBe('Sin conexión. Revisa el internet e inténtalo de nuevo.')
      expect(online.value).toBe(false)
    })

    it('leaves the app online for other errors', async () => {
      vi.mocked(auth.signInWithPassword).mockRejectedValue(new ApiError('invalid_credentials'))
      const { online } = useOnline()
      const { wrapper } = await mountLogin()
      await wrapper.get('#login-email').setValue('admin@shelterbridge.test')
      await wrapper.get('#login-password').setValue('wrong-password')
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(online.value).toBe(true)
    })
  })
})
