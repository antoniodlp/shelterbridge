<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CatalogSelect from '@/components/common/CatalogSelect.vue'
import DateField from '@/components/forms/DateField.vue'
import type { FieldErrors } from '@/components/forms/fieldErrors'
import CarerPicker from '@/components/people/CarerPicker.vue'
import { isMinorOn, OLDEST_BIRTH_DATE, type PersonFormValue } from '@/components/people/personFormModel'
import { useShelterTime } from '@/composables/useShelterTime'
import { formatAge } from '@/lib/people'
import { ageOn } from '@/lib/shelterTime'

const model = defineModel<PersonFormValue>({ required: true })
withDefaults(defineProps<{ errors?: FieldErrors; personId?: string | null; carerLabel?: string | null }>(), {
  errors: () => ({}),
  personId: null,
  carerLabel: null,
})

const { t } = useI18n()
const { today } = useShelterTime()
const todayDate = today()
const age = computed(() => ageOn(model.value.birth_date, todayDate))
const minor = computed(() => isMinorOn(model.value.birth_date, todayDate))
</script>

<template>
  <div class="row g-3">
    <div class="col-md-6">
      <label for="person-first-name" class="form-label">{{ t('person.form.firstName') }}</label>
      <input
        id="person-first-name"
        v-model="model.first_name"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.first_name }"
        autocomplete="off"
        required
      />
      <div v-if="errors.first_name" class="invalid-feedback">{{ t(errors.first_name) }}</div>
    </div>
    <div class="col-md-6">
      <label for="person-last-name" class="form-label">{{ t('person.form.lastName') }}</label>
      <input id="person-last-name" v-model="model.last_name" type="text" class="form-control" autocomplete="off" />
    </div>
    <div class="col-md-6">
      <label for="person-birth-date" class="form-label">{{ t('person.form.birthDate') }}</label>
      <DateField
        id="person-birth-date"
        v-model="model.birth_date"
        :min="OLDEST_BIRTH_DATE"
        :max="todayDate"
        :invalid="!!errors.birth_date"
      />
      <div v-if="errors.birth_date" class="invalid-feedback d-block">{{ t(errors.birth_date) }}</div>
      <div v-if="age !== null" class="small text-body-secondary mt-2" data-testid="person-age">
        {{ t('person.form.age', { age: formatAge(age) }) }}
      </div>
    </div>
    <div class="col-md-6">
      <label for="person-gender" class="form-label">{{ t('person.form.gender') }}</label>
      <CatalogSelect
        id="person-gender"
        v-model="model.gender_code"
        catalog="genders"
        placeholder-key="person.form.genderPlaceholder"
        allow-empty
      />
    </div>
    <div class="col-md-6">
      <label for="person-country" class="form-label">{{ t('person.form.country') }}</label>
      <CatalogSelect
        id="person-country"
        v-model="model.country_code"
        catalog="countries"
        placeholder-key="person.form.countryPlaceholder"
        allow-empty
      />
    </div>
    <div class="col-md-6">
      <label for="person-region" class="form-label">{{ t('person.form.region') }}</label>
      <input id="person-region" v-model="model.region" type="text" class="form-control" autocomplete="off" />
    </div>
    <div v-if="minor" class="col-12" data-testid="carer-section">
      <label for="person-carer" class="form-label">{{ t('person.form.carer') }}</label>
      <CarerPicker
        id="person-carer"
        v-model="model.carer_id"
        :exclude-id="personId"
        :current-label="carerLabel"
      />
      <div class="form-text">{{ t('person.form.carerHelp') }}</div>
    </div>
  </div>
</template>
