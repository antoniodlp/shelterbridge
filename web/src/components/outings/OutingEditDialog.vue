<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import DateTimeField from '@/components/forms/DateTimeField.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import {
  formToOutingPatch,
  type OutingFormValue,
  type OutingPatch,
  outingToForm,
  validateOuting,
} from '@/components/outings/outingFormModel'
import type { Outing } from '@/types/domain'

const props = defineProps<{ outing: Outing | null; saving: boolean }>()
const emit = defineEmits<{ save: [patch: OutingPatch]; cancel: [] }>()

const { t } = useI18n()
const form = ref<OutingFormValue | null>(null)
const errors = ref<FieldErrors>({})
// The pickers stop at the current time; the database checks the same against its own clock.
const now = ref(new Date().toISOString())

// The dialog stays mounted; each opening starts from the recorded times.
watch(
  () => props.outing,
  (outing) => {
    form.value = outing ? outingToForm(outing) : null
    errors.value = {}
    now.value = new Date().toISOString()
  },
  { immediate: true },
)

function submit(): void {
  if (!form.value || !props.outing) return
  errors.value = validateOuting(form.value, new Date())
  if (hasErrors(errors.value)) return
  const patch = formToOutingPatch(form.value, props.outing)
  if (Object.keys(patch).length === 0) emit('cancel')
  else emit('save', patch)
}

function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="outing !== null"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="t('outings.edit.title')"
    width="min(32rem, 95vw)"
    @close="onClose"
  >
    <div>
      <!-- Always rendered, so the Dialog moves it into its padded content area when created. -->
      <form v-if="form" class="outing-edit-form" novalidate @submit.prevent="submit">
        <div class="mb-3">
          <label for="outing-left-at" class="form-label">{{ t('outings.edit.leftAt') }}</label>
          <DateTimeField id="outing-left-at" v-model="form.left_at" :max="now" :invalid="!!errors.left_at" />
          <div v-if="errors.left_at" class="invalid-feedback d-block">{{ t(errors.left_at) }}</div>
        </div>
        <div class="mb-3">
          <label for="outing-returned-at" class="form-label">{{ t('outings.edit.returnedAt') }}</label>
          <DateTimeField
            id="outing-returned-at"
            v-model="form.returned_at"
            :max="now"
            :invalid="!!errors.returned_at"
          />
          <div class="form-text">{{ t('outings.edit.returnedHelp') }}</div>
          <div v-if="errors.returned_at" class="invalid-feedback d-block">{{ t(errors.returned_at) }}</div>
        </div>
        <div class="mb-3">
          <label for="outing-edit-comment" class="form-label">{{ t('outings.edit.comment') }}</label>
          <input
            id="outing-edit-comment"
            v-model="form.comment"
            type="text"
            class="form-control"
            maxlength="500"
            autocomplete="off"
          />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ t('common.save') }}</button>
        </div>
      </form>
    </div>
  </ejs-dialog>
</template>
