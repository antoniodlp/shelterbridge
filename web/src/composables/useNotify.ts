import { ref } from 'vue'
import { toApiError } from '@/api/errors'
import { i18n } from '@/i18n'
import { reportNetworkFailure } from './useOnline'

export interface Notification {
  id: number
  kind: 'success' | 'error'
  text: string
}

// Queue drained by ToastHost. Texts are translated when queued.
export const pendingNotifications = ref<Notification[]>([])
let nextId = 1

function push(kind: Notification['kind'], text: string): void {
  pendingNotifications.value.push({ id: nextId++, kind, text })
}

export function useNotify(): {
  success(key: string, params?: Record<string, unknown>): void
  error(error: unknown): void
} {
  return {
    success(key, params = {}) {
      push('success', i18n.global.t(key, params))
    },
    error(error) {
      const apiError = toApiError(error)
      if (apiError.code === 'network') reportNetworkFailure()
      push('error', i18n.global.t(apiError.i18nKey))
    },
  }
}
