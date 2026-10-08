import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import * as client from '@/api/client'
import { pendingNotifications } from '@/composables/useNotify'
import { useSessionStore } from '@/stores/session'
import ShiftView from '@/views/ShiftView.vue'
import { mountWithApp } from '../utils/mountWithApp'

vi.mock('@/api/auth')
vi.mock('@/api/client')

afterEach(() => {
  document.body.innerHTML = ''
  pendingNotifications.value.splice(0)
  sessionStorage.clear()
  vi.resetAllMocks()
})

async function mountShift(initialRoute = '/shift', operatorName: string | null = null) {
  return mountWithApp(ShiftView, { initialRoute, session: { role: 'volunteer', operatorName } })
}

function buttonByText(wrapper: Awaited<ReturnType<typeof mountShift>>['wrapper'], text: string) {
  const button = wrapper.findAll('button').find((b) => b.text() === text)
  if (!button) throw new Error(`No button "${text}"`)
  return button
}

describe('ShiftView', () => {
  it('asks who is on shift', async () => {
    const { wrapper } = await mountShift()
    expect(wrapper.get('h1').text()).toBe('¿Quién está de turno?')
  })

  it('saves the operator name and continues to the original page', async () => {
    const { wrapper, router } = await mountShift('/shift?redirect=/people/search')
    await wrapper.get('#shift-name').setValue('  Ana y Luis ')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/people/search'))
    expect(useSessionStore().operatorName).toBe('Ana y Luis')
    expect(sessionStorage.getItem('sb.operatorName')).toBe('Ana y Luis')
    expect(client.setOperatorName).toHaveBeenLastCalledWith('Ana y Luis')
  })

  it('goes to residents when there is no redirect', async () => {
    const { wrapper, router } = await mountShift()
    await wrapper.get('#shift-name').setValue('Turno de la mañana')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
  })

  it.each(['//evil.example', '/\\evil.example'])('ignores a redirect to another site (%s)', async (target) => {
    const { wrapper, router } = await mountShift(`/shift?redirect=${encodeURIComponent(target)}`)
    expect(router.currentRoute.value.query.redirect).toBe(target)
    // The route table's catch-all also lands on residents, so check the target the view chose.
    const replace = vi.spyOn(router, 'replace')
    await wrapper.get('#shift-name').setValue('Turno de la tarde')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
    expect(replace).toHaveBeenCalledWith('/residents')
  })

  it('requires a name', async () => {
    const { wrapper, router } = await mountShift()
    await wrapper.get('#shift-name').setValue('    ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Este dato es obligatorio.')
    expect(router.currentRoute.value.name).toBe('shift')
    expect(useSessionStore().operatorName).toBeNull()
  })

  it('starts from the current name when changing shift', async () => {
    const { wrapper } = await mountShift('/shift', 'Ana')
    expect((wrapper.get('#shift-name').element as HTMLInputElement).value).toBe('Ana')
  })

  it('limits the name to 120 characters', async () => {
    const { wrapper } = await mountShift()
    expect(wrapper.get('#shift-name').attributes('maxlength')).toBe('120')
  })

  it('signs out and goes to the login page', async () => {
    vi.mocked(auth.signOut).mockResolvedValue()
    const { wrapper, router } = await mountShift()
    await buttonByText(wrapper, 'Cerrar sesión').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(auth.signOut).toHaveBeenCalled()
    expect(useSessionStore().status).toBe('signedOut')
  })
})
