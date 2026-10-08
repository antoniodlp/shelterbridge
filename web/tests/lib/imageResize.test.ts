import { afterEach, describe, expect, it, vi } from 'vitest'
import { fitWithin, makePhotoPair } from '@/lib/imageResize'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fitWithin', () => {
  it('scales the longest side down to the limit', () => {
    expect(fitWithin(1600, 1200, 800)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1200, 1600, 160)).toEqual({ width: 120, height: 160 })
  })

  it('never enlarges a small image', () => {
    expect(fitWithin(300, 200, 800)).toEqual({ width: 300, height: 200 })
  })
})

describe('makePhotoPair', () => {
  it('produces an 800 px photo and a 160 px thumbnail, both JPEG', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1200, height: 1600, close })))
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      callback(new Blob([`${this.width}x${this.height}`], { type }))
    })

    const pair = await makePhotoPair(new Blob(['photo'], { type: 'image/png' }))

    expect(pair.full.type).toBe('image/jpeg')
    expect(await pair.full.text()).toBe('600x800')
    expect(await pair.thumb.text()).toBe('120x160')
    expect(close).toHaveBeenCalledTimes(2)
  })
})
