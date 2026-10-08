import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import * as client from '@/api/client'
import { useSessionStore } from '@/stores/session'
import type { AppUser } from '@/types/domain'

vi.mock('@/api/auth')
vi.mock('@/api/client')

function fakeSession(userId: string): auth.Session {
  return { access_token: 'token', user: { id: userId } } as unknown as auth.Session
}

function fakeAppUser(patch: Partial<AppUser> = {}): AppUser {
  return {
    email: 'volunteer@shelterbridge.test',
    user_id: 'user-1',
    role: 'volunteer',
    display_name: 'Voluntariado Demo',
    active: true,
    created_at: '2026-10-07T12:00:00Z',
    created_by: null,
    updated_at: '2026-10-07T12:00:00Z',
    updated_by: null,
    ...patch,
  }
}

let authListener: ((session: auth.Session | null) => void) | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  authListener = null
  vi.mocked(auth.onAuthChange).mockImplementation((callback) => {
    authListener = callback
    return () => undefined
  })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('session store', () => {
  it('is signed out when there is no session', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null)
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('signedOut')
    expect(store.role).toBeNull()
  })

  it('is ready with the role of an active app user', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser({ role: 'admin' }))
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('ready')
    expect(store.role).toBe('admin')
    expect(store.isAdmin).toBe(true)
  })

  it('is pending when the user has no app user row', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(null)
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('pending')
    expect(store.role).toBeNull()
  })

  it('is pending when the app user was deactivated', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser({ active: false }))
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('pending')
    expect(store.role).toBeNull()
  })

  it('init runs only once', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null)
    const store = useSessionStore()
    await Promise.all([store.init(), store.init()])
    await store.init()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    expect(auth.onAuthChange).toHaveBeenCalledTimes(1)
  })

  it('follows sign-out events from Supabase and forgets the operator name', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser())
    const store = useSessionStore()
    await store.init()
    store.setOperatorName('Ana')
    authListener?.(null)
    await vi.waitFor(() => expect(store.status).toBe('signedOut'))
    expect(store.appUser).toBeNull()
    expect(store.operatorName).toBeNull()
    expect(sessionStorage.getItem('sb.operatorName')).toBeNull()
  })

  it('does not reload the app user on a token refresh for the same user', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser())
    const store = useSessionStore()
    await store.init()
    authListener?.(fakeSession('user-1'))
    await Promise.resolve()
    expect(auth.getMyAppUser).toHaveBeenCalledTimes(1)
  })

  it('refreshAppUser reloads the session and the app user', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null)
    const store = useSessionStore()
    await store.init()
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-2'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser({ role: 'legal' }))
    await store.refreshAppUser()
    expect(store.status).toBe('ready')
    expect(store.role).toBe('legal')
  })

  it('needs an operator name only for the volunteer role', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser({ role: 'volunteer' }))
    const store = useSessionStore()
    await store.init()
    expect(store.needsOperatorName).toBe(true)
    store.setOperatorName('Ana y Luis')
    expect(store.needsOperatorName).toBe(false)
  })

  it('stores the operator name in sessionStorage and the api client', () => {
    const store = useSessionStore()
    store.setOperatorName('  Ana y Luis ')
    expect(store.operatorName).toBe('Ana y Luis')
    expect(sessionStorage.getItem('sb.operatorName')).toBe('Ana y Luis')
    expect(client.setOperatorName).toHaveBeenLastCalledWith('Ana y Luis')
  })

  it('treats a blank operator name as none', () => {
    const store = useSessionStore()
    store.setOperatorName('Ana')
    store.setOperatorName('   ')
    expect(store.operatorName).toBeNull()
    expect(sessionStorage.getItem('sb.operatorName')).toBeNull()
    expect(client.setOperatorName).toHaveBeenLastCalledWith(null)
  })

  it('cleans the operator name with the same whitespace the database strips', () => {
    const store = useSessionStore()
    store.setOperatorName(' Ana y Luis ')
    expect(store.operatorName).toBe('Ana y Luis')
    expect(client.setOperatorName).toHaveBeenLastCalledWith('Ana y Luis')
    store.setOperatorName('  ﻿')
    expect(store.operatorName).toBeNull()
    expect(sessionStorage.getItem('sb.operatorName')).toBeNull()
  })

  it('restores the operator name after a page reload', () => {
    sessionStorage.setItem('sb.operatorName', 'Turno de noche')
    const store = useSessionStore()
    expect(store.operatorName).toBe('Turno de noche')
    expect(client.setOperatorName).toHaveBeenCalledWith('Turno de noche')
  })

  it('signOut clears the session and the operator name', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser())
    const store = useSessionStore()
    await store.init()
    store.setOperatorName('Ana')
    await store.signOut()
    expect(auth.signOut).toHaveBeenCalled()
    expect(store.status).toBe('signedOut')
    expect(store.operatorName).toBeNull()
    expect(sessionStorage.getItem('sb.operatorName')).toBeNull()
  })
})
