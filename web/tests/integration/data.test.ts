import { afterEach, describe, expect, it } from 'vitest'
import { listCatalog } from '@/api/catalogs'
import { setOperatorName } from '@/api/client'
import { isApiError } from '@/api/errors'
import { updateVersioned } from '@/api/rows'
import { getSettings } from '@/api/settings'
import type { AppRole } from '@/types/domain'
import { devEmail, signInAs, signOutQuietly, supabase, uniqueSuffix } from './helpers'

const ROLES: AppRole[] = ['admin', 'legal', 'psychology', 'volunteer']

afterEach(async () => {
  await signOutQuietly()
})

async function insertPerson(firstName: string): Promise<{ id: string; updated_at: string }> {
  const { data, error } = await supabase.from('people').insert({ first_name: firstName }).select('id, updated_at').single()
  if (error) throw error
  return data
}

// Signs in as admin and switches the seeded volunteer account on or off.
async function setVolunteerActive(active: boolean): Promise<void> {
  await signInAs('admin')
  const { data, error } = await supabase
    .from('app_users')
    .select('updated_at')
    .eq('email', devEmail('volunteer'))
    .single()
  if (error) throw error
  await updateVersioned('app_users', { column: 'email', value: devEmail('volunteer') }, data.updated_at, { active })
}

describe('api/catalogs', () => {
  it.each(ROLES)('lists every country in sort order with Spanish labels as %s', async (role) => {
    await signInAs(role)
    const countries = await listCatalog('countries')
    expect(countries).toHaveLength(249)
    expect(countries[0]).toMatchObject({ code: 'MX', sort_order: 1, active: true })
    expect(countries[0]?.labels.es).toBe('México')
  })

  it('lists the seeded genders and case types', async () => {
    await signInAs('legal')
    expect((await listCatalog('genders')).map((g) => g.code)).toContain('female')
    expect((await listCatalog('case_types')).map((c) => c.code)).toContain('asylum_seeker')
  })
})

describe('error mapping against the real server', () => {
  it('maps a signed-out read to not_authorized', async () => {
    const error = await listCatalog('countries').catch((e: unknown) => e)
    expect(isApiError(error, 'not_authorized')).toBe(true)
  })

  it('maps a business error raised by Postgres (P0001) to its code', async () => {
    await signInAs('admin')
    const { data, error: readError } = await supabase.from('settings').select('updated_at').eq('key', 'timezone').single()
    expect(readError).toBeNull()
    const error = await updateVersioned('settings', { column: 'key', value: 'timezone' }, data?.updated_at ?? '', {
      value: 'Mars/Olympus',
    }).catch((e: unknown) => e)
    expect(isApiError(error, 'validation')).toBe(true)
  })
})

describe('api/settings', () => {
  it.each(ROLES)('reads the shelter timezone as %s', async (role) => {
    await signInAs(role)
    const settings = await getSettings()
    expect(settings.timezone).toBe('America/Mexico_City')
    expect(Number.isNaN(Date.parse(settings.timezone_updated_at))).toBe(false)
  })
})

describe('api/rows updateVersioned', () => {
  it('updates a row that has not changed and returns it', async () => {
    await signInAs('volunteer')
    const person = await insertPerson(`Prueba Versionada ${uniqueSuffix()}`)
    const updated = await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, {
      region: 'Jalisco',
    })
    expect(updated.region).toBe('Jalisco')
    expect(updated.updated_at).not.toBe(person.updated_at)
  })

  it('throws stale_record when someone else changed the row first', async () => {
    await signInAs('volunteer')
    const person = await insertPerson(`Prueba Concurrente ${uniqueSuffix()}`)
    await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, { region: 'Jalisco' })
    const error = await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, {
      region: 'Zacatecas',
    }).catch((e: unknown) => e)
    expect(isApiError(error, 'stale_record')).toBe(true)
  })

  it('throws not_authorized, not stale_record, for a user deactivated mid-session', async () => {
    await signInAs('volunteer')
    const person = await insertPerson(`Prueba Desactivada ${uniqueSuffix()}`)
    try {
      await setVolunteerActive(false)
      // A deactivated user can still sign in with a password; RLS then hides every row.
      await signInAs('volunteer')
      const error = await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, {
        region: 'Jalisco',
      }).catch((e: unknown) => e)
      expect(isApiError(error, 'not_authorized')).toBe(true)
    } finally {
      await setVolunteerActive(true)
    }
  })

  it('maps a rejected value to validation', async () => {
    await signInAs('volunteer')
    const person = await insertPerson(`Prueba Validación ${uniqueSuffix()}`)
    const error = await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, {
      first_name: '   ',
    }).catch((e: unknown) => e)
    expect(isApiError(error, 'validation')).toBe(true)
  })
})

describe('operator name header', () => {
  it('reaches the audit log through the shared client', async () => {
    await signInAs('volunteer')
    setOperatorName('Ana Pérez y Ñandú')
    const person = await insertPerson(`Prueba Auditoría ${uniqueSuffix()}`)
    await signInAs('admin')
    const { data, error } = await supabase
      .from('audit_log')
      .select('operator_name, actor_role')
      .eq('table_name', 'people')
      .eq('record_id', person.id)
      .eq('action', 'insert')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({ operator_name: 'Ana Pérez y Ñandú', actor_role: 'volunteer' })
  })

  it('records no operator name when none is set', async () => {
    await signInAs('legal')
    const person = await insertPerson(`Prueba Sin Operador ${uniqueSuffix()}`)
    await signInAs('admin')
    const { data, error } = await supabase
      .from('audit_log')
      .select('operator_name')
      .eq('table_name', 'people')
      .eq('record_id', person.id)
      .eq('action', 'insert')
      .single()
    expect(error).toBeNull()
    expect(data?.operator_name).toBeNull()
  })
})
