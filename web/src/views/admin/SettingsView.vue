<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiError } from '@/api/errors'
import { updateTimezone } from '@/api/settings'
import PageHeader from '@/components/common/PageHeader.vue'
import { useNotify } from '@/composables/useNotify'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const notify = useNotify()
const settings = useSettingsStore()

const timezone = ref(settings.timezone)
const saving = ref(false)

// On a direct load or a refresh this view is set up before AppShell has loaded the settings,
// so the select follows the store instead of copying it once.
watch(
  () => settings.timezone,
  (zone) => {
    timezone.value = zone
  },
  { immediate: true },
)

const zones = computed(() => {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  const list = intl.supportedValuesOf?.('timeZone') ?? []
  return list.includes(settings.timezone) ? list : [settings.timezone, ...list]
})

// Reports its own failure, so a failed reload is never taken for a failed save.
async function reload(): Promise<void> {
  try {
    await settings.load()
    timezone.value = settings.timezone
  } catch (error) {
    notify.error(error)
  }
}

async function save(): Promise<void> {
  const expected = settings.timezoneUpdatedAt
  if (saving.value || !settings.loaded || !expected) return
  saving.value = true
  try {
    try {
      await updateTimezone(timezone.value, expected)
    } catch (error) {
      notify.error(error)
      if (isApiError(error, 'stale_record')) await reload()
      return
    }
    // The timezone is saved: whatever happens to the reload, the next save needs the new version.
    notify.success('admin.settings.saved')
    await reload()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.settings" />
    <form class="settings-form card" @submit.prevent="save">
      <div class="card-body settings-body">
        <label for="settings-timezone" class="form-label">{{ t('admin.settings.timezone') }}</label>
        <select id="settings-timezone" v-model="timezone" class="form-select">
          <option v-for="zone in zones" :key="zone" :value="zone">{{ zone }}</option>
        </select>
        <div class="form-text">{{ t('admin.settings.timezoneHelp') }}</div>
        <button type="submit" class="btn btn-primary mt-3" :disabled="saving || !settings.loaded">
          {{ t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.settings-body {
  max-width: 32rem;
}
</style>
