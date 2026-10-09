import { afterEach, describe, expect, it, vi } from 'vitest'
import CheckOutDialog from '@/components/stays/CheckOutDialog.vue'
import type { ResidentRow } from '@/composables/useResidents'
import { todayIn } from '@/lib/shelterTime'
import { makeResidentRow as makeRow, uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'
import { body, typeInto } from '../../utils/syncfusion'

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

async function open(resident: ResidentRow): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(CheckOutDialog, { props: { resident } })
  await vi.waitFor(() => expect(body().find('#check-out-date').exists()).toBe(true))
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CheckOutDialog', () => {
  it('defaults the exit date to today in the shelter timezone and confirms it', async () => {
    const today = todayIn('America/Mexico_City')
    const w = await open(makeRow())
    const [year, month, day] = today.split('-')
    expect((body().find('#check-out-date').element as HTMLInputElement).value).toBe(`${day}/${month}/${year}`)
    expect(body().text()).toContain('Rosa Elena Pérez Lara')
    await body().find('form.check-out-form').trigger('submit')
    expect(w.emitted('confirm')).toEqual([[today]])
  })

  it('shows no warnings for a person inside with no phone in custody', async () => {
    await open(makeRow())
    expect(body().find('[data-testid="phone-warning"]').exists()).toBe(false)
    expect(body().find('[data-testid="outside-warning"]').exists()).toBe(false)
  })

  it('reminds staff to return a phone in custody', async () => {
    await open(makeRow({ phone_status: 'in_custody' }))
    expect(body().find('[data-testid="phone-warning"]').text()).toContain('devolver el teléfono')
  })

  it('warns that a person who is outside will be recorded as not returned', async () => {
    await open(makeRow({ presence: 'outside' }))
    expect(body().find('[data-testid="outside-warning"]').text()).toContain(
      'se registrará como salió y no regresó',
    )
  })

  it('rejects an exit date before the entry date', async () => {
    const w = await open(makeRow({ entry_date: '2026-10-03' }))
    await typeInto(body().find('#check-out-date'), '01/10/2026')
    await body().find('form.check-out-form').trigger('submit')
    expect(body().text()).toContain('La fecha de egreso no puede ser anterior a la de ingreso.')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('starts again from today each time it opens', async () => {
    const w = await open(makeRow())
    await typeInto(body().find('#check-out-date'), '01/10/2026')
    await w.setProps({ resident: null })
    await w.setProps({ resident: makeRow({ stay_id: uuid(102) }) })
    await vi.waitFor(() => expect(body().find('#check-out-date').exists()).toBe(true))
    const [year, month, day] = todayIn('America/Mexico_City').split('-')
    expect((body().find('#check-out-date').element as HTMLInputElement).value).toBe(`${day}/${month}/${year}`)
  })

  it('rejects an exit date in the future', async () => {
    const nextYear = Number(todayIn('America/Mexico_City').slice(0, 4)) + 1
    const w = await open(makeRow())
    await typeInto(body().find('#check-out-date'), `01/01/${nextYear}`)
    await body().find('form.check-out-form').trigger('submit')
    expect(body().text()).toContain('La fecha no puede ser posterior a hoy.')
    expect(w.emitted('confirm')).toBeUndefined()
  })
})
