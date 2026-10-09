<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import logoUrl from '@/assets/logo.svg'
import ConfirmHost from '@/components/common/ConfirmHost.vue'
import ToastHost from '@/components/common/ToastHost.vue'
import AppShell from '@/components/layout/AppShell.vue'
import OfflineBanner from '@/components/layout/OfflineBanner.vue'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const layout = computed(() => route.meta.layout ?? 'blank')

// A sign-out started in this tab already goes to the login page through useSignOut,
// so the watcher below leaves it alone instead of navigating a second time.
let signingOut = false
session.$onAction(({ name, after, onError }) => {
  if (name !== 'signOut') return
  signingOut = true
  const done = (): void => {
    signingOut = false
  }
  after(done)
  onError(done)
})

// The session can end or lose its access while a page is open: a sign-out in another tab,
// a revoked or expired refresh token, a deactivated account. Leave the page so its data
// is no longer shown. The guard handles the first navigation, and public pages handle
// their own status changes (the login page navigates after signing in).
watch(
  () => session.status,
  (status, previous) => {
    if (previous === 'loading' || signingOut || route.meta.public) return
    if (status === 'signedOut') void router.replace({ name: 'login', query: { redirect: route.fullPath } })
    else if (status === 'pending' && route.name !== 'pending') void router.replace({ name: 'pending' })
  },
)
</script>

<template>
  <OfflineBanner />
  <AppShell v-if="layout === 'app'">
    <RouterView />
  </AppShell>
  <main v-else class="container py-4 py-md-5">
    <img :src="logoUrl" :alt="t('common.appName')" height="72" class="d-block mx-auto mb-4" />
    <RouterView />
  </main>
  <ToastHost />
  <ConfirmHost />
</template>
