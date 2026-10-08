import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSettings } from '@/api/settings'

export const DEFAULT_TIMEZONE = 'America/Mexico_City'

export const useSettingsStore = defineStore('settings', () => {
  const timezone = ref(DEFAULT_TIMEZONE)
  const timezoneUpdatedAt = ref<string | null>(null)
  const loaded = ref(false)

  async function load(): Promise<void> {
    const settings = await getSettings()
    timezone.value = settings.timezone
    timezoneUpdatedAt.value = settings.timezone_updated_at
    loaded.value = true
  }

  return { timezone, timezoneUpdatedAt, loaded, load }
})
