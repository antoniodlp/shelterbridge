// Creates fictitious people and stays straight through the client, so each
// integration test owns its data and never depends on seeded people.
import { todayIn } from '@/lib/shelterTime'
import { supabase, uniqueSuffix } from './helpers'

export const SHELTER_TZ = 'America/Mexico_City'

/** The shelter-local calendar date `days` before today, as 'YYYY-MM-DD'. */
export function daysAgo(days: number): string {
  const date = new Date(`${todayIn(SHELTER_TZ)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

export interface PersonFields {
  first_name?: string
  last_name?: string | null
  birth_date?: string | null
  country_code?: string | null
}

export interface StayFields {
  entry_date?: string
  exit_date?: string | null
  bed?: string | null
}

export async function createPerson(fields: PersonFields = {}): Promise<string> {
  const { data, error } = await supabase
    .from('people')
    .insert({ first_name: `Prueba ${uniqueSuffix()}`, last_name: 'Integración', ...fields })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function createStay(personId: string, fields: StayFields = {}): Promise<string> {
  const { data, error } = await supabase
    .from('stays')
    .insert({ person_id: personId, ...fields })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function createResident(
  person: PersonFields = {},
  stay: StayFields = {},
): Promise<{ personId: string; stayId: string }> {
  const personId = await createPerson(person)
  const stayId = await createStay(personId, stay)
  return { personId, stayId }
}
