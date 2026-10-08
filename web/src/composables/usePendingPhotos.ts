import { shallowReactive } from 'vue'
import type { PhotoPair } from '@/lib/imageResize'

// Photos whose upload failed, kept only in memory (never stored) so the
// person record can offer "Reintentar foto" with the same picture.
const pending = shallowReactive(new Map<string, PhotoPair>())

export function usePendingPhotos() {
  return {
    get: (personId: string): PhotoPair | null => pending.get(personId) ?? null,
    set: (personId: string, photo: PhotoPair): void => {
      pending.set(personId, photo)
    },
    clear: (personId: string): void => {
      pending.delete(personId)
    },
  }
}
