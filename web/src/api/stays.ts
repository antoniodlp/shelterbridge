import type { Json } from '@/types/database'
import type { CurrentResident, PhoneStatus, Stay } from '@/types/domain'
import { cleanText } from '@/lib/text'
import { supabase } from './client'
import { toApiError } from './errors'
import { deleteById, updateVersioned } from './rows'

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

export interface NewStayInput {
  entry_date?: string
  case_type_code?: string | null
  bed?: string | null
  phone_status?: PhoneStatus
  notes?: string | null
}

export type StayPatch = Partial<NewStayInput> & { exit_date?: string | null }

/** Trims free text the same way the database does, so what is saved matches what was checked. */
export function cleanStay(input: StayPatch): StayPatch {
  const cleaned: StayPatch = { ...input }
  if ('bed' in input) cleaned.bed = cleanText(input.bed)
  if ('notes' in input) cleaned.notes = cleanText(input.notes)
  return cleaned
}

/** Every stay of a person, newest entry first. */
export async function listStaysForPerson(personId: string): Promise<Stay[]> {
  const { data, error } = await supabase
    .from('stays')
    .select('*')
    .eq('person_id', personId)
    .order('entry_date', { ascending: false })
  if (error) throw toApiError(error)
  return data ?? []
}

/** Opens a new stay for someone already registered. Returns the stay id. */
export async function checkIn(personId: string, stay: NewStayInput): Promise<string> {
  const { data, error } = await supabase.rpc('check_in', {
    p_person_id: personId,
    p_stay: cleanStay(stay) as unknown as Json,
  })
  if (error) throw toApiError(error)
  return data as string
}

/** Saves only if nobody changed the stay since `expectedUpdatedAt`. `{ exit_date: null }` reopens it. */
export async function updateStay(id: string, expectedUpdatedAt: string, patch: StayPatch): Promise<Stay> {
  return updateVersioned('stays', { column: 'id', value: id }, expectedUpdatedAt, cleanStay(patch))
}

/** Admin only. Deleting a stay also deletes its outings. */
export async function deleteStay(id: string): Promise<void> {
  await deleteById('stays', id)
}
