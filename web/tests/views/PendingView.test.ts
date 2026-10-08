import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import { pendingNotifications } from '@/composables/useNotify'
import { useSessionStore } from '@/stores/session'
import PendingView from '@/views/PendingView.vue'
import { fakeAppUser, mountWithApp } from '../utils/mountWithApp'

vi.mock('@/api/auth')

afterEach(() => {
  document.body.innerHTML = ''
  pendingNotifications.value.splice(0)
  sessionStorage.clear()
  vi.resetAllMocks()
})

async function mountPending() {
  return mountWithApp(PendingView, { initialRoute: '/pending', session: { role: null, status: 'pending' } })
}

function buttonByText(wrapper: Awaited<ReturnType<typeof mountPending>>['wrapper'], text: string) {
  const button = wrapper.findAll('button').find((b) => b.text() === text)
  if (!button) throw new Error(`No button "${text}"`)
  return button
}

describe('PendingView', () => {
  it('explains that access is pending', async () => {
    const { wrapper } = await mountPending()
    expect(wrapper.get('h1').text()).toBe('Tu acceso está pendiente')
  })

  it('moves on once an admin has granted access', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ user: { id: 'user-1' } } as unknown as auth.Session)
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser('legal'))
    const { wrapper, router } = await mountPending()
    await buttonByText(wrapper, 'Ya me dieron acceso').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
    expect(useSessionStore().status).toBe('ready')
  })

  it('stays when access is still pending', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ user: { id: 'user-1' } } as unknown as auth.Session)
    vi.mocked(auth.getMyAppUser).mockResolvedValue(null)
    const { wrapper, router } = await mountPending()
    await buttonByText(wrapper, 'Ya me dieron acceso').trigger('click')
    await flushPromises()
    expect(auth.getMyAppUser).toHaveBeenCalled()
    expect(useSessionStore().status).toBe('pending')
    expect(router.currentRoute.value.name).toBe('pending')
  })

  it('reports an error and stays when the access check fails', async () => {
    vi.mocked(auth.getSession).mockRejectedValue(new Error('boom'))
    const { wrapper, router } = await mountPending()
    await buttonByText(wrapper, 'Ya me dieron acceso').trigger('click')
    await flushPromises()
    expect(pendingNotifications.value).toHaveLength(1)
    expect(router.currentRoute.value.name).toBe('pending')
  })

  it('signs out and goes to the login page', async () => {
    vi.mocked(auth.signOut).mockResolvedValue()
    const { wrapper, router } = await mountPending()
    await buttonByText(wrapper, 'Cerrar sesión').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(auth.signOut).toHaveBeenCalled()
    expect(useSessionStore().status).toBe('signedOut')
  })
})
