import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { GridComponent } from '@syncfusion/ej2-vue-grids'
import { endOuting } from '@/api/outings'
import { getSignedPhotoUrls } from '@/api/photos'
import { listCurrentResidents } from '@/api/stays'
import type { CurrentResident } from '@/types/domain'
import ResidentsView from '@/views/ResidentsView.vue'
import { makeResident, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(), checkOut: vi.fn() }))
vi.mock('@/api/outings', () => ({ startOuting: vi.fn(), endOuting: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
  uploadPersonPhoto: vi.fn(),
}))

const residents = [
  makeResident({
    stay_id: uuid(101),
    person_id: uuid(1),
    photo_path: `${uuid(1)}.jpg`,
  }),
  makeResident({
    stay_id: uuid(102),
    person_id: uuid(2),
    first_name: 'Tomás',
    last_name: 'Gutiérrez',
    gender_code: 'male',
    country_code: 'MX',
    bed: 'B2',
    phone_status: 'in_custody',
    presence: 'outside',
    out_since: '2026-10-07T16:30:00+00:00',
    open_outing_id: uuid(201),
  }),
  makeResident({
    stay_id: uuid(103),
    person_id: uuid(3),
    first_name: 'Lucía',
    last_name: 'Martínez',
    bed: 'C1',
    age: 15,
    birth_date: '2011-05-01',
    is_minor: true,
    is_unaccompanied_minor: true,
  }),
  // A minor whose carer (Rosa Elena) is staying too.
  makeResident({
    stay_id: uuid(104),
    person_id: uuid(4),
    first_name: 'Diego',
    last_name: 'Ramos',
    bed: 'A1',
    age: 8,
    birth_date: '2018-02-10',
    carer_id: uuid(1),
    is_minor: true,
    is_unaccompanied_minor: false,
  }),
]

// mountWithApp defaults: /residents, a volunteer on shift, America/Mexico_City, testCatalogs.
function mountView() {
  return mountWithApp(ResidentsView)
}

async function mountLoaded() {
  const result = await mountView()
  await vi.waitFor(() => expect(result.wrapper.findAll('.e-row')).toHaveLength(residents.length), { timeout: 5000 })
  return result
}

function rowFor(wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], text: string) {
  const row = wrapper.findAll('.e-row').find((candidate) => candidate.text().includes(text))
  if (!row) throw new Error(`No row contains ${text}`)
  return row
}

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue(residents)
  vi.mocked(getSignedPhotoUrls).mockResolvedValue({
    [`${uuid(1)}_thumb.jpg`]: 'https://storage.test/rosa_thumb.jpg',
  })
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
  document.body.innerHTML = ''
})

describe('ResidentsView', () => {
  it('keeps the Residentes heading', async () => {
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('h1').text()).toBe('Residentes')
  })

  it('shows the headcount', async () => {
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('[data-testid="count-total"]').text()).toBe('4')
    expect(wrapper.find('[data-testid="count-inside"]').text()).toBe('3')
    expect(wrapper.find('[data-testid="count-outside"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="count-minors"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="count-unaccompanied"]').text()).toBe('1')
  })

  it('shows the columns in the agreed order', async () => {
    const { wrapper } = await mountLoaded()
    const headers = wrapper.findAll('.e-headercell .e-headertext').map((header) => header.text())
    expect(headers).toEqual([
      'Foto',
      'Nombre',
      'Apellidos',
      'Edad',
      'Acompañamiento',
      'Cama',
      'Ingreso',
      'Días',
      'Presencia',
      'Fuera desde',
      'Teléfono',
      'Acciones',
    ])
  })

  it('shows the first and last name in separate cells', async () => {
    const { wrapper } = await mountLoaded()
    const cells = rowFor(wrapper, 'Rosa Elena')
      .findAll('td')
      .map((cell) => cell.text())
    expect(cells).toContain('Rosa Elena')
    expect(cells).toContain('Pérez Lara')
  })

  it('shows the age in red only for minors', async () => {
    const { wrapper } = await mountLoaded()
    const rosaAge = rowFor(wrapper, 'Rosa Elena').find('[data-testid="age"]')
    expect(rosaAge.text()).toBe('30')
    expect(rosaAge.classes()).not.toContain('text-danger')

    const luciaAge = rowFor(wrapper, 'Lucía').find('[data-testid="age"]')
    expect(luciaAge.text()).toBe('15')
    expect(luciaAge.classes()).toContain('text-danger')
  })

  it('shows the carer name, or the unaccompanied badge, in the Acompañamiento column', async () => {
    const { wrapper } = await mountLoaded()
    const diego = rowFor(wrapper, 'Diego')
    expect(diego.find('[data-testid="carer-name"]').text()).toBe('Rosa Elena Pérez Lara')
    expect(diego.find('[data-testid="unaccompanied-badge"]').exists()).toBe(false)

    const lucia = rowFor(wrapper, 'Lucía')
    expect(lucia.find('[data-testid="carer-name"]').exists()).toBe(false)
    expect(lucia.find('[data-testid="unaccompanied-badge"]').text()).toBe('Menor sin acompañante')

    const rosa = rowFor(wrapper, 'Rosa Elena')
    expect(rosa.find('[data-testid="carer-name"]').exists()).toBe(false)
    expect(rosa.find('[data-testid="unaccompanied-badge"]').exists()).toBe(false)
  })

  it('shows the phone status as a label', async () => {
    const { wrapper } = await mountLoaded()
    expect(rowFor(wrapper, 'Rosa Elena').text()).toContain('Sin teléfono')
    expect(rowFor(wrapper, 'Tomás').text()).toContain('En resguardo')
  })

  it('shows dates and presence', async () => {
    const { wrapper } = await mountLoaded()
    const rosa = rowFor(wrapper, 'Rosa Elena')
    expect(rosa.text()).toContain('03/10/2026')
    expect(rosa.find('[data-testid="presence"]').attributes('data-presence')).toBe('inside')

    const tomas = rowFor(wrapper, 'Tomás')
    expect(tomas.find('[data-testid="presence"]').attributes('data-presence')).toBe('outside')
    expect(tomas.text()).toContain('07/10/2026 10:30')
  })

  it('signs every thumbnail in one request and shows it', async () => {
    const { wrapper } = await mountLoaded()
    expect(getSignedPhotoUrls).toHaveBeenCalledTimes(1)
    expect(getSignedPhotoUrls).toHaveBeenCalledWith([`${uuid(1)}_thumb.jpg`], 600)
    await vi.waitFor(
      () => expect(wrapper.find('img[src="https://storage.test/rosa_thumb.jpg"]').exists()).toBe(true),
      { timeout: 5000 },
    )
  })

  it('shows the rows and reports nothing when signing the thumbnails fails', async () => {
    vi.mocked(getSignedPhotoUrls).mockRejectedValue(new Error('storage down'))
    const { wrapper } = await mountLoaded()
    await flushPromises()
    expect(wrapper.find('img[src^="https://storage.test"]').exists()).toBe(false)
    expect(rowFor(wrapper, 'Rosa Elena').exists()).toBe(true)
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('does not wait for the thumbnails before the list is ready again', async () => {
    vi.mocked(getSignedPhotoUrls).mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountLoaded()
    const refresh = wrapper.findAll('button').find((button) => button.text() === 'Actualizar')
    await vi.waitFor(() => expect(refresh?.attributes('disabled')).toBeUndefined())
  })

  it('releases the row actions after the reload even when signing the thumbnails hangs', async () => {
    vi.mocked(getSignedPhotoUrls).mockReturnValue(new Promise(() => {}))
    vi.mocked(endOuting).mockResolvedValue(uuid(201))
    const { wrapper } = await mountLoaded()
    let finishReload: (rows: CurrentResident[]) => void = () => {}
    vi.mocked(listCurrentResidents).mockReturnValueOnce(
      new Promise<CurrentResident[]>((resolve) => {
        finishReload = resolve
      }),
    )
    const rosaSalida = () =>
      rowFor(wrapper, 'Rosa Elena')
        .findAll('button')
        .find((button) => button.text() === 'Salida')?.element as HTMLButtonElement
    const regreso = rowFor(wrapper, 'Tomás').findAll('button').find((button) => button.text() === 'Regreso')
    await regreso?.trigger('click')
    await vi.waitFor(() => expect(rosaSalida().disabled).toBe(true), { timeout: 5000 })
    finishReload(residents)
    await vi.waitFor(() => expect(rosaSalida().disabled).toBe(false), { timeout: 5000 })
  })

  it('filters by name or bed, ignoring accents and case', async () => {
    const { wrapper } = await mountLoaded()
    await wrapper.find('#residents-search').setValue('perez')
    await vi.waitFor(() => expect(wrapper.findAll('.e-row')).toHaveLength(1), { timeout: 5000 })
    expect(wrapper.find('.e-row').text()).toContain('Rosa Elena')
    await wrapper.find('#residents-search').setValue('c1')
    await vi.waitFor(() => expect(wrapper.find('.e-row').text()).toContain('Lucía'), { timeout: 5000 })
  })

  it('links the photo, first name and last name to the person record by id only', async () => {
    const { wrapper } = await mountLoaded()
    const links = rowFor(wrapper, 'Rosa Elena').findAll(`a[href="/people/${uuid(1)}"]`)
    expect(links).toHaveLength(3)
    expect(links[0].find('img').exists()).toBe(true)
    expect(links[1].text()).toBe('Rosa Elena')
    expect(links[2].text()).toBe('Pérez Lara')
    expect(wrapper.text()).not.toContain('Ver ficha')
  })

  it('opens the person record from the name', async () => {
    const { wrapper, router } = await mountLoaded()
    const name = rowFor(wrapper, 'Tomás').findAll('a').find((link) => link.text() === 'Tomás')
    await name?.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(`/people/${uuid(2)}`))
  })

  it('uses the adaptive grid layout on narrow screens', async () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
    const { wrapper } = await mountLoaded()
    const grid = wrapper.findComponent(GridComponent)
    expect(grid.props('rowRenderingMode')).toBe('Vertical')
    expect(grid.props('enableAdaptiveUI')).toBe(true)
  })

  it('reports a failed load', async () => {
    vi.mocked(listCurrentResidents).mockRejectedValueOnce(new Error('boom'))
    await mountView()
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalled())
  })
})
