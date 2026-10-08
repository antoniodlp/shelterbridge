import { describe, expect, it } from 'vitest'
import {
  catalogItemToForm,
  emptyCatalogItem,
  formToPayload,
  validateCatalogItem,
} from '@/components/admin/catalogItemModel'
import { STAMP } from '../../fixtures/data'

describe('validateCatalogItem', () => {
  it('requires two capital letters for a country code', () => {
    const form = { ...emptyCatalogItem(), code: 'mx', label_es: 'México' }
    expect(validateCatalogItem('countries', form, true)).toEqual({ code: 'admin.catalogs.validation.codeInvalid' })
    expect(validateCatalogItem('countries', { ...form, code: 'MX' }, true)).toEqual({})
  })

  it('requires a lowercase slug for other catalogs', () => {
    const form = { ...emptyCatalogItem(), code: 'Solicitante Asilo', label_es: 'Solicitante de asilo' }
    expect(validateCatalogItem('case_types', form, true)).toEqual({ code: 'admin.catalogs.validation.codeInvalid' })
    expect(validateCatalogItem('case_types', { ...form, code: 'solicitante_asilo' }, true)).toEqual({})
  })

  it('does not check the code when editing, because it cannot change', () => {
    expect(validateCatalogItem('genders', { ...emptyCatalogItem(), code: 'X', label_es: 'Mujer' }, false)).toEqual({})
  })

  it('requires a Spanish label and a whole number order', () => {
    expect(
      validateCatalogItem('genders', { ...emptyCatalogItem(), code: 'otra', label_es: ' ', sort_order: '1.5' }, true),
    ).toEqual({
      label_es: 'validation.required',
      sort_order: 'admin.catalogs.validation.orderInvalid',
    })
  })
})

describe('sort order', () => {
  it('must fit a database integer', () => {
    const form = { ...emptyCatalogItem(), code: 'otra', label_es: 'Otra' }
    expect(validateCatalogItem('genders', { ...form, sort_order: '2147483648' }, true)).toEqual({
      sort_order: 'admin.catalogs.validation.orderInvalid',
    })
    expect(validateCatalogItem('genders', { ...form, sort_order: '-2147483647' }, true)).toEqual({})
  })
})

describe('formToPayload', () => {
  it('trims labels, drops an empty English label and keeps other languages', () => {
    const labels = { es: 'Mujer', en: 'Woman', fr: 'Femme' }
    const item = { code: 'female', labels, sort_order: 1, active: true, updated_at: STAMP }
    const form = { ...catalogItemToForm(item), label_es: ' Mujer ', label_en: ' ' }
    expect(formToPayload(form, labels)).toEqual({
      code: 'female',
      labels: { es: 'Mujer', fr: 'Femme' },
      sort_order: 1,
      active: true,
    })
  })
})
