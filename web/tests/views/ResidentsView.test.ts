import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GridComponent } from '@syncfusion/ej2-vue-grids'
import { getSignedPhotoUrls } from '@/api/photos'
import { listCurrentResidents } from '@/api/stays'
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
    birth_date_estimated: true,
  }),
  makeResident({
    stay_id: uuid(102),
    person_id: uuid(2),
    first_name: 'Tomás',
    last_name: 'Gutiérrez',
    gender_code: 'male',
    country_code: 'MX',
    bed: 'B2',
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
    expect(wrapper.find('[data-testid="count-total"]').text()).toBe('3')
    expect(wrapper.find('[data-testid="count-inside"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="count-outside"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="count-minors"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="count-unaccompanied"]').text()).toBe('1')
  })

  it('lists residents with catalog labels, estimated age, dates and badges', async () => {
    const { wrapper } = await mountLoaded()
    const rosa = rowFor(wrapper, 'Rosa Elena Pérez Lara')
    expect(rosa.text()).toContain('~30')
    expect(rosa.text()).toContain('Mujer')
    expect(rosa.text()).toContain('Honduras')
    expect(rosa.text()).toContain('03/10/2026')
    expect(rosa.find('[data-testid="presence"]').attributes('data-presence')).toBe('inside')
    expect(rosa.find('[data-testid="unaccompanied-badge"]').exists()).toBe(false)

    const tomas = rowFor(wrapper, 'Tomás Gutiérrez')
    expect(tomas.find('[data-testid="presence"]').attributes('data-presence')).toBe('outside')
    expect(tomas.text()).toContain('07/10/2026 10:30')

    const lucia = rowFor(wrapper, 'Lucía Martínez')
    expect(lucia.find('[data-testid="unaccompanied-badge"]').text()).toBe('Menor sin acompañante')
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

  it('filters by name or bed, ignoring accents and case', async () => {
    const { wrapper } = await mountLoaded()
    await wrapper.find('#residents-search').setValue('perez')
    await vi.waitFor(() => expect(wrapper.findAll('.e-row')).toHaveLength(1), { timeout: 5000 })
    expect(wrapper.find('.e-row').text()).toContain('Rosa Elena')
    await wrapper.find('#residents-search').setValue('c1')
    await vi.waitFor(() => expect(wrapper.find('.e-row').text()).toContain('Lucía'), { timeout: 5000 })
  })

  it('links each row to the person record by id only', async () => {
    const { wrapper } = await mountLoaded()
    expect(wrapper.find(`a[href="/people/${uuid(1)}"]`).text()).toBe('Ver ficha')
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
