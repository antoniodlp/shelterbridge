import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { getPerson, mergePeople, searchPeople } from '@/api/people'
import { listStaysForPerson } from '@/api/stays'
import MergeView from '@/views/admin/MergeView.vue'
import { makePerson, makeStay, uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/people', () => ({ searchPeople: vi.fn(), getPerson: vi.fn(), mergePeople: vi.fn() }))
vi.mock('@/api/stays', () => ({ listStaysForPerson: vi.fn() }))

const people = {
  [uuid(1)]: makePerson({ id: uuid(1), first_name: 'José Luis', last_name: 'Hernández', birth_date: '1979-03-11' }),
  [uuid(2)]: makePerson({ id: uuid(2), first_name: 'Jose Luis', last_name: 'Hernandez', birth_date: '1979-11-03' }),
}
const stays = {
  [uuid(1)]: [makeStay({ id: uuid(101), person_id: uuid(1), entry_date: '2026-09-01', exit_date: '2026-09-10' })],
  [uuid(2)]: [makeStay({ id: uuid(102), person_id: uuid(2), entry_date: '2026-09-05', exit_date: null })],
}

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

async function pick(wrapper: Wrapper, position: 'first' | 'second', personId: string): Promise<void> {
  await wrapper.find(`#merge-${position}-search`).setValue('jose luis')
  await wrapper.find(`form.merge-${position}-search-form`).trigger('submit')
  const result = `[data-testid="merge-${position}-result-${personId}"]`
  await vi.waitFor(() => expect(wrapper.find(result).exists()).toBe(true))
  await wrapper.find(result).trigger('click')
  await vi.waitFor(() => expect(wrapper.find(`[data-testid="merge-${position}-card"]`).exists()).toBe(true))
}

async function mountView() {
  return mountWithApp(MergeView, { initialRoute: '/admin/merge', session: { role: 'admin' } })
}

// Two different records, the second one chosen to keep.
async function mountWithBothPicked() {
  const mounted = await mountView()
  await pick(mounted.wrapper, 'first', uuid(1))
  await pick(mounted.wrapper, 'second', uuid(2))
  return mounted
}

afterEach(() => {
  document.body.innerHTML = ''
})

function mergeButton(wrapper: Wrapper) {
  const found = wrapper.findAll('button').find((button) => button.text() === 'Unir registros')
  if (!found) throw new Error('No merge button')
  return found
}

beforeEach(() => {
  // mockReset also drops once-queues and implementations a test left behind.
  vi.mocked(searchPeople).mockReset()
  vi.mocked(getPerson).mockReset()
  vi.mocked(mergePeople).mockReset()
  vi.mocked(listStaysForPerson).mockReset()
  notify.success.mockReset()
  notify.error.mockReset()
  confirm.mockReset()
  vi.mocked(searchPeople).mockResolvedValue(
    Object.values(people).map((person) => ({
      person_id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      birth_date: person.birth_date,
      birth_date_estimated: false,
      country_code: person.country_code,
      photo_path: null,
      score: 0.9,
      last_entry_date: null,
      last_exit_date: null,
      has_open_stay: false,
    })),
  )
  vi.mocked(getPerson).mockImplementation(async (id: string) => people[id] ?? makePerson({ id }))
  vi.mocked(listStaysForPerson).mockImplementation(async (id: string) => stays[id] ?? [])
  confirm.mockResolvedValue(true)
})

describe('MergeView', () => {
  it('merges the other record into the one chosen to keep, then opens it', async () => {
    vi.mocked(mergePeople).mockResolvedValue()
    const { wrapper, router } = await mountView()
    await pick(wrapper, 'first', uuid(1))
    await pick(wrapper, 'second', uuid(2))
    expect(mergeButton(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.find('#merge-keep-second').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(mergePeople).toHaveBeenCalledWith(uuid(2), uuid(1)))
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        messageKey: 'admin.merge.confirmMessage',
        messageParams: { survivor: 'Jose Luis Hernandez', duplicate: 'José Luis Hernández' },
        danger: true,
      }),
    )
    await vi.waitFor(() => expect(router.currentRoute.value.params.id).toBe(uuid(2)))
    expect(notify.success).toHaveBeenCalledWith('admin.merge.done')
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('shows both records side by side with their stays', async () => {
    const { wrapper } = await mountWithBothPicked()
    const first = wrapper.find('[data-testid="merge-first-card"]').text()
    expect(first).toContain('José Luis Hernández')
    expect(first).toContain('11/03/1979')
    expect(first).toContain('01/09/2026 a 10/09/2026')
    const second = wrapper.find('[data-testid="merge-second-card"]').text()
    expect(second).toContain('Jose Luis Hernandez')
    expect(second).toContain('03/11/1979')
    expect(second).toContain('desde 05/09/2026, abierta')
  })

  it('explains which stays overlap when the merge is refused', async () => {
    vi.mocked(mergePeople).mockRejectedValue(new ApiError('overlapping_stays'))
    const { wrapper } = await mountView()
    await pick(wrapper, 'first', uuid(1))
    await pick(wrapper, 'second', uuid(2))
    await wrapper.find('#merge-keep-first').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="merge-overlap"]')).toHaveLength(1))
    const text = wrapper.find('[data-testid="merge-overlap"]').text()
    expect(text).toContain('01/09/2026 a 10/09/2026')
    expect(text).toContain('desde 05/09/2026')
    expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'overlapping_stays' }))
    expect(notify.success).not.toHaveBeenCalled()
    // Nothing was merged and nothing is lost: both records stay on screen, ready to try again.
    expect(wrapper.find('[data-testid="merge-first-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-second-card"]').exists()).toBe(true)
  })

  it('links the overlapping row to the record to correct, by id', async () => {
    vi.mocked(mergePeople).mockRejectedValue(new ApiError('overlapping_stays'))
    const { wrapper } = await mountView()
    await pick(wrapper, 'first', uuid(1))
    await pick(wrapper, 'second', uuid(2))
    await wrapper.find('#merge-keep-first').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="merge-overlap"]')).toHaveLength(1))
    const link = wrapper.find('[data-testid="merge-overlap"] a')
    expect(link.attributes('href')).toBe(`/people/${uuid(2)}`)
  })

  it('hides the overlap explanation when another record is chosen', async () => {
    vi.mocked(mergePeople).mockRejectedValue(new ApiError('overlapping_stays'))
    const { wrapper } = await mountWithBothPicked()
    await wrapper.find('#merge-keep-first').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="merge-overlap"]')).toHaveLength(1))
    await wrapper.find('[data-testid="merge-second-card"] button.btn-link').trigger('click')
    expect(wrapper.findAll('[data-testid="merge-overlap"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="merge-second-card"]').exists()).toBe(false)
    expect(wrapper.find('#merge-second-search').exists()).toBe(true)
  })

  it('refuses to merge a record with itself', async () => {
    const { wrapper } = await mountView()
    await pick(wrapper, 'first', uuid(1))
    await pick(wrapper, 'second', uuid(1))
    expect(wrapper.text()).toContain('Elegiste el mismo registro dos veces.')
    expect(mergeButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('does not merge when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false)
    const { wrapper, router } = await mountWithBothPicked()
    await wrapper.find('#merge-keep-first').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    await flushPromises()
    expect(mergePeople).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('admin-merge')
    // The choice is kept, and the button works again.
    expect(mergeButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('keeps both records and the choice when the merge fails, so it can be tried again', async () => {
    vi.mocked(mergePeople).mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce()
    const { wrapper, router } = await mountWithBothPicked()
    await wrapper.find('#merge-keep-first').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'network' })))
    await vi.waitFor(() => expect(mergeButton(wrapper).attributes('disabled')).toBeUndefined())
    expect(wrapper.findAll('[data-testid="merge-overlap"]')).toHaveLength(0)
    expect(notify.success).not.toHaveBeenCalled()
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(mergePeople).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(router.currentRoute.value.params.id).toBe(uuid(1)))
  })

  it('sends one request when the merge button is clicked twice', async () => {
    vi.mocked(mergePeople).mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountWithBothPicked()
    await wrapper.find('#merge-keep-first').setValue(true)
    const button = mergeButton(wrapper)
    void button.trigger('click')
    void button.trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(mergePeople).toHaveBeenCalledTimes(1)
  })

  it('keeps the pair on screen while the merge is running', async () => {
    vi.mocked(mergePeople).mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountWithBothPicked()
    await wrapper.find('#merge-keep-first').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(mergePeople).toHaveBeenCalledTimes(1))
    await wrapper.find('[data-testid="merge-second-card"] button.btn-link').trigger('click')
    expect(wrapper.find('[data-testid="merge-second-card"]').exists()).toBe(true)
    expect(mergeButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('cannot merge again once the merge is saved, even if opening the record fails', async () => {
    vi.mocked(mergePeople).mockResolvedValue()
    const { wrapper, router } = await mountWithBothPicked()
    const failure = new Error('chunk failed to load')
    vi.spyOn(router, 'push').mockRejectedValue(failure)
    await wrapper.find('#merge-keep-first').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(failure))
    await flushPromises()
    expect(notify.success).toHaveBeenCalledWith('admin.merge.done')
    // The saved merge is not reported as a failed one: no overlap explanation, and the
    // screen starts over instead of keeping the merged pair ready to send again.
    expect(wrapper.findAll('[data-testid="merge-overlap"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="merge-first-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="merge-second-card"]').exists()).toBe(false)
    expect(mergeButton(wrapper).attributes('disabled')).toBeDefined()
    await mergeButton(wrapper).trigger('click')
    await flushPromises()
    expect(mergePeople).toHaveBeenCalledTimes(1)
  })

  it('searches only from two characters on and says when nothing matches', async () => {
    const { wrapper } = await mountView()
    await wrapper.find('#merge-first-search').setValue('j')
    await wrapper.find('form.merge-first-search-form').trigger('submit')
    expect(searchPeople).not.toHaveBeenCalled()

    vi.mocked(searchPeople).mockResolvedValue([])
    await wrapper.find('#merge-first-search').setValue('  zz  ')
    await wrapper.find('form.merge-first-search-form').trigger('submit')
    await vi.waitFor(() => expect(searchPeople).toHaveBeenCalledWith('zz', 20))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Sin resultados.'))
  })

  it('reports a failed search and a failed load of the chosen record', async () => {
    vi.mocked(searchPeople).mockRejectedValueOnce(new ApiError('network'))
    const { wrapper } = await mountView()
    await wrapper.find('#merge-first-search').setValue('jose luis')
    await wrapper.find('form.merge-first-search-form').trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'network' })))

    notify.error.mockReset()
    vi.mocked(getPerson).mockRejectedValueOnce(new ApiError('not_found'))
    await wrapper.find('form.merge-first-search-form').trigger('submit')
    const result = `[data-testid="merge-first-result-${uuid(1)}"]`
    await vi.waitFor(() => expect(wrapper.find(result).exists()).toBe(true))
    await wrapper.find(result).trigger('click')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'not_found' })))
    expect(wrapper.find('[data-testid="merge-first-card"]').exists()).toBe(false)
  })
})
