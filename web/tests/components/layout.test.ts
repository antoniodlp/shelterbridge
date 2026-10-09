import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as auth from '@/api/auth'
import App from '@/App.vue'
import logoUrl from '@/assets/logo.svg'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import AppShell from '@/components/layout/AppShell.vue'
import OfflineBanner from '@/components/layout/OfflineBanner.vue'
import { i18n } from '@/i18n'
import { useCatalogsStore } from '@/stores/catalogs'
import { useSessionStore, type SessionStatus } from '@/stores/session'
import { fakeAppUser, mountWithApp, stubbedRoutes } from '../utils/mountWithApp'

vi.mock('@/api/auth')
vi.mock('@/api/catalogs')
vi.mock('@/api/settings')

afterEach(() => {
  document.body.innerHTML = ''
  vi.resetAllMocks()
})

function linkTexts(): string[] {
  return Array.from(document.body.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '')
}

describe('AppNavbar', () => {
  it('shows the logo next to the app name in the brand link', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'volunteer' } })
    const brand = wrapper.get('a.navbar-brand')
    expect(brand.text()).toBe('ShelterBridge')
    const logo = brand.get('img')
    expect(logo.attributes('src')).toBe(logoUrl)
    // Decorative: the app name right next to it is the accessible text.
    expect(logo.attributes('alt')).toBe('')
  })

  it('shows the admin menu to an admin', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'admin', operatorName: null } })
    expect(wrapper.text()).toContain('Administración')
    expect(linkTexts()).toEqual(expect.arrayContaining(['Usuarios', 'Catálogos', 'Configuración', 'Bitácora de cambios', 'Unir duplicados']))
  })

  it('hides the admin menu from a volunteer', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'volunteer' } })
    expect(wrapper.text()).not.toContain('Administración')
    expect(linkTexts()).not.toContain('Usuarios')
    expect(linkTexts()).toEqual(expect.arrayContaining(['Residentes', 'Buscar', 'Registrar persona']))
  })

  it('shows the operator on shift and a way to change it to a volunteer', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'volunteer', operatorName: 'Ana y Luis' } })
    expect(wrapper.get('[data-testid="operator-name"]').text()).toBe('De turno: Ana y Luis')
    expect(linkTexts()).toContain('Cambiar turno')
  })

  it('shows no shift controls to other roles', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'legal', operatorName: null } })
    expect(wrapper.find('[data-testid="operator-name"]').exists()).toBe(false)
    expect(linkTexts()).not.toContain('Cambiar turno')
  })

  it('signs out and goes to login', async () => {
    vi.mocked(auth.signOut).mockResolvedValue()
    const { wrapper, router } = await mountWithApp(AppNavbar, { session: { role: 'volunteer', operatorName: 'Ana' } })
    await wrapper.get('button.btn-outline-danger').trigger('click')
    await flushPromises()
    expect(auth.signOut).toHaveBeenCalled()
    expect(useSessionStore().operatorName).toBeNull()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
  })
})

describe('OfflineBanner', () => {
  it('shows "Sin conexión" while the browser is offline', async () => {
    const { wrapper } = await mountWithApp(OfflineBanner)
    expect(wrapper.text()).not.toContain('Sin conexión')
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(wrapper.text()).toContain('Sin conexión')
    window.dispatchEvent(new Event('online'))
    await flushPromises()
    expect(wrapper.text()).not.toContain('Sin conexión')
  })
})

describe('AppShell', () => {
  it('loads the catalogs when it mounts', async () => {
    await mountWithApp(AppShell)
    expect(useCatalogsStore().load).toHaveBeenCalled()
  })
})

describe('App', () => {
  // Test pages stand in for the feature views, which Plan 3 replaces.
  const testRoutes = [
    { path: '/test-app', component: defineComponent({ render: () => h('h1', 'Página de prueba') }), meta: { layout: 'app' as const } },
    { path: '/test-blank', component: defineComponent({ render: () => h('h1', 'Página sin menú') }), meta: { layout: 'blank' as const } },
  ]

  async function mountApp(path: string, status: SessionStatus = 'ready') {
    const router = createRouter({ history: createMemoryHistory(), routes: [...stubbedRoutes, ...testRoutes] })
    await router.push(path)
    await router.isReady()
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,
      initialState: {
        session: { status, appUser: status === 'ready' ? fakeAppUser('legal') : null, operatorName: null },
        catalogs: { loaded: true },
        settings: { loaded: true },
      },
    })
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [i18n, pinia, router] } })
    await flushPromises()
    return { wrapper, router }
  }

  it('wraps app pages in the shell with the navbar', async () => {
    const { wrapper } = await mountApp('/test-app')
    expect(wrapper.find('nav.navbar').exists()).toBe(true)
    expect(wrapper.get('main h1').text()).toBe('Página de prueba')
  })

  it('shows blank pages without the navbar', async () => {
    const { wrapper } = await mountApp('/test-blank')
    expect(wrapper.find('nav.navbar').exists()).toBe(false)
    expect(wrapper.get('main h1').text()).toBe('Página sin menú')
  })

  it('shows the logo above blank pages', async () => {
    const { wrapper } = await mountApp('/test-blank')
    const logo = wrapper.get('main img')
    expect(logo.attributes('src')).toBe(logoUrl)
    expect(logo.attributes('alt')).toBe('ShelterBridge')
  })

  it('leaves the logo to the navbar on app pages', async () => {
    const { wrapper } = await mountApp('/test-app')
    expect(wrapper.find('main img').exists()).toBe(false)
    expect(wrapper.get('nav.navbar img').attributes('src')).toBe(logoUrl)
  })

  describe('when the session changes while a page is open', () => {
    const supabaseSession = { user: { id: '00000000-0000-4000-8000-00000000a001' } } as unknown as auth.Session

    it('goes to login when Supabase ends the session on an app page', async () => {
      // For example a sign-out in another tab, or a revoked or expired refresh token.
      let listener: ((next: auth.Session | null) => void) | undefined
      vi.mocked(auth.onAuthChange).mockImplementation((callback) => {
        listener = callback
        return () => undefined
      })
      vi.mocked(auth.getSession).mockResolvedValue(supabaseSession)
      vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser('legal'))
      const { router } = await mountApp('/test-app')
      await useSessionStore().init()
      expect(listener).toBeDefined()
      listener?.(null)
      await flushPromises()
      expect(useSessionStore().status).toBe('signedOut')
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/test-app')
    })

    it('goes to pending when the account loses its access on an app page', async () => {
      vi.mocked(auth.getSession).mockResolvedValue(supabaseSession)
      vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser('legal', { active: false }))
      const { router } = await mountApp('/test-blank')
      await useSessionStore().refreshAppUser()
      await flushPromises()
      expect(useSessionStore().status).toBe('pending')
      expect(router.currentRoute.value.name).toBe('pending')
    })

    it.each(['/login', '/reset-password'])('leaves the public page %s to its own view', async (path) => {
      const { router } = await mountApp(path)
      const replace = vi.spyOn(router, 'replace')
      const push = vi.spyOn(router, 'push')
      const session = useSessionStore()
      for (const status of ['signedOut', 'pending', 'ready', 'signedOut'] as const) {
        session.status = status
        await flushPromises()
      }
      expect(replace).not.toHaveBeenCalled()
      expect(push).not.toHaveBeenCalled()
      expect(router.currentRoute.value.path).toBe(path)
    })

    it('stays on the pending page when the account is pending', async () => {
      const { router } = await mountApp('/pending')
      const replace = vi.spyOn(router, 'replace')
      useSessionStore().status = 'pending'
      await flushPromises()
      expect(replace).not.toHaveBeenCalled()
      expect(router.currentRoute.value.name).toBe('pending')
    })

    it('leaves the first navigation to the route guard', async () => {
      const { router } = await mountApp('/test-app', 'loading')
      const replace = vi.spyOn(router, 'replace')
      useSessionStore().status = 'signedOut'
      await flushPromises()
      expect(replace).not.toHaveBeenCalled()
    })

    it('navigates only once when the user signs out from the menu', async () => {
      vi.mocked(auth.signOut).mockResolvedValue()
      const { wrapper, router } = await mountApp('/test-app')
      const replace = vi.spyOn(router, 'replace')
      await wrapper.get('button.btn-outline-danger').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('login')
      expect(replace).toHaveBeenCalledOnce()
      expect(replace).toHaveBeenCalledWith({ name: 'login' })
    })
  })
})
