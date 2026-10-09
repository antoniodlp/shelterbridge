<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import logoUrl from '@/assets/logo.svg'
import { useSignOut } from '@/composables/useSignOut'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const route = useRoute()
const session = useSessionStore()
const { signOut } = useSignOut()

const menuOpen = ref(false)
const adminOpen = ref(false)

const mainLinks = [
  { name: 'residents', key: 'nav.residents' },
  { name: 'people-search', key: 'nav.search' },
  { name: 'person-new', key: 'nav.newPerson' },
] as const

const adminLinks = [
  { name: 'admin-users', key: 'nav.users' },
  { name: 'admin-catalogs', key: 'nav.catalogs' },
  { name: 'admin-settings', key: 'nav.settings' },
  { name: 'admin-audit', key: 'nav.audit' },
  { name: 'admin-merge', key: 'nav.merge' },
] as const

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    adminOpen.value = false
  },
)
</script>

<template>
  <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom">
    <div class="container-fluid">
      <RouterLink class="navbar-brand fw-semibold d-flex align-items-center gap-2" :to="{ name: 'residents' }">
        <img :src="logoUrl" alt="" height="28" />
        {{ t('common.appName') }}
      </RouterLink>
      <button
        class="navbar-toggler"
        type="button"
        :aria-label="t('nav.menu')"
        :aria-expanded="menuOpen"
        aria-controls="app-navbar-menu"
        @click="menuOpen = !menuOpen"
      >
        <span class="navbar-toggler-icon" />
      </button>
      <div id="app-navbar-menu" class="collapse navbar-collapse" :class="{ show: menuOpen }">
        <ul class="navbar-nav me-auto">
          <li v-for="link in mainLinks" :key="link.name" class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ name: link.name }">{{ t(link.key) }}</RouterLink>
          </li>
          <li v-if="session.isAdmin" class="nav-item dropdown">
            <button
              class="nav-link dropdown-toggle"
              type="button"
              :aria-expanded="adminOpen"
              @click="adminOpen = !adminOpen"
            >
              {{ t('nav.admin') }}
            </button>
            <ul class="dropdown-menu" :class="{ show: adminOpen }" data-bs-popper="static">
              <li v-for="link in adminLinks" :key="link.name">
                <RouterLink class="dropdown-item" active-class="active" :to="{ name: link.name }">{{ t(link.key) }}</RouterLink>
              </li>
            </ul>
          </li>
        </ul>
        <div class="d-flex flex-column flex-lg-row align-items-lg-center gap-2">
          <span v-if="session.operatorName" class="navbar-text" data-testid="operator-name">
            {{ t('nav.onShift', { name: session.operatorName }) }}
          </span>
          <RouterLink v-if="session.role === 'volunteer'" class="btn btn-sm btn-outline-secondary" :to="{ name: 'shift' }">
            {{ t('nav.changeShift') }}
          </RouterLink>
          <button type="button" class="btn btn-sm btn-outline-danger" @click="signOut">{{ t('nav.signOut') }}</button>
        </div>
      </div>
    </div>
  </nav>
</template>
