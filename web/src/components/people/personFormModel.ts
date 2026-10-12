import type { NewPersonInput } from '@/api/people'
import type { FieldErrors } from '@/components/forms/fieldErrors'
import { ageOn } from '@/lib/shelterTime'
import { cleanText } from '@/lib/text'
import type { Person } from '@/types/domain'

export interface PersonFormValue {
  first_name: string
  last_name: string
  birth_date: string | null
  gender_code: string | null
  country_code: string | null
  region: string
  carer_id: string | null
}

/** Mirrors the database check on people.birth_date. */
export const OLDEST_BIRTH_DATE = '1900-01-01'

export function emptyPerson(): PersonFormValue {
  return {
    first_name: '',
    last_name: '',
    birth_date: null,
    gender_code: null,
    country_code: null,
    region: '',
    carer_id: null,
  }
}

export function personToForm(person: Person): PersonFormValue {
  return {
    first_name: person.first_name,
    last_name: person.last_name ?? '',
    birth_date: person.birth_date,
    gender_code: person.gender_code,
    country_code: person.country_code,
    region: person.region ?? '',
    carer_id: person.carer_id,
  }
}

export function isMinorOn(birthDate: string | null, today: string): boolean {
  const age = ageOn(birthDate, today)
  return age !== null && age < 18
}

/** The carer only applies to minors; it is cleared whenever the picker is hidden. */
export function formToPersonInput(value: PersonFormValue, today: string): NewPersonInput {
  return {
    first_name: value.first_name,
    last_name: value.last_name,
    birth_date: value.birth_date,
    gender_code: value.gender_code,
    country_code: value.country_code,
    region: value.region,
    carer_id: isMinorOn(value.birth_date, today) ? value.carer_id : null,
  }
}

export function validatePerson(value: PersonFormValue, today: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!cleanText(value.first_name)) errors.first_name = 'validation.required'
  if (value.birth_date && value.birth_date > today) {
    errors.birth_date = 'validation.dateInFuture'
  } else if (value.birth_date && value.birth_date < OLDEST_BIRTH_DATE) {
    errors.birth_date = 'validation.birthDateImplausible'
  }
  return errors
}
