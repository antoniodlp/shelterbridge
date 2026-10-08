import { supabase } from './client'
import { toApiError } from './errors'
import { updateVersioned } from './rows'

export interface ShelterSettings {
  timezone: string
  timezone_updated_at: string
}

export async function getSettings(): Promise<ShelterSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value, updated_at')
    .eq('key', 'timezone')
    .single()
  if (error) throw toApiError(error)
  return { timezone: String(data.value), timezone_updated_at: data.updated_at }
}

/** Saves only if nobody changed the timezone since `expectedUpdatedAt`. */
export async function updateTimezone(timezone: string, expectedUpdatedAt: string): Promise<void> {
  await updateVersioned('settings', { column: 'key', value: 'timezone' }, expectedUpdatedAt, { value: timezone })
}
