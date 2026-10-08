import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhotoCapture from '@/components/people/PhotoCapture.vue'
import { makePhotoPair } from '@/lib/imageResize'
import { mountWithApp } from '../../utils/mountWithApp'

vi.mock('@/lib/imageResize', () => ({ makePhotoPair: vi.fn() }))

const pair = {
  full: new Blob(['full'], { type: 'image/jpeg' }),
  thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
}

function setMediaDevices(value: unknown): void {
  Object.defineProperty(navigator, 'mediaDevices', { value, configurable: true, writable: true })
}

async function chooseFile(wrapper: Awaited<ReturnType<typeof mountWithApp>>['wrapper'], file: File) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  setMediaDevices(undefined)
  document.body.innerHTML = ''
})

describe('PhotoCapture', () => {
  it('turns a chosen file into a photo and a thumbnail', async () => {
    vi.mocked(makePhotoPair).mockResolvedValue(pair)
    const { wrapper } = await mountWithApp(PhotoCapture)
    const file = new File(['raw'], 'foto.png', { type: 'image/png' })
    await chooseFile(wrapper, file)
    await vi.waitFor(() => expect(wrapper.emitted('captured')).toEqual([[pair]]))
    expect(makePhotoPair).toHaveBeenCalledWith(file)
  })

  it('offers only the file option when the browser has no camera API', async () => {
    setMediaDevices(undefined)
    const { wrapper } = await mountWithApp(PhotoCapture)
    const labels = wrapper.findAll('button').map((button) => button.text())
    expect(labels).not.toContain('Usar cámara')
    expect(wrapper.find('label').text()).toBe('Elegir archivo o tomar con el teléfono')
  })

  it('explains a refused camera and keeps the file option', async () => {
    setMediaDevices({ getUserMedia: vi.fn(async () => Promise.reject(new DOMException('denied', 'NotAllowedError'))) })
    const { wrapper } = await mountWithApp(PhotoCapture)
    const camera = wrapper.findAll('button').find((button) => button.text() === 'Usar cámara')
    await camera?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No se pudo usar la cámara.'))
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
  })

  it('turns the camera off when the component goes away while the permission is pending', async () => {
    const stop = vi.fn()
    let allow: (stream: unknown) => void = () => {}
    setMediaDevices({
      getUserMedia: vi.fn(
        () =>
          new Promise((resolve) => {
            allow = resolve
          }),
      ),
    })
    const { wrapper } = await mountWithApp(PhotoCapture)
    const camera = wrapper.findAll('button').find((button) => button.text() === 'Usar cámara')
    await camera?.trigger('click')
    wrapper.unmount()
    allow({ getTracks: () => [{ stop }] })
    await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
  })

  it('turns the camera off when a file is picked while it is open', async () => {
    vi.mocked(makePhotoPair).mockResolvedValue(pair)
    // jsdom does not implement video playback.
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const stop = vi.fn()
    setMediaDevices({ getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) })
    const { wrapper } = await mountWithApp(PhotoCapture)
    const camera = wrapper.findAll('button').find((button) => button.text() === 'Usar cámara')
    await camera?.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('video').exists()).toBe(true))
    expect(stop).not.toHaveBeenCalled()
    await chooseFile(wrapper, new File(['raw'], 'foto.png', { type: 'image/png' }))
    await vi.waitFor(() => expect(wrapper.emitted('captured')).toHaveLength(1))
    expect(stop).toHaveBeenCalledTimes(1)
    expect(wrapper.find('video').exists()).toBe(false)
    play.mockRestore()
  })

  it('reports when it starts and stops preparing a photo', async () => {
    let finish: (value: typeof pair) => void = () => {}
    vi.mocked(makePhotoPair).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { wrapper } = await mountWithApp(PhotoCapture)
    await chooseFile(wrapper, new File(['raw'], 'foto.png', { type: 'image/png' }))
    expect(wrapper.emitted('busy')).toEqual([[true]])
    finish(pair)
    await vi.waitFor(() => expect(wrapper.emitted('busy')).toEqual([[true], [false]]))
    expect(wrapper.emitted('captured')).toEqual([[pair]])
  })

  it('reports that it is no longer busy when the image cannot be read', async () => {
    vi.mocked(makePhotoPair).mockRejectedValue(new Error('decode'))
    const { wrapper } = await mountWithApp(PhotoCapture)
    await chooseFile(wrapper, new File(['raw'], 'roto.heic', { type: 'image/heic' }))
    await vi.waitFor(() => expect(wrapper.emitted('busy')).toEqual([[true], [false]]))
  })

  it('reports an image it cannot read', async () => {
    vi.mocked(makePhotoPair).mockRejectedValue(new Error('decode'))
    const { wrapper } = await mountWithApp(PhotoCapture)
    await chooseFile(wrapper, new File(['raw'], 'roto.heic', { type: 'image/heic' }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('No se pudo leer la imagen.'))
    expect(wrapper.emitted('captured')).toBeUndefined()
  })
})
