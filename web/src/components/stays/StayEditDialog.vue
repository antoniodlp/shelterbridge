<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import type { StayPatch } from '@/api/stays'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import StayForm from '@/components/stays/StayForm.vue'
import {
  formToStayPatch,
  type StayFormValue,
  stayToForm,
  validateStay,
} from '@/components/stays/stayFormModel'
import { useShelterTime } from '@/composables/useShelterTime'
import type { Stay } from '@/types/domain'

const props = defineProps<{ stay: Stay | null; saving: boolean }>()
const emit = defineEmits<{ save: [patch: StayPatch]; cancel: [] }>()

const { t } = useI18n()
const { today } = useShelterTime()
const form = ref<StayFormValue | null>(null)
const errors = ref<FieldErrors>({})
const closed = ref(false)

// The dialog stays mounted; each opening loads the chosen stay into a fresh form.
watch(
  () => props.stay,
  (stay) => {
    form.value = stay ? stayToForm(stay) : null
    closed.value = stay?.exit_date !== null && stay?.exit_date !== undefined
    errors.value = {}
  },
  { immediate: true },
)

function submit(): void {
  if (!form.value) return
  errors.value = validateStay(form.value, today(), closed.value)
  if (hasErrors(errors.value)) return
  emit('save', formToStayPatch(form.value, closed.value))
}

function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="stay !== null"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="t('stays.edit.title')"
    width="min(40rem, 95vw)"
    @close="onClose"
  >
    <div>
      <!-- Always rendered, so the Dialog moves it into its padded content area when created. -->
      <form v-if="form" class="stay-edit-form" novalidate @submit.prevent="submit">
        <StayForm v-model="form" :errors="errors" id-prefix="stay-edit" :show-exit-date="closed" />
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ t('common.save') }}</button>
        </div>
      </form>
    </div>
  </ejs-dialog>
</template>
