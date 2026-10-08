<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { requestPasswordReset, signInWithGoogle, signInWithPassword, signUp } from '@/api/auth'
import { toApiError } from '@/api/errors'
import { reportNetworkFailure } from '@/composables/useOnline'
import { cleanText } from '@/lib/text'
import { safeRedirect } from '@/router/guards'
import { useSessionStore } from '@/stores/session'

type Mode = 'signIn' | 'signUp' | 'reset'

const MIN_PASSWORD_LENGTH = 8

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const mode = ref<Mode>('signIn')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const errorKey = ref<string | null>(route.query.error === 'oauth' ? 'auth.googleFailed' : null)
const errorParams = ref<Record<string, unknown>>({})
const infoKey = ref<string | null>(null)

const title = computed(() =>
  mode.value === 'signUp' ? 'auth.signUpTitle' : mode.value === 'reset' ? 'auth.resetTitle' : 'auth.title',
)

function switchMode(next: Mode): void {
  mode.value = next
  password.value = ''
  confirmPassword.value = ''
  errorKey.value = null
  infoKey.value = null
}

function fail(key: string, params: Record<string, unknown> = {}): false {
  errorKey.value = key
  errorParams.value = params
  return false
}

// Shows the error inline. A network failure also turns on the app-wide offline banner.
function failWith(error: unknown): void {
  const apiError = toApiError(error)
  if (apiError.code === 'network') reportNetworkFailure()
  fail(apiError.i18nKey)
}

function validate(): boolean {
  errorKey.value = null
  infoKey.value = null
  const cleanEmail = cleanText(email.value)
  if (!cleanEmail) return fail('validation.required')
  if (!/^[^\s@]+@[^\s@]+$/.test(cleanEmail)) return fail('validation.email')
  email.value = cleanEmail
  if (mode.value === 'reset') return true
  if (password.value === '') return fail('validation.required')
  if (mode.value === 'signUp') {
    if (password.value.length < MIN_PASSWORD_LENGTH) return fail('validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH })
    if (password.value !== confirmPassword.value) return fail('validation.passwordsDontMatch')
  }
  return true
}

async function submit(): Promise<void> {
  if (busy.value || !validate()) return
  busy.value = true
  try {
    if (mode.value === 'signIn') {
      await signInWithPassword(email.value, password.value)
      await session.refreshAppUser()
      await router.replace(safeRedirect(route.query.redirect))
    } else if (mode.value === 'signUp') {
      await signUp(email.value, password.value)
      infoKey.value = 'auth.signUpSent'
    } else {
      await requestPasswordReset(email.value)
      infoKey.value = 'auth.resetSent'
    }
  } catch (error) {
    failWith(error)
  } finally {
    busy.value = false
  }
}

async function google(): Promise<void> {
  errorKey.value = null
  try {
    await signInWithGoogle()
  } catch (error) {
    failWith(error)
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h4 mb-1">{{ t(title) }}</h1>
          <p class="text-body-secondary mb-4">
            {{ mode === 'signUp' ? t('auth.signUpHelp') : mode === 'reset' ? t('auth.resetHelp') : t('auth.subtitle') }}
          </p>

          <div v-if="errorKey" class="alert alert-danger" role="alert" data-testid="login-error">
            {{ t(errorKey, errorParams) }}
          </div>
          <div v-if="infoKey" class="alert alert-success" role="status" data-testid="login-info">
            {{ t(infoKey) }}
          </div>

          <template v-if="mode === 'signIn'">
            <button type="button" class="btn btn-outline-primary w-100" @click="google">{{ t('auth.google') }}</button>
            <p class="text-center text-body-secondary small my-3">{{ t('auth.or') }}</p>
          </template>

          <form novalidate @submit.prevent="submit">
            <div class="mb-3">
              <label for="login-email" class="form-label">{{ t('auth.email') }}</label>
              <input id="login-email" v-model="email" type="email" class="form-control" autocomplete="username" />
            </div>
            <div v-if="mode !== 'reset'" class="mb-3">
              <label for="login-password" class="form-label">{{ t('auth.password') }}</label>
              <input
                id="login-password"
                v-model="password"
                type="password"
                class="form-control"
                :autocomplete="mode === 'signUp' ? 'new-password' : 'current-password'"
              />
            </div>
            <div v-if="mode === 'signUp'" class="mb-3">
              <label for="login-confirm" class="form-label">{{ t('auth.confirmPassword') }}</label>
              <input id="login-confirm" v-model="confirmPassword" type="password" class="form-control" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="busy">
              {{ mode === 'signUp' ? t('auth.signUp') : mode === 'reset' ? t('auth.resetSend') : t('auth.signIn') }}
            </button>
          </form>

          <div class="d-flex flex-column align-items-center gap-1 mt-3">
            <template v-if="mode === 'signIn'">
              <button type="button" class="btn btn-link btn-sm" @click="switchMode('signUp')">{{ t('auth.firstTime') }}</button>
              <button type="button" class="btn btn-link btn-sm" @click="switchMode('reset')">{{ t('auth.forgot') }}</button>
            </template>
            <button v-else type="button" class="btn btn-link btn-sm" @click="switchMode('signIn')">{{ t('auth.backToSignIn') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
