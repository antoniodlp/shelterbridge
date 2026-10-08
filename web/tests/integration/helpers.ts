import { signInWithPassword, signOut } from '@/api/auth'
import { setOperatorName, supabase } from '@/api/client'
import type { AppRole } from '@/types/domain'

// Seeded by supabase/seed.sql for local development only.
export const DEV_PASSWORD = 'shelterbridge-dev'

export function devEmail(role: AppRole): string {
  return `${role}@shelterbridge.test`
}

// Signs the shared client in as the seeded user for a role, with no operator name.
export async function signInAs(role: AppRole): Promise<void> {
  setOperatorName(null)
  await signInWithPassword(devEmail(role), DEV_PASSWORD)
}

// signOut() ends only this client's own session (scope 'local'), so a test run does not
// sign out a developer's open browser session for the same dev user.
export async function signOutQuietly(): Promise<void> {
  setOperatorName(null)
  await signOut().catch(() => undefined)
}

// Makes fictitious test data unique across runs.
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export { supabase }
