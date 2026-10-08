import { cleanText } from '@/lib/text'
import type { Outing } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'

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
