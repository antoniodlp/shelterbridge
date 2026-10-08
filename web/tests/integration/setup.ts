import { vi } from 'vitest'

// Integration tests use the real local stack through web/.env.local.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Integration tests need web/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. See README.md.')
}

// api/auth builds redirect URLs from window.location.origin, which Node does not have.
// No document is defined, so supabase-js still treats this as a non-browser runtime.
if (typeof window === 'undefined') vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
