import { describe, expect, it } from 'vitest'
import { formToOutingPatch, outingToForm, validateOuting } from '@/components/outings/outingFormModel'
import { makeOuting } from '../../fixtures/data'

const now = new Date('2026-10-07T18:00:00Z')

describe('validateOuting', () => {
  it('requires the time the person left', () => {
    expect(validateOuting({ left_at: null, returned_at: null, comment: '' }, now)).toEqual({
      left_at: 'validation.required',
    })
  })

  it('rejects times later than now', () => {
    expect(
      validateOuting({ left_at: '2026-10-07T18:05:00Z', returned_at: '2026-10-07T18:10:00Z', comment: '' }, now),
    ).toEqual({ left_at: 'outings.validation.future', returned_at: 'outings.validation.future' })
  })

  it('requires the return to come after leaving', () => {
    expect(
      validateOuting({ left_at: '2026-10-07T16:00:00Z', returned_at: '2026-10-07T16:00:00Z', comment: '' }, now),
    ).toEqual({ returned_at: 'outings.validation.returnBeforeLeave' })
  })

  it('accepts an outing with no return yet', () => {
    expect(validateOuting({ left_at: '2026-10-07T16:00:00Z', returned_at: null, comment: '' }, now)).toEqual({})
  })
})

describe('formToOutingPatch', () => {
  it('sends only what changed, so untouched times keep their seconds', () => {
    const original = makeOuting({ left_at: '2026-10-06T16:00:27+00:00', returned_at: null, comment: null })
    const form = outingToForm(original)
    expect(formToOutingPatch(form, original)).toEqual({})
    form.returned_at = '2026-10-06T19:00:00.000Z'
    form.comment = 'Regresó tarde'
    expect(formToOutingPatch(form, original)).toEqual({
      returned_at: '2026-10-06T19:00:00.000Z',
      comment: 'Regresó tarde',
    })
  })
})
