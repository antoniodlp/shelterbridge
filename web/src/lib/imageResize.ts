// Photos are resized in the browser before upload: about 800 px for the record
// and about 160 px for lists. Both are JPEG, well under the 2 MB bucket limit.

export interface PhotoPair {
  full: Blob
  thumb: Blob
}

export const FULL_SIZE = 800
export const THUMB_SIZE = 160
const JPEG_QUALITY = 0.85

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export async function resizeToJpeg(source: Blob, max: number, quality = JPEG_QUALITY): Promise<Blob> {
  // 'from-image' applies the phone's EXIF rotation so portraits stay upright.
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  try {
    const size = fitWithin(bitmap.width, bitmap.height, max)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas_unavailable')
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('jpeg_encode_failed'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}

export async function makePhotoPair(source: Blob): Promise<PhotoPair> {
  const [full, thumb] = await Promise.all([resizeToJpeg(source, FULL_SIZE), resizeToJpeg(source, THUMB_SIZE)])
  return { full, thumb }
}
