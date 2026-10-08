<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import DateField from '@/components/forms/DateField.vue'
import type { ResidentRow } from '@/composables/useResidents'
import { useShelterTime } from '@/composables/useShelterTime'

const props = defineProps<{ resident: ResidentRow | null }>()
const emit = defineEmits<{ confirm: [exitDate: string]; cancel: [] }>()

const { t } = useI18n()
const { today } = useShelterTime()
const todayDate = ref(today())
const exitDate = ref<string | null>(todayDate.value)
const submitted = ref(false)

// The dialog stays mounted; every opening starts from today's date.
watch(
  () => props.resident,
  (resident) => {
    if (!resident) return
    todayDate.value = today()
    exitDate.value = todayDate.value
    submitted.value = false
  },
  { immediate: true },
)

const error = computed(() => {
  if (!props.resident) return null
  if (!exitDate.value) return 'validation.required'
  if (exitDate.value > todayDate.value) return 'validation.dateInFuture'
  if (exitDate.value < props.resident.entry_date) return 'validation.exitBeforeEntry'
  return null
})

function submit(): void {
  submitted.value = true
  if (error.value || !exitDate.value) return
  emit('confirm', exitDate.value)
}

function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="resident !== null"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="t('stays.checkOut.title')"
    width="min(30rem, 95vw)"
    @close="onClose"
  >
    <form v-if="resident" class="check-out-form" novalidate @submit.prevent="submit">
      <p class="fw-semibold">{{ resident.full_name }}</p>
      <div
        v-if="resident.phone_status === 'in_custody'"
        class="alert alert-warning py-2"
        role="alert"
        data-testid="phone-warning"
      >
        {{ t('stays.checkOut.phoneWarning') }}
      </div>
      <div
        v-if="resident.presence === 'outside'"
        class="alert alert-warning py-2"
        role="alert"
        data-testid="outside-warning"
      >
        {{ t('stays.checkOut.outsideWarning') }}
      </div>
      <label for="check-out-date" class="form-label">{{ t('stays.checkOut.exitDate') }}</label>
      <DateField
        id="check-out-date"
        v-model="exitDate"
        :min="resident.entry_date"
        :max="todayDate"
        :invalid="submitted && error !== null"
      />
      <div v-if="submitted && error" class="invalid-feedback d-block">{{ t(error) }}</div>
      <div class="d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="btn btn-danger">{{ t('stays.checkOut.submit') }}</button>
      </div>
    </form>
  </ejs-dialog>
</template>
