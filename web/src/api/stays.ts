import type { CurrentResident } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'

export async function listCurrentResidents(): Promise<CurrentResident[]> {
  const { data, error } = await supabase.from('current_residents').select('*').order('first_name')
  if (error) throw toApiError(error)
  return data ?? []
}

/** Closes a stay. The exit date defaults to today in the shelter timezone on the server. */
export async function checkOut(stayId: string, exitDate?: string): Promise<void> {
  const { error } = await supabase.rpc('check_out', { p_stay_id: stayId, p_exit_date: exitDate })
  if (error) throw toApiError(error)
}
