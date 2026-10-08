import type { CatalogItem, CatalogName } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'

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
