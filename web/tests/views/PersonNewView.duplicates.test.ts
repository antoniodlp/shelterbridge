import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { type DuplicateCandidate, findPossibleDuplicates, registerAndCheckIn } from '@/api/people'
import PersonNewView from '@/views/PersonNewView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/people', () => ({ registerAndCheckIn: vi.fn(), findPossibleDuplicates: vi.fn() }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(async () => []) }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const returning: DuplicateCandidate = {
  person_id: uuid(7),
  first_name: 'Rosa Elena',
  last_name: 'Pérez Lara',
  birth_date: '1996-04-12',
  country_code: 'HN',
  photo_path: null,
  score: 0.92,
  last_entry_date: '2026-08-01',
  last_exit_date: '2026-08-15',
}

async function mountWithCandidate() {
  const result = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
  await result.wrapper.find('#person-first-name').setValue('rosa elena')
  await result.wrapper.find('#person-last-name').setValue('perez')
  await vi.waitFor(
    () => expect(result.wrapper.find('[data-testid="duplicate-candidate"]').exists()).toBe(true),
    { timeout: 2000 },
  )
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findPossibleDuplicates).mockResolvedValue([returning])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonNewView duplicates', () => {
  it('looks for duplicates of what is being typed', async () => {
    await mountWithCandidate()
    expect(findPossibleDuplicates).toHaveBeenLastCalledWith({
      first_name: 'rosa elena',
      last_name: 'perez',
      birth_date: null,
      country_code: null,
    })
  })

  it('opens the existing record ready for a new stay when it is the same person', async () => {
    const { wrapper, router } = await mountWithCandidate()
    await wrapper.find('[data-testid="duplicate-candidate"] button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(router.currentRoute.value.params.id).toBe(uuid(7))
    expect(router.currentRoute.value.query.checkIn).toBe('1')
  })

  it('hides the panel and keeps the form when it is a new person', async () => {
    const { wrapper } = await mountWithCandidate()
    const newPerson = wrapper.findAll('button').find((button) => button.text() === 'Es una persona nueva')
    await newPerson?.trigger('click')
    expect(wrapper.find('[data-testid="duplicate-panel"]').exists()).toBe(false)
    expect((wrapper.find('#person-first-name').element as HTMLInputElement).value).toBe('rosa elena')
  })
})

function pressEnter(target: Element): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    bubbles: true,
    cancelable: true,
  })
  // Syncfusion's keyboard module reads the legacy `which`, which jsdom leaves at 0.
  Object.defineProperty(event, 'which', { value: 13 })
  target.dispatchEvent(event)
  return event
}

function newPersonButton(wrapper: Awaited<ReturnType<typeof mountWithApp>>['wrapper']) {
  return wrapper.findAll('button').find((button) => button.text() === 'Es una persona nueva')
}

describe('PersonNewView implicit submission', () => {
  it('does not register when Enter is pressed in a text field', async () => {
    const { wrapper } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
    await wrapper.find('#person-first-name').setValue('Rosa Elena')
    const event = pressEnter(wrapper.find('#person-first-name').element)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(registerAndCheckIn).not.toHaveBeenCalled()
  })

  it('does not register when Enter confirms a typed birth date, and the date still applies', async () => {
    const { wrapper } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
    const input = wrapper.find('#person-birth-date')
    ;(input.element as HTMLInputElement).value = '12/04/1996'
    await input.trigger('input')
    const event = pressEnter(input.element)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(registerAndCheckIn).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="person-age"]').exists()).toBe(true)
  })

  it('leaves Enter alone on buttons and in the notes field', async () => {
    const { wrapper } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
    expect(pressEnter(wrapper.find('#stay-notes').element).defaultPrevented).toBe(false)
    expect(pressEnter(wrapper.find('button[type="submit"]').element).defaultPrevented).toBe(false)
  })
})

describe('PersonNewView duplicate check before saving', () => {
  beforeEach(() => {
    vi.mocked(registerAndCheckIn).mockResolvedValue({ person_id: uuid(1), stay_id: uuid(101) })
  })

  it('waits for the lookup of what was just typed and stops when it finds someone new', async () => {
    const { wrapper, router } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
    await wrapper.find('#person-first-name').setValue('rosa elena')
    await wrapper.find('#person-last-name').setValue('perez')
    // Straight after typing: the 400 ms debounce has not fired yet.
    expect(findPossibleDuplicates).not.toHaveBeenCalled()
    await wrapper.find('form.registration-form').trigger('submit')
    await flushPromises()
    expect(findPossibleDuplicates).toHaveBeenCalledTimes(1)
    expect(registerAndCheckIn).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="duplicate-candidate"]').exists()).toBe(true)
    expect(router.currentRoute.value.name).toBe('person-new')
    // Nothing is lost and the form is open again.
    expect((wrapper.find('#person-first-name').element as HTMLInputElement).value).toBe('rosa elena')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('brings the panel into view and moves focus to its heading when it stops', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      const { wrapper } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
      await wrapper.find('#person-first-name').setValue('rosa elena')
      await wrapper.find('form.registration-form').trigger('submit')
      await flushPromises()
      const panel = wrapper.find('[data-testid="duplicate-panel"]')
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView.mock.contexts[0]).toBe(panel.element)
      expect(document.activeElement).toBe(panel.find('h2').element)
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('registers on the next submit once the person has said they are new', async () => {
    const { wrapper, router } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
    await wrapper.find('#person-first-name').setValue('rosa elena')
    await wrapper.find('form.registration-form').trigger('submit')
    await flushPromises()
    expect(registerAndCheckIn).not.toHaveBeenCalled()
    await newPersonButton(wrapper)?.trigger('click')
    await wrapper.find('form.registration-form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
  })

  it('registers when the panel was already showing the same people at submit time', async () => {
    const { wrapper, router } = await mountWithCandidate()
    await wrapper.find('form.registration-form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
  })

  it('registers when nobody looks alike', async () => {
    vi.mocked(findPossibleDuplicates).mockResolvedValue([])
    const { wrapper, router } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
    await wrapper.find('#person-first-name').setValue('rosa elena')
    await wrapper.find('form.registration-form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(findPossibleDuplicates).toHaveBeenCalledTimes(1)
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
  })

  it('still registers when the lookup fails', async () => {
    vi.mocked(findPossibleDuplicates).mockRejectedValue(new Error('offline'))
    const { wrapper, router } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
    await wrapper.find('#person-first-name').setValue('rosa elena')
    await wrapper.find('form.registration-form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
  })

  it('sends one lookup and one registration when the form is submitted twice while waiting', async () => {
    let answer: (value: DuplicateCandidate[]) => void = () => {}
    vi.mocked(findPossibleDuplicates).mockImplementation(
      () =>
        new Promise<DuplicateCandidate[]>((resolve) => {
          answer = resolve
        }),
    )
    const { wrapper, router } = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
    await wrapper.find('#person-first-name').setValue('rosa elena')
    const form = wrapper.find('form.registration-form')
    void form.trigger('submit')
    void form.trigger('submit')
    await flushPromises()
    expect(findPossibleDuplicates).toHaveBeenCalledTimes(1)
    expect(registerAndCheckIn).not.toHaveBeenCalled()
    answer([])
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(findPossibleDuplicates).toHaveBeenCalledTimes(1)
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
  })

  it('does not open a candidate while a registration is being saved', async () => {
    vi.mocked(registerAndCheckIn).mockReturnValue(new Promise(() => {}))
    const { wrapper, router } = await mountWithCandidate()
    void wrapper.find('form.registration-form').trigger('submit')
    await flushPromises()
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
    await wrapper.find('[data-testid="duplicate-candidate"] button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('person-new')
  })
})

describe('PersonNewView duplicate panel position', () => {
  it('comes right after the person section, before the stay section and the submit button', async () => {
    const { wrapper } = await mountWithCandidate()
    const panels = wrapper.findAll('[data-testid="duplicate-panel"]')
    expect(panels).toHaveLength(1)
    const panel = panels[0].element
    const follows = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(wrapper.find('#person-first-name').element, panel)).toBe(true)
    expect(follows(panel, wrapper.find('#stay-bed').element)).toBe(true)
    expect(follows(panel, wrapper.find('button[type="submit"]').element)).toBe(true)
  })
})
