import { cleanText } from '@/lib/text'
import type { Json } from '@/types/database'
import type { Person } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'
import { updateVersioned } from './rows'
import { cleanStay, type NewStayInput } from './stays'

export interface NewPersonInput {
  first_name: string
  last_name?: string | null
  birth_date?: string | null
  birth_date_estimated?: boolean
  gender_code?: string | null
  country_code?: string | null
  region?: string | null
  carer_id?: string | null
}

export type PersonPatch = Partial<NewPersonInput>

/** Trims names and region the same way the database does. */
function cleanPerson(input: PersonPatch): PersonPatch {
  const cleaned: PersonPatch = { ...input }
  if ('first_name' in input) cleaned.first_name = cleanText(input.first_name) ?? ''
  if ('last_name' in input) cleaned.last_name = cleanText(input.last_name)
  if ('region' in input) cleaned.region = cleanText(input.region)
  return cleaned
}

/** Creates the person and opens their first stay in one transaction. */
export async function registerAndCheckIn(
  person: NewPersonInput,
  stay: NewStayInput,
): Promise<{ person_id: string; stay_id: string }> {
  const { data, error } = await supabase.rpc('register_person_and_check_in', {
    p_person: cleanPerson(person) as unknown as Json,
    p_stay: cleanStay(stay) as unknown as Json,
  })
  if (error) throw toApiError(error)
  return data as unknown as { person_id: string; stay_id: string }
}

export interface PersonSearchResult {
  person_id: string
  first_name: string
  last_name: string | null
  birth_date: string | null
  birth_date_estimated: boolean
  country_code: string | null
  photo_path: string | null
  score: number
  last_entry_date: string | null
  last_exit_date: string | null
  has_open_stay: boolean
}

export type DuplicateCandidate = Omit<PersonSearchResult, 'has_open_stay'>

/** Up to 5 likely matches, best first. Merged records are never suggested. */
export async function findPossibleDuplicates(input: {
  first_name: string
  last_name?: string | null
  birth_date?: string | null
  country_code?: string | null
}): Promise<DuplicateCandidate[]> {
  const { data, error } = await supabase.rpc('find_possible_duplicates', {
    p_first_name: cleanText(input.first_name) ?? '',
    p_last_name: cleanText(input.last_name) ?? undefined,
    p_birth_date: input.birth_date ?? undefined,
    p_country_code: input.country_code ?? undefined,
  })
  if (error) throw toApiError(error)
  return (data ?? []) as DuplicateCandidate[]
}

export async function getPerson(id: string): Promise<Person> {
  const { data, error } = await supabase.from('people').select('*').eq('id', id).single()
  if (error) throw toApiError(error)
  return data
}

/** Saves only if nobody changed the record since `expectedUpdatedAt`; otherwise throws stale_record. */
export async function updatePerson(
  id: string,
  expectedUpdatedAt: string,
  patch: PersonPatch,
): Promise<Person> {
  return updateVersioned('people', { column: 'id', value: id }, expectedUpdatedAt, cleanPerson(patch))
}

/** Searches the whole history, best matches first. Merged records are never returned. */
export async function searchPeople(query: string, limit = 50): Promise<PersonSearchResult[]> {
  const { data, error } = await supabase.rpc('search_people', { p_query: query, p_limit: limit })
  if (error) throw toApiError(error)
  return (data ?? []) as PersonSearchResult[]
}

/** Admin only. Moves the duplicate's stays to the survivor; the survivor's details are kept. */
export async function mergePeople(survivorId: string, duplicateId: string): Promise<void> {
  const { error } = await supabase.rpc('merge_people', { p_survivor_id: survivorId, p_duplicate_id: duplicateId })
  if (error) throw toApiError(error)
}
