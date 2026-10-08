import { Internationalization, L10n } from '@syncfusion/ej2-base'
import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from '@/api/errors'
import { i18n, setLocale } from '@/i18n'
import esMX from '@/i18n/locales/es-MX.json'
import { missingI18nKeys } from '../utils/i18nGuard'

describe('i18n', () => {
  it('translates with es-MX by default', () => {
    expect(i18n.global.locale.value).toBe('es-MX')
    expect(i18n.global.t('shift.title')).toBe('¿Quién está de turno?')
  })

  it('throws on a missing key', () => {
    expect(() => i18n.global.t('nav.doesNotExist')).toThrow(/nav\.doesNotExist/)
    expect(missingI18nKeys.splice(0)).toEqual(['nav.doesNotExist'])
  })

  it('has a message for every API error code', () => {
    const errors = esMX.errors as Record<string, string>
    for (const code of API_ERROR_CODES) expect(errors[code], code).toBeTruthy()
  })

  it('has labels for every phone status and presence value', () => {
    expect(Object.keys(esMX.phoneStatus).sort()).toEqual(['in_custody', 'none', 'with_person'])
    expect(Object.keys(esMX.presence).sort()).toEqual(['inside', 'outside'])
  })
})

describe('setLocale', () => {
  it('sets <html lang>, Syncfusion texts and es-MX formats', async () => {
    await setLocale('es-MX')
    expect(document.documentElement.lang).toBe('es-MX')
    const texts = new L10n('dropdowns', { noRecordsTemplate: 'No records found' })
    expect(texts.getConstant('noRecordsTemplate')).toBe('No se encontraron registros')
    const intl = new Internationalization()
    expect(intl.formatDate(new Date(2026, 2, 5), { format: 'dd MMMM yyyy' })).toBe('05 marzo 2026')
  })
})
