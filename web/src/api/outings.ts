import { cleanText } from '@/lib/text'
import type { Outing } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'
import { deleteById, updateVersioned } from './rows'

/** Starts an outing at the server's current time. */
export async function startOuting(
  stayId: string,
  comment?: string | null,
  confirmException = false,
): Promise<string> {
  const { data, error } = await supabase.rpc('start_outing', {
    p_stay_id: stayId,
    p_comment: cleanText(comment) ?? undefined,
    p_confirm_exception: confirmException,
  })
  if (error) throw toApiError(error)
  return data as string
}

/** Records the return of the open outing at the server's current time. */
export async function endOuting(stayId: string): Promise<string> {
  const { data, error } = await supabase.rpc('end_outing', { p_stay_id: stayId })
  if (error) throw toApiError(error)
  return data as string
}

/** The outings of one stay, newest first. */
export async function listOutingsForStay(stayId: string): Promise<Outing[]> {
  const { data, error } = await supabase
    .from('outings')
    .select('*')
    .eq('stay_id', stayId)
    .order('left_at', { ascending: false })
  if (error) throw toApiError(error)
  return data ?? []
}

/** Saves only if nobody changed the outing since `expectedUpdatedAt`. Times are instants. */
export async function updateOuting(
  id: string,
  expectedUpdatedAt: string,
  patch: Partial<Pick<Outing, 'left_at' | 'returned_at' | 'comment'>>,
): Promise<Outing> {
  const cleaned = { ...patch }
  if ('comment' in patch) cleaned.comment = cleanText(patch.comment)
  return updateVersioned('outings', { column: 'id', value: id }, expectedUpdatedAt, cleaned)
}

/** Admin only. */
export async function deleteOuting(id: string): Promise<void> {
  await deleteById('outings', id)
}
