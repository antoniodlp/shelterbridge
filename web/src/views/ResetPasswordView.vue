<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { updatePassword } from '@/api/auth'
import { toApiError } from '@/api/errors'
import { useNotify } from '@/composables/useNotify'
import { reportNetworkFailure } from '@/composables/useOnline'
import { useSessionStore } from '@/stores/session'

const MIN_PASSWORD_LENGTH = 8

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const notify = useNotify()

const password = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const errorKey = ref<string | null>(null)
const errorParams = ref<Record<string, unknown>>({})

async function submit(): Promise<void> {
  errorKey.value = null
  if (password.value.length < MIN_PASSWORD_LENGTH) {
    errorKey.value = 'validation.passwordTooShort'
    errorParams.value = { min: MIN_PASSWORD_LENGTH }
    return
  }
  if (password.value !== confirmPassword.value) {
    errorKey.value = 'validation.passwordsDontMatch'
    return
  }
  busy.value = true
  try {
    await updatePassword(password.value)
    notify.success('auth.passwordSaved')
    await session.refreshAppUser()
    await router.replace({ name: 'residents' })
  } catch (error) {
    const apiError = toApiError(error)
    // The error shows inline here; a network failure also turns on the app-wide offline banner.
    if (apiError.code === 'network') reportNetworkFailure()
    errorKey.value = apiError.i18nKey
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h4 mb-4">{{ t('auth.newPasswordTitle') }}</h1>

          <template v-if="session.status === 'signedOut'">
            <div class="alert alert-warning" role="alert" data-testid="reset-invalid">{{ t('auth.resetLinkInvalid') }}</div>
            <RouterLink :to="{ name: 'login' }">{{ t('auth.backToSignIn') }}</RouterLink>
          </template>

          <form v-else novalidate @submit.prevent="submit">
            <div v-if="errorKey" class="alert alert-danger" role="alert" data-testid="reset-error">
              {{ t(errorKey, errorParams) }}
            </div>
            <div class="mb-3">
              <label for="reset-password" class="form-label">{{ t('auth.newPassword') }}</label>
              <input id="reset-password" v-model="password" type="password" class="form-control" autocomplete="new-password" />
            </div>
            <div class="mb-3">
              <label for="reset-confirm" class="form-label">{{ t('auth.confirmPassword') }}</label>
              <input id="reset-confirm" v-model="confirmPassword" type="password" class="form-control" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="busy">{{ t('auth.savePassword') }}</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
