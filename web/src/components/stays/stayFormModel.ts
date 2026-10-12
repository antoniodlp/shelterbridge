import type { NewStayInput, StayPatch } from '@/api/stays'
import type { FieldErrors } from '@/components/forms/fieldErrors'
import type { PhoneStatus, Stay } from '@/types/domain'

/** Every phone status, in the order the forms and the residents grid offer them. */
export const PHONE_STATUSES: readonly PhoneStatus[] = ['none', 'with_person', 'in_custody']

export interface StayFormValue {
  entry_date: string | null
  exit_date: string | null
  case_type_code: string | null
  bed: string
  phone_status: PhoneStatus
  notes: string
}

export function emptyStay(today: string): StayFormValue {
  return { entry_date: today, exit_date: null, case_type_code: null, bed: '', phone_status: 'none', notes: '' }
}

export function stayToForm(stay: Stay): StayFormValue {
  return {
    entry_date: stay.entry_date,
    exit_date: stay.exit_date,
    case_type_code: stay.case_type_code,
    bed: stay.bed ?? '',
    phone_status: stay.phone_status as PhoneStatus,
    notes: stay.notes ?? '',
  }
}

export function formToStayInput(value: StayFormValue): NewStayInput {
  return {
    entry_date: value.entry_date ?? undefined,
    case_type_code: value.case_type_code,
    bed: value.bed,
    phone_status: value.phone_status,
    notes: value.notes,
  }
}

/** The exit date is editable only on a stay that is already closed. */
export function formToStayPatch(value: StayFormValue, closed: boolean): StayPatch {
  const patch: StayPatch = formToStayInput(value)
  if (closed) patch.exit_date = value.exit_date
  return patch
}

export function validateStay(value: StayFormValue, today: string, closed = false): FieldErrors {
  const errors: FieldErrors = {}
  if (!value.entry_date) errors.entry_date = 'validation.required'
  else if (value.entry_date > today) errors.entry_date = 'validation.dateInFuture'
  if (closed) {
    if (!value.exit_date) errors.exit_date = 'validation.required'
    else if (value.exit_date > today) errors.exit_date = 'validation.dateInFuture'
    else if (value.entry_date && value.exit_date < value.entry_date) {
      errors.exit_date = 'validation.exitBeforeEntry'
    }
  }
  return errors
}
