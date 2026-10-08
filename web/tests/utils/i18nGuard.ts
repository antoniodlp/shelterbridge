import { afterEach } from 'vitest'
import { i18n } from '@/i18n'

// Keys that were looked up but do not exist in es-MX.json during the current test.
export const missingI18nKeys: string[] = []

// A missing translation throws where it happens and also fails the test in
// afterEach, in case the code that hit it swallowed the error.
export function installMissingKeyGuard(): void {
  i18n.global.setMissingHandler((locale, key) => {
    missingI18nKeys.push(key)
    throw new Error(`Missing i18n key "${key}" for locale ${locale}`)
  })
  afterEach(() => {
    if (missingI18nKeys.length > 0) {
      const keys = missingI18nKeys.splice(0)
      throw new Error(`Missing i18n keys: ${keys.join(', ')}`)
    }
  })
}
