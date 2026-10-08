import { cleanText } from '@/lib/text'
import type { AppRole, AppUser } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'
import { updateVersioned } from './rows'

/** Admins see everyone; any other role sees only their own row. */
export async function listAppUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase.from('app_users').select('*').order('display_name')
  if (error) throw toApiError(error)
  return data ?? []
}

/** Adds an email to the allowlist. The person can then sign up or sign in with Google. */
export async function inviteUser(input: { email: string; role: AppRole; display_name: string }): Promise<AppUser> {
  const { data, error } = await supabase
    .from('app_users')
    .insert({
      email: input.email.trim().toLowerCase(),
      role: input.role,
      display_name: cleanText(input.display_name) ?? '',
    })
    .select('*')
    .single()
  if (error) throw toApiError(error)
  return data
}

export async function updateAppUser(
  email: string,
  expectedUpdatedAt: string,
  patch: Partial<Pick<AppUser, 'role' | 'display_name' | 'active'>>,
): Promise<AppUser> {
  return updateVersioned('app_users', { column: 'email', value: email }, expectedUpdatedAt, patch)
}
