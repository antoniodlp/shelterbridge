<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CatalogSelect from '@/components/common/CatalogSelect.vue'
import DateField from '@/components/forms/DateField.vue'
import type { FieldErrors } from '@/components/forms/fieldErrors'
import type { StayFormValue } from '@/components/stays/stayFormModel'
import { useShelterTime } from '@/composables/useShelterTime'
import type { PhoneStatus } from '@/types/domain'

const model = defineModel<StayFormValue>({ required: true })
withDefaults(defineProps<{ errors?: FieldErrors; idPrefix?: string; showExitDate?: boolean }>(), {
  errors: () => ({}),
  idPrefix: 'stay',
  showExitDate: false,
})

const { t } = useI18n()
const { today } = useShelterTime()
const todayDate = today()
const phoneStatuses: PhoneStatus[] = ['none', 'with_person', 'in_custody']
</script>

<template>
  <div class="row g-3">
    <div class="col-md-6">
      <label :for="`${idPrefix}-entry-date`" class="form-label">{{ t('stays.form.entryDate') }}</label>
      <DateField
        :id="`${idPrefix}-entry-date`"
        v-model="model.entry_date"
        :max="todayDate"
        :invalid="!!errors.entry_date"
      />
      <div v-if="errors.entry_date" class="invalid-feedback d-block">{{ t(errors.entry_date) }}</div>
    </div>
    <div v-if="showExitDate" class="col-md-6">
      <label :for="`${idPrefix}-exit-date`" class="form-label">{{ t('stays.form.exitDate') }}</label>
      <DateField
        :id="`${idPrefix}-exit-date`"
        v-model="model.exit_date"
        :min="model.entry_date"
        :max="todayDate"
        :invalid="!!errors.exit_date"
      />
      <div v-if="errors.exit_date" class="invalid-feedback d-block">{{ t(errors.exit_date) }}</div>
    </div>
    <div class="col-md-6">
      <label :for="`${idPrefix}-bed`" class="form-label">{{ t('stays.form.bed') }}</label>
      <input :id="`${idPrefix}-bed`" v-model="model.bed" type="text" class="form-control" autocomplete="off" />
    </div>
    <div class="col-md-6">
      <label :for="`${idPrefix}-case-type`" class="form-label">{{ t('stays.form.caseType') }}</label>
      <CatalogSelect
        :id="`${idPrefix}-case-type`"
        v-model="model.case_type_code"
        catalog="case_types"
        placeholder-key="stays.form.caseTypePlaceholder"
        allow-empty
      />
    </div>
    <div class="col-md-6">
      <label :for="`${idPrefix}-phone-status`" class="form-label">{{ t('stays.form.phoneStatus') }}</label>
      <select :id="`${idPrefix}-phone-status`" v-model="model.phone_status" class="form-select">
        <option v-for="status in phoneStatuses" :key="status" :value="status">
          {{ t(`phoneStatus.${status}`) }}
        </option>
      </select>
    </div>
    <div class="col-12">
      <label :for="`${idPrefix}-notes`" class="form-label">{{ t('stays.form.notes') }}</label>
      <textarea :id="`${idPrefix}-notes`" v-model="model.notes" class="form-control" rows="2" />
    </div>
  </div>
</template>
