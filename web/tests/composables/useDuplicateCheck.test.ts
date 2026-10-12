import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { type DuplicateCandidate, findPossibleDuplicates } from '@/api/people'
import { useDuplicateCheck } from '@/composables/useDuplicateCheck'
import { uuid } from '../fixtures/data'

vi.mock('@/api/people', () => ({ findPossibleDuplicates: vi.fn() }))

const find = vi.mocked(findPossibleDuplicates)

function candidate(n: number, firstName: string): DuplicateCandidate {
  return {
    person_id: uuid(n),
    first_name: firstName,
    last_name: 'Pérez',
    birth_date: null,
    country_code: 'HN',
    photo_path: null,
    score: 0.8,
    last_entry_date: '2026-08-01',
    last_exit_date: '2026-08-15',
  }
}

function setup() {
  const form = reactive({
    first_name: '',
    last_name: '',
    birth_date: null as string | null,
    country_code: null as string | null,
  })
  const scope = effectScope()
  const check = scope.run(() => useDuplicateCheck(() => ({ ...form })))
  if (!check) throw new Error('scope did not run')
  return { form, check, scope }
}

beforeEach(() => {
  vi.useFakeTimers()
  find.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDuplicateCheck', () => {
  it('waits 400 ms after the last change before asking', async () => {
    const rosa = candidate(1, 'Rosa')
    find.mockResolvedValue([rosa])
    const { form, check, scope } = setup()
    form.first_name = 'Ro'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    form.first_name = ' Rosa '
    await nextTick()
    await vi.advanceTimersByTimeAsync(399)
    expect(find).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(find).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledWith({ first_name: 'Rosa', last_name: null, birth_date: null, country_code: null })
    await vi.waitFor(() => expect(check.candidates.value).toEqual([rosa]))
    scope.stop()
  })

  it('keeps the answer for the latest input when an earlier request is slower', async () => {
    const first = candidate(1, 'Rosa')
    const second = candidate(2, 'Tomás')
    let resolveFirst: (value: DuplicateCandidate[]) => void = () => {}
    find.mockImplementationOnce(
      () =>
        new Promise<DuplicateCandidate[]>((resolve) => {
          resolveFirst = resolve
        }),
    )
    find.mockResolvedValueOnce([second])
    const { form, check, scope } = setup()
    form.first_name = 'Rosa'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    form.first_name = 'Tomás'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    await vi.waitFor(() => expect(check.candidates.value).toEqual([second]))
    resolveFirst([first])
    await Promise.resolve()
    await Promise.resolve()
    expect(check.candidates.value).toEqual([second])
    scope.stop()
  })

  it('does not ask for a one-letter name and clears earlier suggestions', async () => {
    find.mockResolvedValue([candidate(1, 'Rosa')])
    const { form, check, scope } = setup()
    form.first_name = 'Rosa'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    await vi.waitFor(() => expect(check.candidates.value).toHaveLength(1))
    form.first_name = 'R'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    expect(find).toHaveBeenCalledTimes(1)
    expect(check.candidates.value).toEqual([])
    scope.stop()
  })

  it('reports a failed lookup without throwing', async () => {
    find.mockRejectedValue(new Error('offline'))
    const { form, check, scope } = setup()
    form.first_name = 'Rosa'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    await vi.waitFor(() => expect(check.failed.value).toBe(true))
    expect(check.candidates.value).toEqual([])
    scope.stop()
  })

  describe('settle', () => {
    it('asks at once instead of waiting for the debounce, and resolves with the answer', async () => {
      const rosa = candidate(1, 'Rosa')
      find.mockResolvedValue([rosa])
      const { form, check, scope } = setup()
      form.first_name = 'Rosa'
      await nextTick()
      await vi.advanceTimersByTimeAsync(100)
      expect(find).not.toHaveBeenCalled()
      await check.settle()
      expect(find).toHaveBeenCalledTimes(1)
      expect(check.candidates.value).toEqual([rosa])
      expect(check.checking.value).toBe(false)
      // The flushed debounce does not fire a second request later.
      await vi.advanceTimersByTimeAsync(1000)
      expect(find).toHaveBeenCalledTimes(1)
      scope.stop()
    })

    it('waits for a request that is already in flight', async () => {
      const rosa = candidate(1, 'Rosa')
      let answer: (value: DuplicateCandidate[]) => void = () => {}
      find.mockImplementation(
        () =>
          new Promise<DuplicateCandidate[]>((resolve) => {
            answer = resolve
          }),
      )
      const { form, check, scope } = setup()
      form.first_name = 'Rosa'
      await nextTick()
      await vi.advanceTimersByTimeAsync(400)
      expect(find).toHaveBeenCalledTimes(1)
      let settled = false
      const waiting = check.settle().then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(false)
      expect(find).toHaveBeenCalledTimes(1)
      answer([rosa])
      await waiting
      expect(check.candidates.value).toEqual([rosa])
      scope.stop()
    })

    it('resolves at once when there is nothing to ask', async () => {
      const { check, scope } = setup()
      await check.settle()
      expect(find).not.toHaveBeenCalled()
      expect(check.candidates.value).toEqual([])
      scope.stop()
    })

    it('resolves without throwing when the lookup fails', async () => {
      find.mockRejectedValue(new Error('offline'))
      const { form, check, scope } = setup()
      form.first_name = 'Rosa'
      await nextTick()
      await expect(check.settle()).resolves.toBeUndefined()
      expect(check.failed.value).toBe(true)
      expect(check.candidates.value).toEqual([])
      scope.stop()
    })

    it('ends with the answer for the latest input when an earlier request is still open', async () => {
      const first = candidate(1, 'Rosa')
      const second = candidate(2, 'Tomás')
      let resolveFirst: (value: DuplicateCandidate[]) => void = () => {}
      find.mockImplementationOnce(
        () =>
          new Promise<DuplicateCandidate[]>((resolve) => {
            resolveFirst = resolve
          }),
      )
      find.mockResolvedValueOnce([second])
      const { form, check, scope } = setup()
      form.first_name = 'Rosa'
      await nextTick()
      await vi.advanceTimersByTimeAsync(400)
      form.first_name = 'Tomás'
      await nextTick()
      await check.settle()
      expect(check.candidates.value).toEqual([second])
      resolveFirst([first])
      await vi.advanceTimersByTimeAsync(0)
      expect(check.candidates.value).toEqual([second])
      scope.stop()
    })

    it('clears the suggestions at once when the name has become too short', async () => {
      find.mockResolvedValue([candidate(1, 'Rosa')])
      const { form, check, scope } = setup()
      form.first_name = 'Rosa'
      await nextTick()
      await check.settle()
      expect(check.candidates.value).toHaveLength(1)
      form.first_name = 'R'
      await nextTick()
      await check.settle()
      expect(check.candidates.value).toEqual([])
      expect(find).toHaveBeenCalledTimes(1)
      scope.stop()
    })
  })
})
