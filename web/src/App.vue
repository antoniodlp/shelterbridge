<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ConfirmHost from '@/components/common/ConfirmHost.vue'
import ToastHost from '@/components/common/ToastHost.vue'
import AppShell from '@/components/layout/AppShell.vue'
import OfflineBanner from '@/components/layout/OfflineBanner.vue'

const route = useRoute()
const layout = computed(() => route.meta.layout ?? 'blank')
</script>

<template>
  <OfflineBanner />
  <AppShell v-if="layout === 'app'">
    <RouterView />
  </AppShell>
  <main v-else class="container py-4 py-md-5">
    <RouterView />
  </main>
  <ToastHost />
  <ConfirmHost />
</template>
