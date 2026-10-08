import { AuthApiError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import { isApiError } from '@/api/errors'

const supabaseAuth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('@/api/client', () => ({ supabase: { auth: supabaseAuth } }))

afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

describe('api/auth redirects', () => {
  it('Google sign-in comes back to the residents page', async () => {
    supabaseAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    await auth.signInWithGoogle()
    expect(supabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/residents` },
    })
  })

  it('the confirmation email comes back to the residents page', async () => {
    supabaseAuth.signUp.mockResolvedValue({ data: {}, error: null })
    await auth.signUp('legal@shelterbridge.test', 'una-clave-larga')
    expect(supabaseAuth.signUp).toHaveBeenCalledWith({
      email: 'legal@shelterbridge.test',
      password: 'una-clave-larga',
      options: { emailRedirectTo: `${window.location.origin}/residents` },
    })
  })

  it('the reset email comes back to the reset-password page', async () => {
    supabaseAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    await auth.requestPasswordReset('admin@shelterbridge.test')
    expect(supabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith('admin@shelterbridge.test', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('updatePassword sets the new password', async () => {
    supabaseAuth.updateUser.mockResolvedValue({ data: {}, error: null })
    await auth.updatePassword('una-clave-nueva')
    expect(supabaseAuth.updateUser).toHaveBeenCalledWith({ password: 'una-clave-nueva' })
  })
})

describe('api/auth sign out', () => {
  // The shelter shares one volunteer account across reception computers, so signing out
  // on one computer must not end the session on the others.
  it('signs out this device only, not every session of the account', async () => {
    supabaseAuth.signOut.mockResolvedValue({ error: null })
    await auth.signOut()
    expect(supabaseAuth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

describe('api/auth errors', () => {
  it('maps the sign-up hook rejection (403) to not_invited', async () => {
    supabaseAuth.signUp.mockResolvedValue({ data: {}, error: new AuthApiError('not invited', 403, undefined) })
    const error = await auth.signUp('stranger@example.test', 'una-clave-larga').catch((e: unknown) => e)
    expect(isApiError(error, 'not_invited')).toBe(true)
  })

  it('maps other sign-up errors through toApiError', async () => {
    supabaseAuth.signUp.mockResolvedValue({ data: {}, error: new AuthApiError('weak', 422, 'weak_password') })
    const error = await auth.signUp('legal@shelterbridge.test', 'x').catch((e: unknown) => e)
    expect(isApiError(error, 'validation')).toBe(true)
  })
})

describe('onAuthChange', () => {
  it('calls back outside the Supabase auth lock and can unsubscribe', () => {
    vi.useFakeTimers()
    const unsubscribe = vi.fn()
    let handler: ((event: string, session: unknown) => void) | undefined
    supabaseAuth.onAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
      handler = callback
      return { data: { subscription: { unsubscribe } } }
    })
    const callback = vi.fn()
    const stop = auth.onAuthChange(callback)
    handler?.('SIGNED_OUT', null)
    expect(callback).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(callback).toHaveBeenCalledWith(null)
    stop()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
