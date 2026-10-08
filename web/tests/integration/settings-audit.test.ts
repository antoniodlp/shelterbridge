import { describe, expect, it } from 'vitest'
import { listAuditLog } from '@/api/audit'
import { getPerson, updatePerson } from '@/api/people'
import { getSettings, updateTimezone } from '@/api/settings'
import type { AppRole } from '@/types/domain'
import { createPerson } from './factories'
import { signInAs } from './helpers'

// Spec section 12: every function is exercised as each seeded role. Only admins read the audit log and edit settings.
const NON_ADMIN_ROLES: AppRole[] = ['legal', 'psychology', 'volunteer']

describe('settings', () => {
  it('saves the timezone with optimistic concurrency', async () => {
    await signInAs('admin')
    const current = await getSettings()
    // Writing the same timezone keeps "today" unchanged for the other test files.
    await expect(updateTimezone(current.timezone, '2000-01-01T00:00:00+00:00')).rejects.toMatchObject({
      code: 'stale_record',
    })
    await expect(updateTimezone(current.timezone, current.timezone_updated_at)).resolves.toBeUndefined()
  })
})

describe('audit log', () => {
  it('lists the changes of one record for an admin, newest first', async () => {
    await signInAs('volunteer')
    const personId = await createPerson()
    const loaded = await getPerson(personId)
    await updatePerson(personId, loaded.updated_at, { region: 'Cortés' })

    await signInAs('admin')
    const { rows, total } = await listAuditLog({ table_name: 'people', record_id: personId })
    expect(total).toBe(2)
    expect(rows.map((row) => row.action)).toEqual(['update', 'insert'])
    expect(rows[0]?.actor_role).toBe('volunteer')
  })

  it('pages and filters by time', async () => {
    await signInAs('admin')
    const page = await listAuditLog({ table_name: 'people', limit: 1, offset: 0 })
    expect(page.rows).toHaveLength(1)
    expect(page.total).toBeGreaterThanOrEqual(1)
    const future = await listAuditLog({ from: '2099-01-01T00:00:00.000Z' })
    expect(future).toEqual({ rows: [], total: 0 })
  })

  // Settings are readable by every role but writable by admins only. A non-admin update hits the
  // admin-only update policy and changes zero rows. updateVersioned cannot tell that from an
  // out-of-date version, and the caller is still active, so it reports stale_record (not
  // not_authorized, which it keeps for a deactivated caller). The stored timezone is never changed.
  it.each(NON_ADMIN_ROLES)('shows nothing to %s and refuses a timezone change', async (role) => {
    await signInAs(role)
    await expect(listAuditLog({})).resolves.toEqual({ rows: [], total: 0 })
    await expect(listAuditLog({ table_name: 'people', limit: 1 })).resolves.toEqual({ rows: [], total: 0 })

    const current = await getSettings()
    await expect(updateTimezone(current.timezone, current.timezone_updated_at)).rejects.toMatchObject({
      code: 'stale_record',
    })

    await signInAs('admin')
    await expect(getSettings()).resolves.toEqual(current)
  })
})
