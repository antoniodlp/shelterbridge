import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanText } from '@/lib/text'
import type { Database } from '@/types/database'

let operatorName: string | null = null

// cleanText strips the same whitespace the database strips, and gives null for blank.
export function setOperatorName(name: string | null): void {
  operatorName = cleanText(name)
}

export function getOperatorName(): string | null {
  return operatorName
}

function base64Utf8(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// Adds the self-declared operator on shift to every request, for the audit log.
const fetchWithOperator: typeof fetch = (input, init) => {
  if (operatorName === null) return globalThis.fetch(input, init)
  const headers = new Headers(init?.headers)
  headers.set('x-operator-name', base64Utf8(operatorName))
  return globalThis.fetch(input, { ...init, headers })
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: fetchWithOperator } },
)
