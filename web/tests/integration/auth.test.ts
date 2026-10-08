import { afterEach, describe, expect, it } from 'vitest'
import { getMyAppUser, getSession, signInWithPassword, signUp } from '@/api/auth'
import { isApiError } from '@/api/errors'
import type { AppRole } from '@/types/domain'
import { devEmail, signInAs, signOutQuietly, supabase, uniqueSuffix } from './helpers'

afterEach(async () => {
  await signOutQuietly()
})

describe('api/auth against local Supabase', () => {
  it.each<AppRole>(['admin', 'legal', 'psychology', 'volunteer'])(
    'signs in as %s and reads their own app user',
    async (role) => {
      await signInAs(role)
      const appUser = await getMyAppUser()
      expect(appUser?.role).toBe(role)
      expect(appUser?.email).toBe(devEmail(role))
      expect(appUser?.active).toBe(true)
    },
  )

  it('rejects a wrong password with invalid_credentials', async () => {
    const error = await signInWithPassword(devEmail('volunteer'), 'not-the-password').catch((e: unknown) => e)
    expect(isApiError(error, 'invalid_credentials')).toBe(true)
  })

  it('rejects the sign-up of an email that was not invited with not_invited', async () => {
    const error = await signUp(`stranger-${uniqueSuffix()}@example.test`, 'una-clave-larga').catch((e: unknown) => e)
    expect(isApiError(error, 'not_invited')).toBe(true)
  })

  it('lets an invited email sign up, but not sign in before confirming', async () => {
    const email = `t-invited-${uniqueSuffix()}@example.test`
    await signInAs('admin')
    const { error: inviteError } = await supabase
      .from('app_users')
      .insert({ email, role: 'legal', display_name: 'Persona Invitada de Prueba' })
    expect(inviteError).toBeNull()
    await signOutQuietly()

    await signUp(email, 'una-clave-larga')
    const error = await signInWithPassword(email, 'una-clave-larga').catch((e: unknown) => e)
    expect(isApiError(error, 'email_not_confirmed')).toBe(true)
  })

  it('signs out', async () => {
    await signInAs('legal')
    expect(await getSession()).not.toBeNull()
    await signOutQuietly()
    expect(await getSession()).toBeNull()
    expect(await getMyAppUser()).toBeNull()
  })
})
