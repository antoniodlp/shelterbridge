import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCatalogItem, listCatalog, updateCatalogItem } from '@/api/catalogs'
import { ApiError } from '@/api/errors'
import type { CatalogItem, CatalogName } from '@/types/domain'
import CatalogsView from '@/views/admin/CatalogsView.vue'
import { STAMP } from '../../fixtures/data'
import { mountWithApp, testCatalogs } from '../../utils/mountWithApp'
import { body } from '../../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/catalogs', () => ({
  listCatalog: vi.fn(),
  createCatalogItem: vi.fn(),
  updateCatalogItem: vi.fn(),
}))

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

const returnee: CatalogItem = {
  code: 'returnee',
  labels: { es: 'Persona retornada' },
  sort_order: 3,
  active: true,
  updated_at: STAMP,
}

async function mountView(): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(CatalogsView, { initialRoute: '/admin/catalogs', session: { role: 'admin' } })
  return wrapper
}

function buttonLabeled<T extends { text(): string }>(buttons: T[], label: string): T {
  const found = buttons.find((candidate) => candidate.text() === label)
  if (!found) throw new Error(`No ${label} button`)
  return found
}

function rowTexts(wrapper: Wrapper): string[] {
  return wrapper.findAll('[data-testid="catalog-row"]').map((row) => row.find('td').text())
}

async function openNewDialog(wrapper: Wrapper): Promise<void> {
  await buttonLabeled(wrapper.findAll('button'), 'Agregar').trigger('click')
  await vi.waitFor(() => expect(body().find('#catalog-code').exists()).toBe(true))
}

async function fillNewValue(): Promise<void> {
  await body().find('#catalog-code').setValue('returnee')
  await body().find('#catalog-label-es').setValue('Persona retornada')
  await body().find('#catalog-order').setValue('3')
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCatalog).mockImplementation(async (name: CatalogName) => testCatalogs[name])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CatalogsView', () => {
  it('lists the chosen catalog in its display order', async () => {
    const w = await mountView()
    expect(rowTexts(w)).toEqual(['migrant_in_transit', 'asylum_seeker'])
    await buttonLabeled(w.findAll('button'), 'Países').trigger('click')
    expect(rowTexts(w)).toEqual(['MX', 'HN', 'GT'])
  })

  it('adds a value and refreshes the pickers', async () => {
    vi.mocked(createCatalogItem).mockResolvedValue(returnee)
    vi.mocked(listCatalog).mockImplementation(async (name: CatalogName) =>
      name === 'case_types' ? [...testCatalogs.case_types, returnee] : testCatalogs[name],
    )
    const w = await mountView()
    await openNewDialog(w)
    await fillNewValue()
    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() =>
      expect(createCatalogItem).toHaveBeenCalledWith('case_types', {
        code: 'returnee',
        labels: { es: 'Persona retornada' },
        sort_order: 3,
        active: true,
      }),
    )
    expect(listCatalog).toHaveBeenCalledWith('case_types')
    expect(notify.success).toHaveBeenCalledWith('admin.catalogs.saved')
    await vi.waitFor(() => expect(rowTexts(w)).toEqual(['migrant_in_transit', 'asylum_seeker', 'returnee']))
    expect(body().find('form.catalog-item-form').exists()).toBe(false)
  })

  it('rejects a malformed code before calling the server', async () => {
    const w = await mountView()
    await openNewDialog(w)
    await body().find('#catalog-code').setValue('Caso Nuevo')
    await body().find('#catalog-label-es').setValue('Caso nuevo')
    await body().find('form.catalog-item-form').trigger('submit')
    expect(body().text()).toContain('El código no tiene el formato correcto.')
    expect(createCatalogItem).not.toHaveBeenCalled()
  })

  it('closes the dialog and shows the current list when someone else changed the value', async () => {
    vi.mocked(updateCatalogItem).mockRejectedValue(new ApiError('stale_record'))
    const w = await mountView()
    const row = w.findAll('[data-testid="catalog-row"]')[1]
    if (!row) throw new Error('missing row')
    await buttonLabeled(row.findAll('button'), 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('form.catalog-item-form').exists()).toBe(true))
    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'stale_record' })))
    await vi.waitFor(() => expect(body().find('form.catalog-item-form').exists()).toBe(false))
    expect(listCatalog).toHaveBeenCalledWith('case_types')
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('edits labels, order and status but never the code', async () => {
    vi.mocked(updateCatalogItem).mockResolvedValue({
      code: 'asylum_seeker',
      labels: { es: 'Persona solicitante de asilo' },
      sort_order: 2,
      active: false,
      updated_at: STAMP,
    })
    const asylum = testCatalogs.case_types.find((item) => item.code === 'asylum_seeker')
    const w = await mountView()
    const row = w.findAll('[data-testid="catalog-row"]')[1]
    if (!row) throw new Error('missing row')
    await buttonLabeled(row.findAll('button'), 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#catalog-code').exists()).toBe(true))
    expect(body().find('#catalog-code').attributes('readonly')).toBeDefined()
    await body().find('#catalog-label-es').setValue('Persona solicitante de asilo')
    await body().find('#catalog-active').setValue(false)
    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() =>
      expect(updateCatalogItem).toHaveBeenCalledWith('case_types', 'asylum_seeker', asylum?.updated_at, {
        labels: { es: 'Persona solicitante de asilo' },
        sort_order: 2,
        active: false,
      }),
    )
  })

  it('keeps the form open after a failed save, so the same save can be sent again', async () => {
    vi.mocked(createCatalogItem).mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(returnee)
    const w = await mountView()
    await openNewDialog(w)
    await fillNewValue()
    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'network' })))
    expect(notify.success).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(body().find('button[type="submit"]').attributes('disabled')).toBeUndefined())
    expect((body().find('#catalog-code').element as HTMLInputElement).value).toBe('returnee')

    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith('admin.catalogs.saved'))
    expect(createCatalogItem).toHaveBeenCalledTimes(2)
    expect(vi.mocked(createCatalogItem).mock.calls[1]).toEqual(vi.mocked(createCatalogItem).mock.calls[0])
  })

  it('does not report a failed list reload after a saved change as a failed save', async () => {
    vi.mocked(createCatalogItem).mockResolvedValue(returnee)
    const w = await mountView()
    await openNewDialog(w)
    await fillNewValue()
    vi.mocked(listCatalog).mockRejectedValueOnce(new ApiError('network'))
    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'network' })))
    expect(notify.success).toHaveBeenCalledWith('admin.catalogs.saved')
    expect(notify.error).toHaveBeenCalledTimes(1)
    // The write is committed, so the form is gone and cannot send the same new code again.
    await vi.waitFor(() => expect(body().find('form.catalog-item-form').exists()).toBe(false))
    expect(createCatalogItem).toHaveBeenCalledTimes(1)
    expect(rowTexts(w)).toEqual(['migrant_in_transit', 'asylum_seeker'])
  })

  it('sends one request when the form is submitted twice while saving', async () => {
    const pending = deferred<CatalogItem>()
    vi.mocked(createCatalogItem).mockReturnValue(pending.promise)
    const w = await mountView()
    await openNewDialog(w)
    await fillNewValue()
    await body().find('form.catalog-item-form').trigger('submit')
    await body().find('form.catalog-item-form').trigger('submit')
    expect(createCatalogItem).toHaveBeenCalledTimes(1)
    pending.resolve(returnee)
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith('admin.catalogs.saved'))
    expect(createCatalogItem).toHaveBeenCalledTimes(1)
  })

  it('does not close a dialog opened again while an earlier save was still running', async () => {
    const pending = deferred<CatalogItem>()
    vi.mocked(createCatalogItem).mockReturnValue(pending.promise)
    const w = await mountView()
    await openNewDialog(w)
    await fillNewValue()
    await body().find('form.catalog-item-form').trigger('submit')
    await buttonLabeled(body().findAll('button'), 'Cancelar').trigger('click')
    await vi.waitFor(() => expect(body().find('form.catalog-item-form').exists()).toBe(false))
    const row = w.findAll('[data-testid="catalog-row"]')[0]
    if (!row) throw new Error('missing row')
    await buttonLabeled(row.findAll('button'), 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('form.catalog-item-form').exists()).toBe(true))
    pending.resolve(returnee)
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith('admin.catalogs.saved'))
    expect(body().find('form.catalog-item-form').exists()).toBe(true)
  })

  it('refreshes the catalog that was saved, even if another tab is chosen meanwhile', async () => {
    const pending = deferred<CatalogItem>()
    vi.mocked(createCatalogItem).mockReturnValue(pending.promise)
    const w = await mountView()
    await openNewDialog(w)
    await fillNewValue()
    await body().find('form.catalog-item-form').trigger('submit')
    await buttonLabeled(w.findAll('button'), 'Países').trigger('click')
    pending.resolve(returnee)
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith('admin.catalogs.saved'))
    expect(createCatalogItem).toHaveBeenCalledWith('case_types', expect.objectContaining({ code: 'returnee' }))
    expect(listCatalog).toHaveBeenCalledWith('case_types')
    expect(listCatalog).not.toHaveBeenCalledWith('countries')
  })
})
