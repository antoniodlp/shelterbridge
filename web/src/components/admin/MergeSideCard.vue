<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { stayRangeLabel } from '@/components/admin/mergeOverlaps'
import { useShelterTime } from '@/composables/useShelterTime'
import { fullName } from '@/lib/people'
import { useCatalogsStore } from '@/stores/catalogs'
import type { Person, Stay } from '@/types/domain'

defineProps<{ position: 'first' | 'second'; person: Person; stays: Stay[]; selected: boolean }>()
const emit = defineEmits<{ keep: []; change: [] }>()

const { t } = useI18n()
const { formatDate } = useShelterTime()
const catalogs = useCatalogsStore()
</script>

<template>
  <div class="card" :class="{ 'border-primary': selected }" :data-testid="`merge-${position}-card`">
    <div class="card-body">
      <h3 class="h5">{{ fullName(person.first_name, person.last_name) }}</h3>
      <dl class="row small mb-3">
        <dt class="col-5">{{ t('person.details.birthDate') }}</dt>
        <dd class="col-7">{{ formatDate(person.birth_date) || t('person.details.unknown') }}</dd>
        <dt class="col-5">{{ t('person.details.gender') }}</dt>
        <dd class="col-7">{{ catalogs.label('genders', person.gender_code) || t('person.details.unknown') }}</dd>
        <dt class="col-5">{{ t('person.details.country') }}</dt>
        <dd class="col-7">{{ catalogs.label('countries', person.country_code) || t('person.details.unknown') }}</dd>
        <dt class="col-5">{{ t('person.details.region') }}</dt>
        <dd class="col-7">{{ person.region || t('person.details.unknown') }}</dd>
      </dl>
      <h4 class="h6">{{ t('admin.merge.stays') }}</h4>
      <p v-if="stays.length === 0" class="small text-body-secondary">{{ t('admin.merge.noStays') }}</p>
      <ul v-else class="small">
        <li v-for="stay in stays" :key="stay.id">{{ stayRangeLabel(stay, formatDate, t) }}</li>
      </ul>
      <div class="d-flex justify-content-between align-items-center">
        <div class="form-check mb-0">
          <input
            :id="`merge-keep-${position}`"
            class="form-check-input"
            type="radio"
            name="merge-survivor"
            :checked="selected"
            @change="emit('keep')"
          />
          <label :for="`merge-keep-${position}`" class="form-check-label">{{ t('admin.merge.keep') }}</label>
        </div>
        <button type="button" class="btn btn-sm btn-link" @click="emit('change')">{{ t('admin.merge.change') }}</button>
      </div>
    </div>
  </div>
</template>
