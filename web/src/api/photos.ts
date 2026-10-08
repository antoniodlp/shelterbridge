import { supabase } from './client'
import { ApiError, toApiError } from './errors'

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

/**
 * Uploads the photo and its thumbnail (replacing any previous ones), then links
 * the photo to the person. photo_path is set last, so a path always has its thumbnail.
 */
export async function uploadPersonPhoto(personId: string, full: Blob, thumb: Blob): Promise<string> {
  const path = photoPathFor(personId)
  const bucket = supabase.storage.from(BUCKET)
  const objects: Array<[string, Blob]> = [
    [path, full],
    [thumbPathFor(path), thumb],
  ]
  for (const [objectPath, content] of objects) {
    const { error } = await bucket.upload(objectPath, content, { upsert: true, contentType: 'image/jpeg' })
    if (error) throw toApiError(error)
  }
  // No updated_at version check, unlike other edits: photo_path is always the same `${id}.jpg`,
  // and callers have no version to pass. The update still bumps updated_at, which is why the
  // person record locks the photo while its details form is open.
  const { data, error } = await supabase.from('people').update({ photo_path: path }).eq('id', personId).select('id')
  if (error) throw toApiError(error)
  if (!data || data.length === 0) throw new ApiError('not_found')
  return path
}
