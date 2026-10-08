import { L10n, loadCldr, setCulture } from '@syncfusion/ej2-base'
import type { AppLocale } from './index'

// Spanish text for Syncfusion's built-in labels plus es-MX CLDR data for
// date and number formats. Loaded on demand so only es-MX is bundled.
export async function loadSyncfusionLocale(locale: AppLocale): Promise<void> {
  const [numberingSystems, weekData, gregorian, timeZoneNames, numbers, currencies, texts] = await Promise.all([
    import('cldr-core/supplemental/numberingSystems.json'),
    import('cldr-core/supplemental/weekData.json'),
    import('cldr-dates-full/main/es-MX/ca-gregorian.json'),
    import('cldr-dates-full/main/es-MX/timeZoneNames.json'),
    import('cldr-numbers-full/main/es-MX/numbers.json'),
    import('cldr-numbers-full/main/es-MX/currencies.json'),
    import('@syncfusion/ej2-locale/src/es.json'),
  ])
  loadCldr(
    numberingSystems.default,
    weekData.default,
    gregorian.default,
    timeZoneNames.default,
    numbers.default,
    currencies.default,
  )
  L10n.load({ [locale]: texts.default.es })
  setCulture(locale)
}
