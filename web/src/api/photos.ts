import { supabase } from './client'
import { toApiError } from './errors'

const BUCKET = 'person-photos'

/** Photo paths contain only the person's UUID, never a name. */
export function photoPathFor(personId: string): string {
  return `${personId}.jpg`
}

export function thumbPathFor(photoPath: string): string {
  return photoPath.replace(/\.jpg$/, '_thumb.jpg')
}

/** Signs many paths in one request. Paths whose object is missing are left out. */
export async function getSignedPhotoUrls(
  paths: string[],
  expiresInSeconds = 600,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  if (unique.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresInSeconds)
  if (error) throw toApiError(error)
  const urls: Record<string, string> = {}
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl
  }
  return urls
}
