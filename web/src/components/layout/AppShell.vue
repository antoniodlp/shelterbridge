<script setup lang="ts">
import { onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { useNotify } from '@/composables/useNotify'
import { useCatalogsStore } from '@/stores/catalogs'
import { useSettingsStore } from '@/stores/settings'

const catalogs = useCatalogsStore()
const settings = useSettingsStore()
const notify = useNotify()

// Every app page needs the catalogs and the shelter timezone.
onMounted(async () => {
  try {
    await Promise.all([catalogs.load(), settings.loaded ? Promise.resolve() : settings.load()])
  } catch (error) {
    notify.error(error)
  }
})
</script>

<template>
  <div class="min-vh-100 d-flex flex-column">
    <AppNavbar />
    <main class="container-fluid py-3 flex-grow-1">
      <slot />
    </main>
  </div>
</template>
