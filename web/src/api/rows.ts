import type { Database } from '@/types/database'
import { getMyAppUser } from './auth'
import { supabase } from './client'
import { ApiError, toApiError } from './errors'

type TableName = keyof Database['public']['Tables']

// Optimistic concurrency: the update only applies if the row still has the
// updated_at value that was loaded. Zero rows back means someone else changed it.
export async function updateVersioned<T extends TableName>(
  table: T,
  key: { column: string; value: string },
  expectedUpdatedAt: string,
  patch: Database['public']['Tables'][T]['Update'],
): Promise<Database['public']['Tables'][T]['Row']> {
  const { data, error } = await supabase
    .from(table as TableName)
    .update(patch as never)
    .eq(key.column as never, key.value as never)
    .eq('updated_at' as never, expectedUpdatedAt as never)
    .select()
  if (error) throw toApiError(error)
  const rows = (data ?? []) as unknown as Database['public']['Tables'][T]['Row'][]
  const [row] = rows
  if (row === undefined) {
    // RLS hides every row from a user deactivated mid-session, which looks like a stale version.
    const me = await getMyAppUser().catch(() => null)
    throw new ApiError(me?.active ? 'stale_record' : 'not_authorized')
  }
  return row
}
