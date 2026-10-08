import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { useSessionStore } from '@/stores/session'

// Only same-app paths are accepted as a redirect target. Browsers treat "/\" like "//".
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && /^\/(?![\\/])/.test(value) ? value : '/residents'
}

function isOAuthErrorReturn(to: RouteLocationNormalized): boolean {
  return typeof to.query.error === 'string' || /(^#|&)error=/.test(to.hash)
}

// UX only: Postgres RLS is the real authorization.
export async function authGuard(to: RouteLocationNormalized): Promise<true | RouteLocationRaw> {
  const session = useSessionStore()
  await session.init()

  if (to.meta.public) {
    // The recovery link signs the user in, so reset-password stays reachable.
    if (session.status !== 'signedOut' && to.name !== 'reset-password') return { name: 'residents' }
    return true
  }

  if (session.status === 'signedOut') {
    if (isOAuthErrorReturn(to)) return { name: 'login', query: { error: 'oauth' } }
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (session.status === 'pending') return to.name === 'pending' ? true : { name: 'pending' }
  if (to.name === 'pending') return { name: 'residents' }

  if (session.needsOperatorName && to.name !== 'shift') {
    return { name: 'shift', query: { redirect: to.fullPath } }
  }

  const roles = to.meta.roles
  if (roles && (session.role === null || !roles.includes(session.role))) return { name: 'residents' }

  return true
}
