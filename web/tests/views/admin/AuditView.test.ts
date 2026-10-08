import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAuditLog } from '@/api/audit'
import { ApiError } from '@/api/errors'
import { listAppUsers } from '@/api/users'
import AuditView from '@/views/admin/AuditView.vue'
import { makeAuditEntry, uuid } from '../../fixtures/data'
import { fakeAppUser, mountWithApp } from '../../utils/mountWithApp'
import { typeInto } from '../../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/audit', () => ({ listAuditLog: vi.fn() }))
vi.mock('@/api/users', () => ({ listAppUsers: vi.fn() }))
// The settings store (the timezone for the day bounds) imports this module.
vi.mock('@/api/settings', () => ({ getSettings: vi.fn() }))

async function mountView() {
  const result = await mountWithApp(AuditView, { initialRoute: '/admin/audit', session: { role: 'admin' } })
  await vi.waitFor(() => expect(result.wrapper.findAll('[data-testid="audit-row"]').length).toBeGreaterThan(0))
  return result.wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  // makeAuditEntry() is attributed to user uuid(301).
  vi.mocked(listAppUsers).mockResolvedValue([fakeAppUser('volunteer', { user_id: uuid(301), display_name: 'Ana Turno' })])
  vi.mocked(listAuditLog).mockResolvedValue({ rows: [makeAuditEntry()], total: 120 })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AuditView', () => {
  it('loads the newest changes with names, roles and what changed', async () => {
    const wrapper = await mountView()
    expect(listAuditLog).toHaveBeenCalledWith({ limit: 50, offset: 0 })
    const row = wrapper.find('[data-testid="audit-row"]')
    expect(row.text()).toContain('06/10/2026 10:00')
    expect(row.text()).toContain('Ana Turno')
    expect(row.text()).toContain('Voluntariado')
    expect(row.text()).toContain('Ana, Luis')
    expect(row.text()).toContain('Personas')
    expect(row.text()).toContain('Cambio')
    expect(row.text()).toContain('last_name')
    expect(wrapper.find('[data-testid="audit-page"]').text()).toBe('Página 1 de 3')
  })

  it('shows the data before and after an update under translated labels', async () => {
    const wrapper = await mountView()
    const row = wrapper.find('[data-testid="audit-row"]')
    const blocks = row.findAll('pre')
    expect(blocks).toHaveLength(2)
    expect(JSON.parse(blocks[0]?.text() ?? '')).toEqual({ last_name: 'Pérez' })
    expect(JSON.parse(blocks[1]?.text() ?? '')).toEqual({ last_name: 'Pérez Lara' })
    expect(row.text()).toContain('Antes')
    expect(row.text()).toContain('Después')
    expect(row.text()).not.toContain('antes')
    expect(row.text()).not.toContain('despues')
  })

  it('shows only the data before a delete and only the data after an insert', async () => {
    vi.mocked(listAuditLog).mockResolvedValue({
      rows: [
        makeAuditEntry({ id: 3, action: 'delete', old_data: { bed: 'C1' }, new_data: null }),
        makeAuditEntry({ id: 2, action: 'insert', old_data: null, new_data: { first_name: 'Ana' } }),
      ],
      total: 2,
    })
    const wrapper = await mountView()
    const [removed, added] = wrapper.findAll('[data-testid="audit-row"]')
    expect(removed?.findAll('pre')).toHaveLength(1)
    expect(removed?.text()).toContain('Antes')
    expect(removed?.text()).not.toContain('Después')
    expect(removed?.text()).toContain('Baja')
    expect(added?.findAll('pre')).toHaveLength(1)
    expect(added?.text()).toContain('Después')
    expect(added?.text()).not.toContain('Antes')
    expect(added?.text()).toContain('Alta')
  })

  it('still lists the changes when the user names cannot be loaded', async () => {
    vi.mocked(listAppUsers).mockRejectedValue(new ApiError('network'))
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="audit-row"]').text()).toContain('Usuario desconocido')
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('filters by table, record and shelter days', async () => {
    const wrapper = await mountView()
    await wrapper.find('#audit-table').setValue('stays')
    await wrapper.find('#audit-record').setValue(` ${uuid(101)} `)
    await typeInto(wrapper.find('#audit-from'), '01/10/2026')
    await typeInto(wrapper.find('#audit-to'), '07/10/2026')
    await wrapper.find('form.audit-filters').trigger('submit')
    await vi.waitFor(() =>
      expect(listAuditLog).toHaveBeenLastCalledWith({
        table_name: 'stays',
        record_id: uuid(101),
        from: '2026-10-01T06:00:00.000Z',
        to: '2026-10-08T06:00:00.000Z',
        limit: 50,
        offset: 0,
      }),
    )
  })

  it('pages through the results with the same filters', async () => {
    const wrapper = await mountView()
    const next = wrapper.findAll('button').find((button) => button.text() === 'Siguiente')
    await next?.trigger('click')
    await vi.waitFor(() => expect(listAuditLog).toHaveBeenLastCalledWith({ limit: 50, offset: 50 }))
    await vi.waitFor(() => expect(wrapper.find('[data-testid="audit-page"]').text()).toBe('Página 2 de 3'))
  })
})
