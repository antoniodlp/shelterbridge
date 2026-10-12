import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { type PersonSearchResult, searchPeople } from '@/api/people'
import { getSignedPhotoUrls } from '@/api/photos'
import PeopleSearchView from '@/views/PeopleSearchView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/people', () => ({ searchPeople: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

function result(overrides: Partial<PersonSearchResult>): PersonSearchResult {
  return {
    person_id: uuid(1),
    first_name: 'Rosa Elena',
    last_name: 'Pérez Lara',
    birth_date: '1996-04-12',
    country_code: 'HN',
    photo_path: null,
    score: 0.9,
    last_entry_date: '2026-08-01',
    last_exit_date: '2026-08-15',
    has_open_stay: false,
    ...overrides,
  }
}

async function mountView() {
  return mountWithApp(PeopleSearchView, { initialRoute: '/people/search', session: { role: 'legal' } })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PeopleSearchView', () => {
  it('asks for at least two letters before searching', async () => {
    const { wrapper } = await mountView()
    await wrapper.find('#people-search-query').setValue(' é ')
    await wrapper.find('form.people-search-form').trigger('submit')
    expect(searchPeople).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe al menos 2 letras para buscar.')
  })

  it('lists matches with a link to each record, staying status and last stay', async () => {
    vi.mocked(searchPeople).mockResolvedValue([
      result({ photo_path: `${uuid(1)}.jpg` }),
      result({
        person_id: uuid(2),
        first_name: 'Tomás',
        last_name: 'Gutiérrez',
        has_open_stay: true,
        last_exit_date: null,
      }),
    ])
    const { wrapper } = await mountView()
    await wrapper.find('#people-search-query').setValue('  perez ')
    await wrapper.find('form.people-search-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="search-result"]')).toHaveLength(2))
    expect(searchPeople).toHaveBeenCalledWith('perez')
    const [rosa, tomas] = wrapper.findAll('[data-testid="search-result"]')
    expect(rosa?.find('a').attributes('href')).toBe(`/people/${uuid(1)}`)
    expect(rosa?.text()).toContain('Honduras')
    expect(rosa?.text()).toContain('01/08/2026 a 15/08/2026')
    expect(tomas?.text()).toContain('En el albergue')
    expect(getSignedPhotoUrls).toHaveBeenCalledWith([`${uuid(1)}_thumb.jpg`], 600)
  })

  it('says when nobody matches', async () => {
    vi.mocked(searchPeople).mockResolvedValue([])
    const { wrapper } = await mountView()
    await wrapper.find('#people-search-query').setValue('zzzz')
    await wrapper.find('form.people-search-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No encontramos a nadie con ese nombre.'))
  })

  it('sends one request when the form is submitted twice before the answer arrives', async () => {
    let answer: (rows: PersonSearchResult[]) => void = () => undefined
    vi.mocked(searchPeople).mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const { wrapper } = await mountView()
    await wrapper.find('#people-search-query').setValue('Rosa')
    await wrapper.find('form.people-search-form').trigger('submit')
    await wrapper.find('form.people-search-form').trigger('submit')
    expect(searchPeople).toHaveBeenCalledTimes(1)
    answer([result({})])
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="search-result"]')).toHaveLength(1))
  })

  it('reports a failed search and shows no results', async () => {
    const failure = new ApiError('network')
    vi.mocked(searchPeople).mockRejectedValue(failure)
    const { wrapper } = await mountView()
    await wrapper.find('#people-search-query').setValue('Rosa')
    await wrapper.find('form.people-search-form').trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(failure))
    expect(wrapper.find('[data-testid="search-result"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No encontramos a nadie')
  })

  it('never puts the searched name in the URL', async () => {
    vi.mocked(searchPeople).mockResolvedValue([result({})])
    const { wrapper, router } = await mountView()
    await wrapper.find('#people-search-query').setValue('Rosa Elena')
    await wrapper.find('form.people-search-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="search-result"]')).toHaveLength(1))
    expect(router.currentRoute.value.fullPath).toBe('/people/search')
  })
})
