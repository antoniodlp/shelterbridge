import { isAuthApiError, type Session } from '@supabase/supabase-js'
import type { AppUser } from '@/types/domain'
import { supabase } from './client'
import { ApiError, toApiError } from './errors'

export type { Session }

function appUrl(path: string): string {
  return `${window.location.origin}${path}`
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toApiError(error)
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: appUrl('/residents') },
  })
  if (error) throw toApiError(error)
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl('/residents') },
  })
  // The Before User Created hook answers 403 for emails that were not invited.
  if (isAuthApiError(error) && error.status === 403) throw new ApiError('not_invited')
  if (error) throw toApiError(error)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl('/reset-password'),
  })
  if (error) throw toApiError(error)
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw toApiError(error)
}

// The shelter shares one account (for example the volunteer) across reception computers.
// The default global scope would end the session on every computer, so only this one signs out.
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw toApiError(error)
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw toApiError(error)
  return data.session
}

// Supabase runs auth callbacks while holding its auth lock. Calling back into
// Supabase from inside one can deadlock, so the callback is deferred.
export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => callback(session), 0)
  })
  return () => data.subscription.unsubscribe()
}

export async function getMyAppUser(): Promise<AppUser | null> {
  const session = await getSession()
  if (!session) return null
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) throw toApiError(error)
  return data
}
