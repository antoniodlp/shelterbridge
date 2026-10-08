import { createI18n } from 'vue-i18n'
import esMX from './locales/es-MX.json'
import { loadSyncfusionLocale } from './syncfusion'

export type AppLocale = 'es-MX'

export const i18n = createI18n({
  legacy: false,
  locale: 'es-MX',
  fallbackLocale: 'es-MX',
  messages: { 'es-MX': esMX },
})

// The one place that switches language: app strings, Syncfusion and <html lang>.
export async function setLocale(locale: AppLocale): Promise<void> {
  i18n.global.locale.value = locale
  await loadSyncfusionLocale(locale)
  document.documentElement.lang = locale
}
