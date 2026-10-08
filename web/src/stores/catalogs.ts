import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listCatalog } from '@/api/catalogs'
import { i18n } from '@/i18n'
import type { CatalogItem, CatalogName } from '@/types/domain'

const CATALOGS: CatalogName[] = ['countries', 'case_types', 'genders']

export interface CatalogOption {
  value: string
  text: string
}

export const useCatalogsStore = defineStore('catalogs', () => {
  const items = ref<Record<CatalogName, CatalogItem[]>>({ countries: [], case_types: [], genders: [] })
  const loaded = ref(false)

  async function load(): Promise<void> {
    if (loaded.value) return
    const lists = await Promise.all(CATALOGS.map((name) => listCatalog(name)))
    CATALOGS.forEach((name, index) => {
      items.value[name] = lists[index] ?? []
    })
    loaded.value = true
  }

  async function reload(name: CatalogName): Promise<void> {
    items.value[name] = await listCatalog(name)
  }

  function labelOf(item: CatalogItem): string {
    const locale = String(i18n.global.locale.value)
    const language = locale.split('-')[0] ?? locale
    return item.labels[locale] ?? item.labels[language] ?? item.labels.es ?? item.code
  }

  function label(name: CatalogName, code: string | null | undefined): string {
    if (!code) return ''
    const item = items.value[name].find((candidate) => candidate.code === code)
    return item ? labelOf(item) : code
  }

  function options(name: CatalogName, keepCode?: string | null): CatalogOption[] {
    return items.value[name]
      .filter((item) => item.active || item.code === keepCode)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || labelOf(a).localeCompare(labelOf(b), 'es'))
      .map((item) => ({ value: item.code, text: labelOf(item) }))
  }

  return { items, loaded, load, reload, label, options }
})
