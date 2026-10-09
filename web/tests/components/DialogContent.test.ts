import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import CatalogItemDialog from '@/components/admin/CatalogItemDialog.vue'
import OutingEditDialog from '@/components/outings/OutingEditDialog.vue'
import OutingStartDialog from '@/components/outings/OutingStartDialog.vue'
import CheckOutDialog from '@/components/stays/CheckOutDialog.vue'
import StayEditDialog from '@/components/stays/StayEditDialog.vue'
import { makeOuting, makeResidentRow, makeStay } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'
import { body } from '../utils/syncfusion'

afterEach(() => {
  document.body.innerHTML = ''
})

// The Syncfusion Dialog moves whatever nodes it finds at creation into its padded
// content area (.e-dlg-content). The forms render only while a dialog is open, and
// every dialog mounts closed, so the form must still land inside that area when the
// dialog opens later. Otherwise it shows beside the content area, without padding.
describe('dialog forms render inside the dialog content area', () => {
  const cases: Array<{
    name: string
    component: Component
    closed: Record<string, unknown>
    open: Record<string, unknown>
    form: string
  }> = [
    {
      name: 'CatalogItemDialog',
      component: CatalogItemDialog,
      closed: { open: false, catalog: 'genders', item: null, saving: false },
      open: { open: true },
      form: 'form.catalog-item-form',
    },
    {
      name: 'OutingStartDialog',
      component: OutingStartDialog,
      closed: { name: null },
      open: { name: 'Rosa Elena Pérez Lara' },
      form: 'form.outing-start-form',
    },
    {
      name: 'OutingEditDialog',
      component: OutingEditDialog,
      closed: { outing: null, saving: false },
      open: { outing: makeOuting() },
      form: 'form.outing-edit-form',
    },
    {
      name: 'CheckOutDialog',
      component: CheckOutDialog,
      closed: { resident: null },
      open: { resident: makeResidentRow() },
      form: 'form.check-out-form',
    },
    {
      name: 'StayEditDialog',
      component: StayEditDialog,
      closed: { stay: null, saving: false },
      open: { stay: makeStay() },
      form: 'form.stay-edit-form',
    },
  ]

  it.each(cases)('$name', async ({ component, closed, open, form }) => {
    const { wrapper } = await mountWithApp(component, { props: closed })
    expect(body().find(form).exists()).toBe(false)
    await wrapper.setProps(open)
    await vi.waitFor(() => expect(body().find(form).exists()).toBe(true))
    expect(body().find(`.e-dialog .e-dlg-content ${form}`).exists()).toBe(true)
  })
})
