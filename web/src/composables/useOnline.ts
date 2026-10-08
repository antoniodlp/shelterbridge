import { ref, type Ref } from 'vue'

// One shared flag for the whole app. It follows the browser's online and
// offline events, and a failed request can also mark the app offline for a while.
const RECHECK_AFTER_FAILURE_MS = 15_000

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
let recheckTimer: ReturnType<typeof setTimeout> | undefined
let listening = false

function listen(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('online', () => {
    online.value = true
  })
  window.addEventListener('offline', () => {
    online.value = false
  })
}

export function reportNetworkFailure(): void {
  online.value = false
  clearTimeout(recheckTimer)
  recheckTimer = setTimeout(() => {
    online.value = navigator.onLine
  }, RECHECK_AFTER_FAILURE_MS)
}

export function useOnline(): { online: Ref<boolean> } {
  listen()
  return { online }
}
