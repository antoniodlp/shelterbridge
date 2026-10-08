<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSignOut } from '@/composables/useSignOut'
import { cleanText } from '@/lib/text'
import { safeRedirect } from '@/router/guards'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const { signOut } = useSignOut()

const name = ref(session.operatorName ?? '')
const showRequired = ref(false)

async function start(): Promise<void> {
  const cleaned = cleanText(name.value)
  showRequired.value = cleaned === null
  if (cleaned === null) return
  session.setOperatorName(cleaned)
  await router.replace(safeRedirect(route.query.redirect))
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 col-md-8 col-lg-6">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h3">{{ t('shift.title') }}</h1>
          <p class="text-body-secondary">{{ t('shift.help') }}</p>
          <form novalidate @submit.prevent="start">
            <div class="mb-3">
              <label for="shift-name" class="form-label">{{ t('shift.name') }}</label>
              <input
                id="shift-name"
                v-model="name"
                type="text"
                class="form-control form-control-lg"
                :class="{ 'is-invalid': showRequired }"
                autocomplete="off"
                maxlength="120"
              />
              <div v-if="showRequired" class="invalid-feedback">{{ t('validation.required') }}</div>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button type="submit" class="btn btn-primary btn-lg">{{ t('shift.start') }}</button>
              <button type="button" class="btn btn-link" @click="signOut">{{ t('nav.signOut') }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
