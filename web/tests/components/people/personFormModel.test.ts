import { describe, expect, it } from 'vitest'
import {
  emptyPerson,
  formToPersonInput,
  isMinorOn,
  personToForm,
  validatePerson,
} from '@/components/people/personFormModel'
import { makePerson, uuid } from '../../fixtures/data'

const today = '2026-10-07'

describe('validatePerson', () => {
  it('requires a first name', () => {
    expect(validatePerson({ ...emptyPerson(), first_name: '   ' }, today)).toEqual({
      first_name: 'validation.required',
    })
  })

  it('rejects a birth date after today', () => {
    expect(validatePerson({ ...emptyPerson(), first_name: 'Ana', birth_date: '2026-10-08' }, today)).toEqual({
      birth_date: 'validation.dateInFuture',
    })
  })

  it('rejects a birth date before 1900', () => {
    expect(validatePerson({ ...emptyPerson(), first_name: 'Ana', birth_date: '1899-12-31' }, today)).toEqual({
      birth_date: 'validation.birthDateImplausible',
    })
  })

  it('accepts a person with a single name and nothing else', () => {
    expect(validatePerson({ ...emptyPerson(), first_name: 'Wilmer' }, today)).toEqual({})
  })
})

describe('isMinorOn', () => {
  it('is true the day before the 18th birthday and false on it', () => {
    expect(isMinorOn('2008-10-08', today)).toBe(true)
    expect(isMinorOn('2008-10-07', today)).toBe(false)
  })

  it('is false when the birth date is unknown', () => {
    expect(isMinorOn(null, today)).toBe(false)
  })
})

describe('formToPersonInput', () => {
  it('keeps the carer for a minor', () => {
    const input = formToPersonInput(
      { ...emptyPerson(), first_name: 'Lucía', birth_date: '2016-01-01', carer_id: uuid(1) },
      today,
    )
    expect(input.carer_id).toBe(uuid(1))
  })

  it('drops the carer when the person is not a minor or the age is unknown', () => {
    expect(
      formToPersonInput({ ...emptyPerson(), first_name: 'Ana', birth_date: '1990-01-01', carer_id: uuid(1) }, today)
        .carer_id,
    ).toBeNull()
    expect(formToPersonInput({ ...emptyPerson(), first_name: 'Ana', carer_id: uuid(1) }, today).carer_id).toBeNull()
  })

  it('clears the estimated flag when there is no birth date', () => {
    expect(
      formToPersonInput({ ...emptyPerson(), first_name: 'Ana', birth_date_estimated: true }, today)
        .birth_date_estimated,
    ).toBe(false)
  })
})

describe('personToForm', () => {
  it('turns missing text into empty strings for the inputs', () => {
    const form = personToForm(makePerson({ last_name: null, region: null }))
    expect(form.last_name).toBe('')
    expect(form.region).toBe('')
    expect(form.first_name).toBe('Rosa Elena')
  })
})
