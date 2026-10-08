import type { AuditEntry } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'

export interface AuditFilters {
  table_name?: string
  record_id?: string
  actor_user_id?: string
  /** Inclusive lower bound, an ISO instant. */
  from?: string
  /** Exclusive upper bound, an ISO instant. */
  to?: string
  limit?: number
  offset?: number
}

/** Admin only: other roles get no rows. Newest first. */
export async function listAuditLog(filters: AuditFilters): Promise<{ rows: AuditEntry[]; total: number }> {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  let query = supabase.from('audit_log').select('*', { count: 'exact' })
  if (filters.table_name) query = query.eq('table_name', filters.table_name)
  if (filters.record_id) query = query.eq('record_id', filters.record_id)
  if (filters.actor_user_id) query = query.eq('actor_user_id', filters.actor_user_id)
  if (filters.from) query = query.gte('at', filters.from)
  if (filters.to) query = query.lt('at', filters.to)
  const { data, error, count } = await query
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw toApiError(error)
  return { rows: data ?? [], total: count ?? 0 }
}
