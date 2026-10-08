<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useNotify } from '@/composables/useNotify'
import { useSignOut } from '@/composables/useSignOut'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const notify = useNotify()
const { signOut } = useSignOut()

async function checkAgain(): Promise<void> {
  try {
    await session.refreshAppUser()
    if (session.status === 'ready') await router.replace({ name: 'residents' })
  } catch (error) {
    notify.error(error)
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 col-md-8 col-lg-6">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h4">{{ t('auth.pendingTitle') }}</h1>
          <p class="mb-4">{{ t('auth.pendingBody') }}</p>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary" @click="checkAgain">{{ t('auth.pendingRetry') }}</button>
            <button type="button" class="btn btn-outline-secondary" @click="signOut">{{ t('nav.signOut') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
