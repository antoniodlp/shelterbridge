import type { FieldErrors } from '@/components/forms/fieldErrors'
import type { Outing } from '@/types/domain'

export interface OutingFormValue {
  left_at: string | null
  returned_at: string | null
  comment: string
}

export type OutingPatch = Partial<Pick<Outing, 'left_at' | 'returned_at' | 'comment'>>

export function outingToForm(outing: Outing): OutingFormValue {
  return { left_at: outing.left_at, returned_at: outing.returned_at, comment: outing.comment ?? '' }
}

/** Mirrors the database: no times later than now, and the return after leaving. */
export function validateOuting(value: OutingFormValue, now: Date): FieldErrors {
  const errors: FieldErrors = {}
  const nowMs = now.getTime()
  if (!value.left_at) errors.left_at = 'validation.required'
  else if (Date.parse(value.left_at) > nowMs) errors.left_at = 'outings.validation.future'
  if (value.returned_at) {
    if (Date.parse(value.returned_at) > nowMs) errors.returned_at = 'outings.validation.future'
    else if (value.left_at && Date.parse(value.returned_at) <= Date.parse(value.left_at)) {
      errors.returned_at = 'outings.validation.returnBeforeLeave'
    }
  }
  return errors
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return Date.parse(a) === Date.parse(b)
}

/** Only the fields that changed, so untouched times keep their exact value. */
export function formToOutingPatch(value: OutingFormValue, original: Outing): OutingPatch {
  const patch: OutingPatch = {}
  if (value.left_at && !sameInstant(value.left_at, original.left_at)) patch.left_at = value.left_at
  if (!sameInstant(value.returned_at, original.returned_at)) patch.returned_at = value.returned_at
  if (value.comment !== (original.comment ?? '')) patch.comment = value.comment
  return patch
}
