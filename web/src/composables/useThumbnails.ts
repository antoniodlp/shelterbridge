import { ref } from 'vue'
import { getSignedPhotoUrls, thumbPathFor } from '@/api/photos'

const URL_SECONDS = 600
// Re-sign a minute early so a URL never expires while it is on screen.
const REFRESH_MARGIN_MS = 60_000

interface SignedUrl {
  url: string
  expiresAt: number
}

export function useThumbnails() {
  const signed = ref<Record<string, SignedUrl>>({})

  async function load(photoPaths: Array<string | null | undefined>): Promise<void> {
    const now = Date.now()
    const wanted = [
      ...new Set(photoPaths.filter((path): path is string => !!path).map(thumbPathFor)),
    ]
    const stale = wanted.filter((path) => {
      const entry = signed.value[path]
      return !entry || entry.expiresAt - REFRESH_MARGIN_MS <= now
    })
    if (stale.length === 0) return
    try {
      const urls = await getSignedPhotoUrls(stale, URL_SECONDS)
      const expiresAt = now + URL_SECONDS * 1000
      const next = { ...signed.value }
      for (const [path, url] of Object.entries(urls)) next[path] = { url, expiresAt }
      signed.value = next
    } catch {
      // Thumbnails are optional: rows show initials instead.
    }
  }

  function thumbUrl(photoPath: string | null | undefined): string | null {
    if (!photoPath) return null
    return signed.value[thumbPathFor(photoPath)]?.url ?? null
  }

  return { load, thumbUrl }
}
