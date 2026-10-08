import { describe, expect, it } from 'vitest'
import { inviteUser, listAppUsers, updateAppUser } from '@/api/users'
import type { AppRole } from '@/types/domain'
import { devEmail, signInAs, uniqueSuffix } from './helpers'

// Spec section 12: every function is exercised as each seeded role. Only admins manage the allowlist.
const NON_ADMIN_ROLES: AppRole[] = ['legal', 'psychology', 'volunteer']

describe('users allowlist', () => {
  it('lets an admin invite, change the role and deactivate', async () => {
    await signInAs('admin')
    const email = `invitada-${uniqueSuffix()}@example.test`
    const invited = await inviteUser({
      email: `  ${email.toUpperCase()} `,
      role: 'volunteer',
      display_name: ' Invitada Prueba ',
    })
    expect(invited).toMatchObject({ email, role: 'volunteer', display_name: 'Invitada Prueba', active: true, user_id: null })

    const promoted = await updateAppUser(email, invited.updated_at, { role: 'legal' })
    expect(promoted.role).toBe('legal')
    await expect(updateAppUser(email, invited.updated_at, { active: false })).rejects.toMatchObject({
      code: 'stale_record',
    })
    const deactivated = await updateAppUser(email, promoted.updated_at, { active: false })
    expect(deactivated.active).toBe(false)
    expect((await listAppUsers()).some((user) => user.email === email)).toBe(true)
  })

  it('rejects inviting the same email twice', async () => {
    await signInAs('admin')
    const email = `doble-${uniqueSuffix()}@example.test`
    await inviteUser({ email, role: 'volunteer', display_name: 'Doble' })
    await expect(inviteUser({ email, role: 'volunteer', display_name: 'Doble' })).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('lets an admin see every user', async () => {
    await signInAs('admin')
    const emails = (await listAppUsers()).map((user) => user.email)
    const seeded = (['admin', 'legal', 'psychology', 'volunteer'] as const).map((role) => devEmail(role))
    expect(emails).toEqual(expect.arrayContaining(seeded))
  })

  // A non-admin update of a row hits the admin-only update policy and changes zero rows.
  // updateVersioned cannot tell that from an out-of-date version, and the caller is still
  // active, so it reports stale_record (not not_authorized, which it keeps for a deactivated caller).
  it.each(NON_ADMIN_ROLES)('shows %s only their own row and refuses invitations and edits', async (role) => {
    await signInAs('admin')
    const targetEmail = `objetivo-${role}-${uniqueSuffix()}@example.test`
    const target = await inviteUser({ email: targetEmail, role: 'volunteer', display_name: 'Objetivo de prueba' })

    await signInAs(role)
    const visible = await listAppUsers()
    expect(visible.map((user) => user.email)).toEqual([devEmail(role)])
    const own = visible[0]
    if (!own) throw new Error('Own row is missing')

    const refusedEmail = `x-${role}-${uniqueSuffix()}@example.test`
    await expect(inviteUser({ email: refusedEmail, role: 'admin', display_name: 'X' })).rejects.toMatchObject({
      code: 'not_authorized',
    })
    // Another person's row, with its real version: only the policy can refuse it.
    await expect(updateAppUser(targetEmail, target.updated_at, { role: 'admin' })).rejects.toMatchObject({
      code: 'stale_record',
    })
    // Their own row, with its real version: the policy refuses this too.
    await expect(
      updateAppUser(own.email, own.updated_at, { display_name: 'No deberia guardarse' }),
    ).rejects.toMatchObject({ code: 'stale_record' })

    await signInAs('admin')
    const all = await listAppUsers()
    expect(all.find((user) => user.email === targetEmail)).toMatchObject({ role: 'volunteer', updated_at: target.updated_at })
    expect(all.find((user) => user.email === own.email)).toMatchObject({
      role,
      display_name: own.display_name,
      updated_at: own.updated_at,
    })
    expect(all.some((user) => user.email === refusedEmail)).toBe(false)
  })
})
