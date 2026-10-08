import { supabase } from './client'
import { toApiError } from './errors'

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
