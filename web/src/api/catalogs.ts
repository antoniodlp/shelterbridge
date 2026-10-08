import type { CatalogItem, CatalogName } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'
import { updateVersioned } from './rows'

// Includes inactive items: existing records may still point at them.
export async function listCatalog(name: CatalogName): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from(name)
    .select('code, labels, sort_order, active, updated_at')
    .order('sort_order')
    .order('code')
  if (error) throw toApiError(error)
  return (data ?? []).map((row) => ({
    code: row.code,
    labels: row.labels as Record<string, string>,
    sort_order: row.sort_order,
    active: row.active,
    updated_at: row.updated_at,
  }))
}

// The three catalog tables share one shape, so 'countries' stands in for all of them in the types.
type CatalogTable = 'countries'

const CATALOG_COLUMNS = 'code, labels, sort_order, active, updated_at'

export async function createCatalogItem(
  name: CatalogName,
  item: Omit<CatalogItem, 'updated_at'>,
): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from(name as CatalogTable)
    .insert(item)
    .select(CATALOG_COLUMNS)
    .single()
  if (error) throw toApiError(error)
  return data as CatalogItem
}

/** Codes never change; only labels, order and status can be edited. */
export async function updateCatalogItem(
  name: CatalogName,
  code: string,
  expectedUpdatedAt: string,
  patch: Partial<Pick<CatalogItem, 'labels' | 'sort_order' | 'active'>>,
): Promise<CatalogItem> {
  const row = await updateVersioned(name as CatalogTable, { column: 'code', value: code }, expectedUpdatedAt, patch)
  return {
    code: row.code,
    labels: row.labels as Record<string, string>,
    sort_order: row.sort_order,
    active: row.active,
    updated_at: row.updated_at,
  }
}
