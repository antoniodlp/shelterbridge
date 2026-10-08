import { describe, expect, it } from 'vitest'
import {
  emptyStay,
  formToStayInput,
  formToStayPatch,
  stayToForm,
  validateStay,
} from '@/components/stays/stayFormModel'
import { makeStay } from '../../fixtures/data'

const today = '2026-10-07'

describe('validateStay', () => {
  it('starts today with a phone status of none', () => {
    expect(emptyStay(today)).toEqual({
      entry_date: today,
      exit_date: null,
      case_type_code: null,
      bed: '',
      phone_status: 'none',
      notes: '',
    })
  })

  it('requires an entry date that is not in the future', () => {
    expect(validateStay({ ...emptyStay(today), entry_date: null }, today)).toEqual({
      entry_date: 'validation.required',
    })
    expect(validateStay({ ...emptyStay(today), entry_date: '2026-10-08' }, today)).toEqual({
      entry_date: 'validation.dateInFuture',
    })
  })

  it('checks the exit date only for a closed stay', () => {
    const value = { ...emptyStay(today), entry_date: '2026-10-05', exit_date: '2026-10-04' }
    expect(validateStay(value, today)).toEqual({})
    expect(validateStay(value, today, true)).toEqual({ exit_date: 'validation.exitBeforeEntry' })
    expect(validateStay({ ...value, exit_date: null }, today, true)).toEqual({
      exit_date: 'validation.required',
    })
    expect(validateStay({ ...value, exit_date: '2026-10-08' }, today, true)).toEqual({
      exit_date: 'validation.dateInFuture',
    })
  })
})

describe('form conversions', () => {
  it('sends the stay fields and leaves trimming to the API', () => {
    expect(formToStayInput({ ...emptyStay(today), bed: ' A1 ', notes: '' })).toEqual({
      entry_date: today,
      case_type_code: null,
      bed: ' A1 ',
      phone_status: 'none',
      notes: '',
    })
  })

  it('includes the exit date only when editing a closed stay', () => {
    const form = stayToForm(makeStay({ exit_date: '2026-10-05' }))
    expect(formToStayPatch(form, false)).not.toHaveProperty('exit_date')
    expect(formToStayPatch(form, true).exit_date).toBe('2026-10-05')
  })
})
