import type { CurrentResident } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'

export async function listCurrentResidents(): Promise<CurrentResident[]> {
  const { data, error } = await supabase.from('current_residents').select('*').order('first_name')
  if (error) throw toApiError(error)
  return data ?? []
}
