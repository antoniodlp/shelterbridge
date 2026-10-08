import { shallowRef } from 'vue'

export interface ConfirmOptions {
  titleKey: string
  messageKey: string
  messageParams?: Record<string, unknown>
  confirmKey?: string
  cancelKey?: string
  danger?: boolean
}

export interface ConfirmRequest {
  options: ConfirmOptions
  resolve: (answer: boolean) => void
}

// The open question, rendered by ConfirmHost. Only one can be open at a time.
export const activeConfirm = shallowRef<ConfirmRequest | null>(null)

export function answerConfirm(answer: boolean): void {
  const request = activeConfirm.value
  if (!request) return
  activeConfirm.value = null
  request.resolve(answer)
}

export function useConfirm(): { confirm(options: ConfirmOptions): Promise<boolean> } {
  return {
    confirm(options) {
      answerConfirm(false)
      return new Promise<boolean>((resolve) => {
        activeConfirm.value = { options, resolve }
      })
    },
  }
}
