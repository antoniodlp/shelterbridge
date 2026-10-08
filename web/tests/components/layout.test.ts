import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as auth from '@/api/auth'
import App from '@/App.vue'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import AppShell from '@/components/layout/AppShell.vue'
import OfflineBanner from '@/components/layout/OfflineBanner.vue'
import { i18n } from '@/i18n'
import { routes } from '@/router/routes'
import { useCatalogsStore } from '@/stores/catalogs'
import { useSessionStore } from '@/stores/session'
import { fakeAppUser, mountWithApp } from '../utils/mountWithApp'

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

  async function mountApp(path: string) {
    const router = createRouter({ history: createMemoryHistory(), routes: [...routes, ...testRoutes] })
    await router.push(path)
    await router.isReady()
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,
      initialState: {
        session: { status: 'ready', appUser: fakeAppUser('legal'), operatorName: null },
        catalogs: { loaded: true },
        settings: { loaded: true },
      },
    })
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [i18n, pinia, router] } })
    await flushPromises()
    return wrapper
  }

  it('wraps app pages in the shell with the navbar', async () => {
    const wrapper = await mountApp('/test-app')
    expect(wrapper.find('nav.navbar').exists()).toBe(true)
    expect(wrapper.get('main h1').text()).toBe('Página de prueba')
  })

  it('shows blank pages without the navbar', async () => {
    const wrapper = await mountApp('/test-blank')
    expect(wrapper.find('nav.navbar').exists()).toBe(false)
    expect(wrapper.get('main h1').text()).toBe('Página sin menú')
  })
})
