import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { authGuard, safeRedirect } from '@/router/guards'
import { useSessionStore } from '@/stores/session'
import type { AppRole } from '@/types/domain'
import { fakeAppUser, stubbedRoutes } from '../utils/mountWithApp'

vi.mock('@/api/auth')

type Status = 'signedOut' | 'pending' | 'ready'

function setup(status: Status, role: AppRole | null = null, operatorName: string | null = null) {
  setActivePinia(
    createTestingPinia({
      createSpy: vi.fn,
      stubActions: ['init'],
      initialState: {
        session: { status, appUser: role ? fakeAppUser(role) : null, operatorName },
      },
    }),
  )
  const router = createRouter({ history: createMemoryHistory(), routes: stubbedRoutes })
  router.beforeEach(authGuard)
  return router
}

async function land(router: ReturnType<typeof setup>, path: string) {
  await router.push(path)
  return router.currentRoute.value
}

describe('authGuard', () => {
  it('waits for the session to initialize', async () => {
    const router = setup('signedOut')
    await land(router, '/login')
    expect(useSessionStore().init).toHaveBeenCalled()
  })

  it('sends a signed-out user to login with the original path', async () => {
    const route = await land(setup('signedOut'), '/people/00000000-0000-4000-8000-000000000001')
    expect(route.name).toBe('login')
    expect(route.query.redirect).toBe('/people/00000000-0000-4000-8000-000000000001')
  })

  it('lets a signed-out user open the public pages', async () => {
    expect((await land(setup('signedOut'), '/login')).name).toBe('login')
    expect((await land(setup('signedOut'), '/reset-password')).name).toBe('reset-password')
  })

  it('sends a failed Google sign-in back to login with an error flag', async () => {
    const route = await land(setup('signedOut'), '/residents?error=access_denied&error_description=Not+invited')
    expect(route.name).toBe('login')
    expect(route.query).toEqual({ error: 'oauth' })
  })

  it('sends a signed-in user away from login', async () => {
    expect((await land(setup('ready', 'admin'), '/login')).name).toBe('residents')
  })

  it('keeps reset-password open for the signed-in recovery session', async () => {
    expect((await land(setup('ready', 'legal'), '/reset-password')).name).toBe('reset-password')
  })

  it('sends a user without an active role to pending, and only there', async () => {
    expect((await land(setup('pending'), '/residents')).name).toBe('pending')
    expect((await land(setup('pending'), '/admin/users')).name).toBe('pending')
    expect((await land(setup('pending'), '/pending')).name).toBe('pending')
  })

  it('sends a ready user away from pending', async () => {
    expect((await land(setup('ready', 'legal'), '/pending')).name).toBe('residents')
  })

  it('asks a volunteer for the operator name first', async () => {
    const route = await land(setup('ready', 'volunteer'), '/people/search')
    expect(route.name).toBe('shift')
    expect(route.query.redirect).toBe('/people/search')
  })

  it('lets a volunteer with an operator name through', async () => {
    expect((await land(setup('ready', 'volunteer', 'Ana'), '/people/search')).name).toBe('people-search')
  })

  it('lets a volunteer change the operator name on the shift page', async () => {
    expect((await land(setup('ready', 'volunteer', 'Ana'), '/shift')).name).toBe('shift')
  })

  it('keeps other roles off the shift page', async () => {
    expect((await land(setup('ready', 'psychology'), '/shift')).name).toBe('residents')
  })

  it('keeps non-admins out of admin pages', async () => {
    expect((await land(setup('ready', 'volunteer', 'Ana'), '/admin/users')).name).toBe('residents')
    expect((await land(setup('ready', 'legal'), '/admin/audit')).name).toBe('residents')
  })

  it('lets an admin into admin pages', async () => {
    expect((await land(setup('ready', 'admin'), '/admin/merge')).name).toBe('admin-merge')
  })

  it('redirects / and unknown paths to residents', async () => {
    expect((await land(setup('ready', 'admin'), '/')).name).toBe('residents')
    expect((await land(setup('ready', 'admin'), '/no/such/page')).name).toBe('residents')
  })

  // Google sign-in, email confirmation and the recovery link come back with the tokens in
  // the hash. supabase-js reads them during init(); the router must not write them back.
  describe('with sign-in tokens in the URL', () => {
    const tokens = '#access_token=fake-access&expires_in=3600&refresh_token=fake-refresh&token_type=bearer'

    it('drops them from an app page and keeps the path and query', async () => {
      const route = await land(setup('ready', 'admin'), `/people/search?view=list${tokens}`)
      expect(route.name).toBe('people-search')
      expect(route.fullPath).toBe('/people/search?view=list')
    })

    it('drops them from the password reset page', async () => {
      const route = await land(setup('ready', 'legal'), `/reset-password${tokens}&type=recovery`)
      expect(route.name).toBe('reset-password')
      expect(route.fullPath).toBe('/reset-password')
    })

    it('keeps them out of the shift page redirect', async () => {
      const route = await land(setup('ready', 'volunteer'), `/residents${tokens}`)
      expect(route.name).toBe('shift')
      expect(route.query.redirect).toBe('/residents')
      expect(route.fullPath).not.toContain('token')
    })

    it('keeps them out of the login redirect', async () => {
      const route = await land(setup('signedOut'), `/residents${tokens}`)
      expect(route.name).toBe('login')
      expect(route.query.redirect).toBe('/residents')
      expect(route.fullPath).not.toContain('token')
    })

    it('still sends a failed Google sign-in in the hash to login with an error flag', async () => {
      const route = await land(setup('signedOut'), '/residents#error=access_denied&error_description=Not+invited')
      expect(route.name).toBe('login')
      expect(route.query).toEqual({ error: 'oauth' })
    })

    it('leaves a hash without tokens alone', async () => {
      const route = await land(setup('ready', 'admin'), '/people/search#results')
      expect(route.fullPath).toBe('/people/search#results')
    })
  })
})

describe('safeRedirect', () => {
  it('accepts app paths and rejects anything else', () => {
    expect(safeRedirect('/people/search')).toBe('/people/search')
    expect(safeRedirect('//evil.example/x')).toBe('/residents')
    expect(safeRedirect('/\\evil.example')).toBe('/residents')
    expect(safeRedirect('https://evil.example')).toBe('/residents')
    expect(safeRedirect(undefined)).toBe('/residents')
    expect(safeRedirect(['/a'])).toBe('/residents')
  })
})
