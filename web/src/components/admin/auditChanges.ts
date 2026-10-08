import type { Json } from '@/types/database'
import type { AuditEntry } from '@/types/domain'

const IGNORED = new Set(['created_at', 'created_by', 'updated_at', 'updated_by', 'search_name'])

function asObject(value: Json | null): Record<string, Json | undefined> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/** The fields an audit entry is about, for a one-line summary. */
export function changedFields(entry: Pick<AuditEntry, 'action' | 'old_data' | 'new_data'>): string[] {
  const before = asObject(entry.old_data)
  const after = asObject(entry.new_data)
  const filled = (data: Record<string, Json | undefined>) =>
    Object.keys(data).filter((key) => !IGNORED.has(key) && data[key] !== null && data[key] !== undefined)
  switch (entry.action) {
    case 'update':
      return Object.keys(after).filter(
        (key) => !IGNORED.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      )
    case 'insert':
      return filled(after)
    case 'delete':
      return filled(before)
    default:
      return Object.keys(after)
  }
}
