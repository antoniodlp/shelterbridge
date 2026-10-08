import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useShelterTime } from '@/composables/useShelterTime'
import { useSettingsStore } from '@/stores/settings'

afterEach(() => {
  vi.useRealTimers()
})

describe('useShelterTime', () => {
  it('formats in the timezone from settings, following changes', () => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn, initialState: { settings: { timezone: 'America/Mexico_City' } } }))
    const time = useShelterTime()
    expect(time.formatDateTime('2026-07-15T18:30:00Z')).toBe('15/07/2026 12:30')
    useSettingsStore().timezone = 'America/Tijuana'
    expect(time.formatTime('2026-07-15T18:30:00Z')).toBe('11:30')
    expect(time.formatDate('2026-07-15')).toBe('15/07/2026')
  })

  it('today is the shelter date', () => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn, initialState: { settings: { timezone: 'America/Mexico_City' } } }))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T05:30:00Z'))
    expect(useShelterTime().today()).toBe('2025-12-31')
  })
})
