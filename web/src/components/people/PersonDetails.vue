<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import { formatAge, fullName } from '@/lib/people'
import { ageOn } from '@/lib/shelterTime'
import { useCatalogsStore } from '@/stores/catalogs'
import type { Person } from '@/types/domain'

const props = defineProps<{ person: Person; carer: Person | null }>()

const { t } = useI18n()
const { formatDate, today } = useShelterTime()
const catalogs = useCatalogsStore()
const unknown = computed(() => t('person.details.unknown'))
const age = computed(() => formatAge(ageOn(props.person.birth_date, today())))
</script>

<template>
  <dl class="row mb-0" data-testid="person-details">
    <dt class="col-sm-4">{{ t('person.details.birthDate') }}</dt>
    <dd class="col-sm-8">{{ formatDate(person.birth_date) || unknown }}</dd>
    <dt class="col-sm-4">{{ t('person.details.age') }}</dt>
    <dd class="col-sm-8">{{ age || unknown }}</dd>
    <dt class="col-sm-4">{{ t('person.details.gender') }}</dt>
    <dd class="col-sm-8">{{ catalogs.label('genders', person.gender_code) || unknown }}</dd>
    <dt class="col-sm-4">{{ t('person.details.country') }}</dt>
    <dd class="col-sm-8">{{ catalogs.label('countries', person.country_code) || unknown }}</dd>
    <dt class="col-sm-4">{{ t('person.details.region') }}</dt>
    <dd class="col-sm-8">{{ person.region || unknown }}</dd>
    <template v-if="person.carer_id">
      <dt class="col-sm-4">{{ t('person.details.carer') }}</dt>
      <dd class="col-sm-8">
        <RouterLink :to="{ name: 'person', params: { id: person.carer_id } }">{{
          carer ? fullName(carer.first_name, carer.last_name) : t('person.details.carerRecord')
        }}</RouterLink>
      </dd>
    </template>
  </dl>
</template>
