import { shallowReactive } from 'vue'
import type { PhotoPair } from '@/lib/imageResize'

interface PendingPhoto {
  photo: PhotoPair
  // True when the upload failed right after the person was registered.
  afterRegistration: boolean
}

// Photos whose upload failed, kept only in memory (never stored) so the
// person record can offer "Reintentar foto" with the same picture.
const pending = shallowReactive(new Map<string, PendingPhoto>())

export function usePendingPhotos() {
  return {
    get: (personId: string): PhotoPair | null => pending.get(personId)?.photo ?? null,
    isAfterRegistration: (personId: string): boolean => pending.get(personId)?.afterRegistration ?? false,
    set: (personId: string, photo: PhotoPair, options: { afterRegistration?: boolean } = {}): void => {
      pending.set(personId, { photo, afterRegistration: options.afterRegistration ?? false })
    },
    clear: (personId: string): void => {
      pending.delete(personId)
    },
  }
}
