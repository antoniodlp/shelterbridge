import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as catalogsApi from '@/api/catalogs'
import { useCatalogsStore } from '@/stores/catalogs'
import type { CatalogItem, CatalogName } from '@/types/domain'

vi.mock('@/api/catalogs')

function item(code: string, es: string, sort_order: number, active = true, extra: Record<string, string> = {}): CatalogItem {
  return { code, labels: { es, ...extra }, sort_order, active, updated_at: '2026-10-07T12:00:00Z' }
}

const data: Record<CatalogName, CatalogItem[]> = {
  countries: [
    item('ZA', 'Sudáfrica', 1000),
    item('HN', 'Honduras', 2),
    item('MX', 'México', 1),
    item('AR', 'Argentina', 1000),
    item('XK', 'Kosovo', 1000, false),
  ],
  case_types: [item('asylum_seeker', 'Solicitante de asilo', 2), item('returnee', 'Persona retornada', 3, false)],
  genders: [item('female', 'Mujer', 1, true, { en: 'Woman' })],
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(catalogsApi.listCatalog).mockImplementation(async (name) => data[name])
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('catalogs store', () => {
  it('loads every catalog once', async () => {
    const store = useCatalogsStore()
    await store.load()
    await store.load()
    expect(store.loaded).toBe(true)
    expect(catalogsApi.listCatalog).toHaveBeenCalledTimes(3)
    expect(store.items.countries).toHaveLength(5)
  })

  it('reload refreshes one catalog', async () => {
    const store = useCatalogsStore()
    await store.load()
    vi.mocked(catalogsApi.listCatalog).mockResolvedValueOnce([item('male', 'Hombre', 1)])
    await store.reload('genders')
    expect(store.items.genders.map((g) => g.code)).toEqual(['male'])
  })

  it('label uses the Spanish label for es-MX', async () => {
    const store = useCatalogsStore()
    await store.load()
    expect(store.label('genders', 'female')).toBe('Mujer')
  })

  it('label falls back to the code, and to an empty string for no code', async () => {
    const store = useCatalogsStore()
    await store.load()
    expect(store.label('countries', 'QQ')).toBe('QQ')
    expect(store.label('countries', null)).toBe('')
    expect(store.label('countries', undefined)).toBe('')
  })

  it('options lists active items by sort order, then label', async () => {
    const store = useCatalogsStore()
    await store.load()
    expect(store.options('countries')).toEqual([
      { value: 'MX', text: 'México' },
      { value: 'HN', text: 'Honduras' },
      { value: 'AR', text: 'Argentina' },
      { value: 'ZA', text: 'Sudáfrica' },
    ])
  })

  it('options keeps the current value even when it is inactive', async () => {
    const store = useCatalogsStore()
    await store.load()
    expect(store.options('case_types', 'returnee').map((o) => o.value)).toEqual(['asylum_seeker', 'returnee'])
    expect(store.options('case_types').map((o) => o.value)).toEqual(['asylum_seeker'])
  })
})
