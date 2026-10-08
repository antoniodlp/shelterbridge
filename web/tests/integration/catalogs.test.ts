import { describe, expect, it } from 'vitest'
import { createCatalogItem, listCatalog, updateCatalogItem } from '@/api/catalogs'
import type { AppRole } from '@/types/domain'
import { signInAs, uniqueSuffix } from './helpers'

// Spec section 12: every function is exercised as each seeded role. Only admins change catalogs.
const NON_ADMIN_ROLES: AppRole[] = ['legal', 'psychology', 'volunteer']

describe('catalog editing', () => {
  it('lets an admin add and edit a value', async () => {
    await signInAs('admin')
    const code = `prueba_${uniqueSuffix()}`
    const created = await createCatalogItem('case_types', {
      code,
      labels: { es: 'Caso de prueba' },
      sort_order: 99,
      active: true,
    })
    expect(created).toMatchObject({ code, labels: { es: 'Caso de prueba' }, active: true })

    const updated = await updateCatalogItem('case_types', code, created.updated_at, {
      labels: { es: 'Caso de prueba editado', en: 'Test case' },
      active: false,
    })
    expect(updated).toMatchObject({ labels: { es: 'Caso de prueba editado', en: 'Test case' }, active: false })
    await expect(updateCatalogItem('case_types', code, created.updated_at, { sort_order: 1 })).rejects.toMatchObject({
      code: 'stale_record',
    })
    expect((await listCatalog('case_types')).some((item) => item.code === code && !item.active)).toBe(true)
  })

  it('rejects a label without Spanish', async () => {
    await signInAs('admin')
    await expect(
      createCatalogItem('genders', { code: `g_${uniqueSuffix()}`, labels: { en: 'Only English' }, sort_order: 0, active: false }),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it.each(NON_ADMIN_ROLES)('refuses catalog changes from %s', async (role) => {
    await signInAs(role)
    const code = `g_${uniqueSuffix()}`
    await expect(
      createCatalogItem('genders', { code, labels: { es: 'Intento' }, sort_order: 0, active: false }),
    ).rejects.toMatchObject({ code: 'not_authorized' })

    const before = (await listCatalog('genders'))[0]
    if (!before) throw new Error('The seed has no genders')
    // An existing value, with its real version: only the admin-only update policy can refuse it.
    // The policy hides the row from the update, which changes zero rows. updateVersioned cannot tell
    // that from an out-of-date version, and the caller is still active, so it reports stale_record
    // (not_authorized is kept for a caller who has been deactivated).
    await expect(
      updateCatalogItem('genders', before.code, before.updated_at, {
        labels: { es: 'No deberia guardarse' },
        sort_order: 99,
        active: !before.active,
      }),
    ).rejects.toMatchObject({ code: 'stale_record' })

    await signInAs('admin')
    const after = await listCatalog('genders')
    expect(after.find((item) => item.code === before.code)).toEqual(before)
    expect(after.some((item) => item.code === code)).toBe(false)
  })
})
