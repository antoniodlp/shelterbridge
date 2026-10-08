import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getMyAppUser,
  getSession,
  onAuthChange,
  signOut as apiSignOut,
  type Session,
} from '@/api/auth'
import { setOperatorName as setClientOperatorName } from '@/api/client'
import { cleanText } from '@/lib/text'
import type { AppRole, AppUser } from '@/types/domain'

export type SessionStatus = 'loading' | 'signedOut' | 'pending' | 'ready'

const OPERATOR_KEY = 'sb.operatorName'

function readStoredOperator(): string | null {
  try {
    return sessionStorage.getItem(OPERATOR_KEY)
  } catch {
    return null
  }
}

export const useSessionStore = defineStore('session', () => {
  const status = ref<SessionStatus>('loading')
  const session = ref<Session | null>(null)
  const appUser = ref<AppUser | null>(null)
  const operatorName = ref<string | null>(readStoredOperator())
  setClientOperatorName(operatorName.value)

  const role = computed<AppRole | null>(() => (appUser.value?.active ? appUser.value.role : null))
  const isAdmin = computed(() => role.value === 'admin')
  const needsOperatorName = computed(() => role.value === 'volunteer' && !operatorName.value)

  let initPromise: Promise<void> | null = null
  let applyCount = 0
  // The user whose app user was last loaded successfully. Unlike session.value, it is not
  // set while a load is still in flight, so a no-op event cannot be mistaken for a loaded user.
  let loadedUserId: string | null = null

  async function apply(next: Session | null, reloadUser: boolean): Promise<void> {
    // A token refresh for the user we already loaded: keep the newest tokens, nothing else.
    // This returns before the counter moves, so it never cancels a load in flight.
    if (next !== null && !reloadUser && status.value !== 'loading' && next.user.id === loadedUserId) {
      session.value = next
      return
    }
    const call = ++applyCount
    session.value = next
    if (next === null) {
      loadedUserId = null
      appUser.value = null
      status.value = 'signedOut'
      // Also covers a sign-out started by Supabase, such as an expired refresh token.
      setOperatorName(null)
      return
    }
    const user = await getMyAppUser()
    if (call !== applyCount) return
    appUser.value = user
    status.value = user?.active ? 'ready' : 'pending'
    loadedUserId = next.user.id
  }

  function init(): Promise<void> {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          await apply(await getSession(), true)
        } catch {
          await apply(null, true)
        }
        onAuthChange((next) => {
          void apply(next, false).catch(() => undefined)
        })
      })()
    }
    return initPromise
  }

  async function refreshAppUser(): Promise<void> {
    await apply(await getSession(), true)
  }

  function setOperatorName(name: string | null): void {
    // cleanText strips the same whitespace the database strips, and gives null for blank.
    operatorName.value = cleanText(name)
    try {
      if (operatorName.value === null) sessionStorage.removeItem(OPERATOR_KEY)
      else sessionStorage.setItem(OPERATOR_KEY, operatorName.value)
    } catch {
      // Private browsing can block storage; the name still lives in memory.
    }
    setClientOperatorName(operatorName.value)
  }

  async function signOut(): Promise<void> {
    try {
      await apiSignOut()
    } finally {
      await apply(null, true)
    }
  }

  return {
    status,
    session,
    appUser,
    operatorName,
    role,
    isAdmin,
    needsOperatorName,
    init,
    refreshAppUser,
    setOperatorName,
    signOut,
  }
})
