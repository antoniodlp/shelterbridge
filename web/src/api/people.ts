import { cleanText } from '@/lib/text'
import type { Json } from '@/types/database'
import { supabase } from './client'
import { toApiError } from './errors'
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
