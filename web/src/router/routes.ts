import type { RouteRecordRaw } from 'vue-router'
import type { AppRole } from '@/types/domain'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    roles?: AppRole[]
    layout?: 'blank' | 'app'
  }
}

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: { name: 'residents' } },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, layout: 'blank' },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { public: true, layout: 'blank' },
  },
  {
    path: '/pending',
    name: 'pending',
    component: () => import('@/views/PendingView.vue'),
    meta: { layout: 'blank' },
  },
  {
    path: '/shift',
    name: 'shift',
    component: () => import('@/views/ShiftView.vue'),
    meta: { roles: ['volunteer'], layout: 'blank' },
  },
  {
    path: '/residents',
    name: 'residents',
    component: () => import('@/views/ResidentsView.vue'),
    meta: { layout: 'app' },
  },
  {
    path: '/people/search',
    name: 'people-search',
    component: () => import('@/views/PeopleSearchView.vue'),
    meta: { layout: 'app' },
  },
  {
    path: '/people/new',
    name: 'person-new',
    component: () => import('@/views/PersonNewView.vue'),
    meta: { layout: 'app' },
  },
  {
    path: '/people/:id',
    name: 'person',
    component: () => import('@/views/PersonView.vue'),
    meta: { layout: 'app' },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('@/views/admin/UsersView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  {
    path: '/admin/catalogs',
    name: 'admin-catalogs',
    component: () => import('@/views/admin/CatalogsView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  {
    path: '/admin/settings',
    name: 'admin-settings',
    component: () => import('@/views/admin/SettingsView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  {
    path: '/admin/audit',
    name: 'admin-audit',
    component: () => import('@/views/admin/AuditView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  {
    path: '/admin/merge',
    name: 'admin-merge',
    component: () => import('@/views/admin/MergeView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'residents' } },
]
