import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'
import { defineComponent, type Component } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'
import { i18n } from '@/i18n'
import { loadSyncfusionLocale } from '@/i18n/syncfusion'
import { routes } from '@/router/routes'
import type { AppRole, AppUser, CatalogItem, CatalogName } from '@/types/domain'

// The component under test is mounted directly; no <RouterView> renders route views.
// Stubbing them keeps navigation free of lazy imports, whose first Vite transform can
// exceed vi.waitFor's 1 s default under parallel load.
const RouteStub = defineComponent({ name: 'RouteStub', render: () => null })
export const stubbedRoutes = routes.map((route) =>
  'component' in route && route.component ? { ...route, component: RouteStub } : route,
) as RouteRecordRaw[]

// Fictitious data only.
export function fakeAppUser(role: AppRole, patch: Partial<AppUser> = {}): AppUser {
  return {
    email: `${role}@shelterbridge.test`,
    user_id: '00000000-0000-4000-8000-00000000a001',
    role,
    display_name: `Usuario de prueba (${role})`,
    active: true,
    created_at: '2026-10-07T12:00:00Z',
    created_by: null,
    updated_at: '2026-10-07T12:00:00Z',
    updated_by: null,
    ...patch,
  }
}

function catalogItem(code: string, es: string, sort_order: number): CatalogItem {
  return { code, labels: { es }, sort_order, active: true, updated_at: '2026-10-07T12:00:00Z' }
}

export const testCatalogs: Record<CatalogName, CatalogItem[]> = {
  countries: [catalogItem('MX', 'México', 1), catalogItem('HN', 'Honduras', 2), catalogItem('GT', 'Guatemala', 3)],
  case_types: [
    catalogItem('migrant_in_transit', 'Migrante en tránsito', 1),
    catalogItem('asylum_seeker', 'Solicitante de asilo', 2),
  ],
  genders: [catalogItem('female', 'Mujer', 1), catalogItem('male', 'Hombre', 2)],
}

export interface MountWithAppOptions {
  props?: Record<string, unknown>
  initialRoute?: string
  session?: Partial<{ role: AppRole | null; operatorName: string | null; status: string }>
  catalogs?: Partial<Record<CatalogName, CatalogItem[]>>
  timezone?: string
}

// Mounts a component with the real i18n, a memory-history router with the real
// route names, paths and meta (components stubbed, no guards), and a testing Pinia
// whose stores start from the given state. Store actions run for real, so mock
// the @/api modules they call.
export async function mountWithApp<C>(
  component: C,
  options: MountWithAppOptions = {},
): Promise<{ wrapper: VueWrapper; router: Router }> {
  const role = options.session?.role === undefined ? 'volunteer' : options.session.role
  const operatorName =
    options.session?.operatorName === undefined ? 'Turno de prueba' : options.session.operatorName
  const status = options.session?.status ?? (role === null ? 'signedOut' : 'ready')

  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false,
    initialState: {
      session: {
        status,
        session: null,
        appUser: role === null ? null : fakeAppUser(role),
        operatorName,
      },
      catalogs: { items: { ...testCatalogs, ...options.catalogs }, loaded: true },
      settings: {
        timezone: options.timezone ?? 'America/Mexico_City',
        timezoneUpdatedAt: '2026-10-07T12:00:00Z',
        loaded: true,
      },
    },
  })

  const router = createRouter({ history: createMemoryHistory(), routes: stubbedRoutes })
  await router.push(options.initialRoute ?? '/residents')
  await router.isReady()
  await loadSyncfusionLocale('es-MX')

  const wrapper = mount(component as Component, {
    props: options.props,
    attachTo: document.body,
    global: { plugins: [i18n, pinia, router] },
  }) as VueWrapper
  await flushPromises()
  return { wrapper, router }
}
