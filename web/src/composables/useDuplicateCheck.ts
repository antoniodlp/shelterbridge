import { onScopeDispose, ref, watch } from 'vue'
import { type DuplicateCandidate, findPossibleDuplicates } from '@/api/people'
import { normalizeForSearch } from '@/lib/people'
import { cleanText } from '@/lib/text'

export const DUPLICATE_DEBOUNCE_MS = 400

export interface DuplicateQuery {
  first_name: string
  last_name: string
  birth_date: string | null
  country_code: string | null
}

/**
 * Looks for likely duplicates 400 ms after the last change. Only the latest answer is kept.
 * `settle()` skips the wait: it resolves when the candidates match what is typed now.
 */
export function useDuplicateCheck(source: () => DuplicateQuery) {
  const candidates = ref<DuplicateCandidate[]>([])
  const checking = ref(false)
  const failed = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest = 0
  // The query that is waiting for the debounce, and the request that is in flight.
  let waiting: DuplicateQuery | null = null
  let running: Promise<void> | null = null

  async function check(query: DuplicateQuery): Promise<void> {
    const request = ++latest
    const firstName = cleanText(query.first_name)
    const lastName = cleanText(query.last_name)
    if (!firstName || normalizeForSearch(`${firstName} ${lastName ?? ''}`).length < 2) {
      candidates.value = []
      checking.value = false
      failed.value = false
      return
    }
    checking.value = true
    try {
      const found = await findPossibleDuplicates({
        first_name: firstName,
        last_name: lastName,
        birth_date: query.birth_date,
        country_code: query.country_code,
      })
      if (request !== latest) return
      candidates.value = found
      failed.value = false
    } catch {
      if (request !== latest) return
      candidates.value = []
      failed.value = true
    } finally {
      if (request === latest) checking.value = false
    }
  }

  function start(query: DuplicateQuery): void {
    clearTimeout(timer)
    waiting = null
    // check() never rejects: a failed lookup only sets `failed`.
    const request: Promise<void> = check(query).finally(() => {
      if (running === request) running = null
    })
    running = request
  }

  watch(source, (query) => {
    clearTimeout(timer)
    waiting = query
    timer = setTimeout(() => start(query), DUPLICATE_DEBOUNCE_MS)
  })
  onScopeDispose(() => clearTimeout(timer))

  /** Runs the lookup now if one is waiting for the debounce, then waits for the one in flight. */
  async function settle(): Promise<void> {
    if (waiting) start(waiting)
    while (running) await running
  }

  return { candidates, checking, failed, settle }
}
