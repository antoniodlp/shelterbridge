import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as settingsApi from '@/api/settings'
import { useSettingsStore } from '@/stores/settings'

vi.mock('@/api/settings')

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('settings store', () => {
  it('defaults to Mexico City before loading', () => {
    const store = useSettingsStore()
    expect(store.timezone).toBe('America/Mexico_City')
    expect(store.loaded).toBe(false)
  })

  it('loads the shelter timezone', async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({
      timezone: 'America/Tijuana',
      timezone_updated_at: '2026-10-07T12:00:00Z',
    })
    const store = useSettingsStore()
    await store.load()
    expect(store.timezone).toBe('America/Tijuana')
    expect(store.timezoneUpdatedAt).toBe('2026-10-07T12:00:00Z')
    expect(store.loaded).toBe(true)
  })
})
