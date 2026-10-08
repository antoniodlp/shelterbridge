import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { inviteUser, listAppUsers, updateAppUser } from '@/api/users'
import type { AppUser } from '@/types/domain'
import UsersView from '@/views/admin/UsersView.vue'
import { uuid } from '../../fixtures/data'
import { fakeAppUser, mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/users', () => ({ listAppUsers: vi.fn(), inviteUser: vi.fn(), updateAppUser: vi.fn() }))

// mountWithApp signs in fakeAppUser('admin'), so this row is the signed-in admin.
const me = fakeAppUser('admin')
const volunteer = fakeAppUser('volunteer', {
  email: 'turno@example.test',
  display_name: 'Cuenta de turno',
  user_id: uuid(302),
})
const invited = fakeAppUser('legal', { email: 'nueva@example.test', display_name: 'Abogada Nueva', user_id: null })
const former = fakeAppUser('psychology', {
  email: 'antigua@example.test',
  display_name: 'Cuenta antigua',
  user_id: uuid(303),
  active: false,
})

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

async function mountView(rows = 3): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(UsersView, { initialRoute: '/admin/users', session: { role: 'admin' } })
  await vi.waitFor(() => expect(wrapper.findAll('[data-testid="user-row"]')).toHaveLength(rows))
  return wrapper
}

function rowOf(wrapper: Wrapper, email: string) {
  const row = wrapper.findAll('[data-testid="user-row"]').find((candidate) => candidate.text().includes(email))
  if (!row) throw new Error(`No row for ${email}`)
  return row
}

function roleSelect(wrapper: Wrapper, email: string): HTMLSelectElement {
  return rowOf(wrapper, email).find('select.role-select').element as HTMLSelectElement
}

function buttonOf(wrapper: Wrapper, email: string, label: string) {
  return rowOf(wrapper, email)
    .findAll('button')
    .find((candidate) => candidate.text() === label)
}

async function fillInvite(wrapper: Wrapper): Promise<void> {
  await wrapper.find('#invite-email').setValue('psico@example.test')
  await wrapper.find('#invite-name').setValue('Psicóloga Prueba')
  await wrapper.find('#invite-role').setValue('psychology')
}

beforeEach(() => {
  // mockReset also drops once-queues, so a test that leaves one behind cannot leak it.
  vi.mocked(listAppUsers).mockReset()
  vi.mocked(inviteUser).mockReset()
  vi.mocked(updateAppUser).mockReset()
  notify.success.mockReset()
  notify.error.mockReset()
  confirm.mockReset()
  vi.mocked(listAppUsers).mockResolvedValue([me, volunteer, invited])
  confirm.mockResolvedValue(true)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UsersView', () => {
  it('lists users with role, status and whether they have signed in yet', async () => {
    const wrapper = await mountView()
    expect(rowOf(wrapper, 'turno@example.test').text()).toContain('Activo')
    expect(rowOf(wrapper, 'nueva@example.test').text()).toContain('Aún no entra')
    expect(roleSelect(wrapper, 'nueva@example.test').value).toBe('legal')
  })

  it('invites a person and reloads the list', async () => {
    vi.mocked(inviteUser).mockResolvedValue(fakeAppUser('psychology', { email: 'psico@example.test' }))
    const wrapper = await mountView()
    await fillInvite(wrapper)
    await wrapper.find('form.invite-form').trigger('submit')
    await vi.waitFor(() =>
      expect(inviteUser).toHaveBeenCalledWith({
        email: 'psico@example.test',
        display_name: 'Psicóloga Prueba',
        role: 'psychology',
      }),
    )
    expect(notify.success).toHaveBeenCalledWith('admin.users.invite.done')
    await vi.waitFor(() => expect(listAppUsers).toHaveBeenCalledTimes(2))
    expect((wrapper.find('#invite-email').element as HTMLInputElement).value).toBe('')
  })

  it('checks the email and name before inviting', async () => {
    const wrapper = await mountView()
    await wrapper.find('#invite-email').setValue('sin-arroba')
    await wrapper.find('form.invite-form').trigger('submit')
    expect(inviteUser).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe un correo válido.')
    expect(wrapper.text()).toContain('Este dato es obligatorio.')
  })

  it('sends one invitation when the form is submitted twice', async () => {
    let finish: (user: AppUser) => void = () => undefined
    vi.mocked(inviteUser).mockReturnValue(new Promise<AppUser>((resolve) => (finish = resolve)))
    const wrapper = await mountView()
    await fillInvite(wrapper)
    await wrapper.find('form.invite-form').trigger('submit')
    await wrapper.find('form.invite-form').trigger('submit')
    expect(inviteUser).toHaveBeenCalledTimes(1)
    finish(fakeAppUser('psychology', { email: 'psico@example.test' }))
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith('admin.users.invite.done'))
  })

  it('keeps the form and reports the error when the invitation fails', async () => {
    const failure = new ApiError('validation')
    vi.mocked(inviteUser).mockRejectedValue(failure)
    const wrapper = await mountView()
    await fillInvite(wrapper)
    await wrapper.find('form.invite-form').trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(failure))
    expect(notify.success).not.toHaveBeenCalled()
    expect((wrapper.find('#invite-email').element as HTMLInputElement).value).toBe('psico@example.test')
    expect(listAppUsers).toHaveBeenCalledTimes(1)
  })

  it('clears the form once the invitation is saved even when the reload fails', async () => {
    const reloadFailure = new ApiError('network')
    vi.mocked(listAppUsers).mockResolvedValueOnce([me, volunteer, invited]).mockRejectedValueOnce(reloadFailure)
    vi.mocked(inviteUser).mockResolvedValue(fakeAppUser('psychology', { email: 'psico@example.test' }))
    const wrapper = await mountView()
    await fillInvite(wrapper)
    await wrapper.find('form.invite-form').trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(reloadFailure))
    // The saved invitation is reported as saved, and the form cannot be sent again by mistake.
    expect(notify.success).toHaveBeenCalledWith('admin.users.invite.done')
    expect(notify.error).toHaveBeenCalledTimes(1)
    expect((wrapper.find('#invite-email').element as HTMLInputElement).value).toBe('')
    expect((wrapper.find('#invite-name').element as HTMLInputElement).value).toBe('')
    await wrapper.find('form.invite-form').trigger('submit')
    expect(inviteUser).toHaveBeenCalledTimes(1)
  })

  it('changes a role with the version that was loaded', async () => {
    vi.mocked(updateAppUser).mockResolvedValue({ ...volunteer, role: 'legal' })
    const wrapper = await mountView()
    await rowOf(wrapper, 'turno@example.test').find('select.role-select').setValue('legal')
    await vi.waitFor(() =>
      expect(updateAppUser).toHaveBeenCalledWith('turno@example.test', volunteer.updated_at, { role: 'legal' }),
    )
    expect(notify.success).toHaveBeenCalledWith('admin.users.updated')
  })

  it('reports a saved role change as saved even when the reload fails', async () => {
    const reloadFailure = new ApiError('network')
    vi.mocked(listAppUsers).mockResolvedValueOnce([me, volunteer, invited]).mockRejectedValueOnce(reloadFailure)
    const saved = { ...volunteer, role: 'legal' as const, updated_at: '2026-10-08T10:00:00Z' }
    vi.mocked(updateAppUser).mockResolvedValue(saved)
    const wrapper = await mountView()
    await rowOf(wrapper, 'turno@example.test').find('select.role-select').setValue('legal')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(reloadFailure))
    expect(notify.success).toHaveBeenCalledWith('admin.users.updated')
    expect(notify.error).toHaveBeenCalledTimes(1)
    // The list shows what was saved, and the next change uses the saved version.
    await vi.waitFor(() => expect(roleSelect(wrapper, 'turno@example.test').value).toBe('legal'))
    vi.mocked(updateAppUser).mockResolvedValue({ ...saved, role: 'psychology' })
    await rowOf(wrapper, 'turno@example.test').find('select.role-select').setValue('psychology')
    await vi.waitFor(() =>
      expect(updateAppUser).toHaveBeenLastCalledWith('turno@example.test', saved.updated_at, { role: 'psychology' }),
    )
  })

  it('shows the saved role again and reloads when a role change is refused', async () => {
    const failure = new ApiError('stale_record')
    vi.mocked(updateAppUser).mockRejectedValue(failure)
    const wrapper = await mountView()
    await rowOf(wrapper, 'turno@example.test').find('select.role-select').setValue('legal')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(failure))
    await vi.waitFor(() => expect(listAppUsers).toHaveBeenCalledTimes(2))
    expect(notify.success).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(roleSelect(wrapper, 'turno@example.test').value).toBe('volunteer'))
  })

  it('shows the saved role again when the role change and the reload both fail', async () => {
    vi.mocked(listAppUsers).mockResolvedValueOnce([me, volunteer, invited]).mockRejectedValueOnce(new ApiError('network'))
    vi.mocked(updateAppUser).mockRejectedValue(new ApiError('stale_record'))
    const wrapper = await mountView()
    await rowOf(wrapper, 'turno@example.test').find('select.role-select').setValue('legal')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(roleSelect(wrapper, 'turno@example.test').value).toBe('volunteer'))
  })

  it('asks before deactivating someone', async () => {
    vi.mocked(updateAppUser).mockResolvedValue({ ...volunteer, active: false })
    const wrapper = await mountView()
    await buttonOf(wrapper, 'turno@example.test', 'Desactivar')?.trigger('click')
    await vi.waitFor(() =>
      expect(updateAppUser).toHaveBeenCalledWith('turno@example.test', volunteer.updated_at, { active: false }),
    )
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ messageKey: 'admin.users.deactivateMessage', messageParams: { name: 'Cuenta de turno' } }),
    )
  })

  it('does not deactivate anyone when the question is declined', async () => {
    confirm.mockResolvedValue(false)
    const wrapper = await mountView()
    await buttonOf(wrapper, 'turno@example.test', 'Desactivar')?.trigger('click')
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(updateAppUser).not.toHaveBeenCalled()
    expect(listAppUsers).toHaveBeenCalledTimes(1)
  })

  it('activates someone again without asking', async () => {
    vi.mocked(listAppUsers).mockResolvedValue([me, volunteer, invited, former])
    vi.mocked(updateAppUser).mockResolvedValue({ ...former, active: true })
    const wrapper = await mountView(4)
    expect(rowOf(wrapper, 'antigua@example.test').text()).toContain('Inactivo')
    await buttonOf(wrapper, 'antigua@example.test', 'Activar')?.trigger('click')
    await vi.waitFor(() =>
      expect(updateAppUser).toHaveBeenCalledWith('antigua@example.test', former.updated_at, { active: true }),
    )
    expect(confirm).not.toHaveBeenCalled()
  })

  it('does not let admins change or deactivate their own account', async () => {
    const wrapper = await mountView()
    const own = rowOf(wrapper, me.email)
    expect(own.find('select.role-select').attributes('disabled')).toBeDefined()
    expect(own.findAll('button').every((candidate) => candidate.attributes('disabled') !== undefined)).toBe(true)
    expect(own.text()).toContain('Tu cuenta')
  })
})
