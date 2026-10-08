<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import { useCatalogsStore } from '@/stores/catalogs'
import type { Stay } from '@/types/domain'

defineProps<{ stays: Stay[] }>()

const { t } = useI18n()
const { formatDate } = useShelterTime()
const catalogs = useCatalogsStore()
</script>

<template>
  <p v-if="stays.length === 0" class="text-body-secondary mb-0">{{ t('stays.history.empty') }}</p>
  <div v-else class="table-responsive">
    <table class="table table-sm align-middle mb-0">
      <thead>
        <tr>
          <th scope="col">{{ t('stays.history.entry') }}</th>
          <th scope="col">{{ t('stays.history.exit') }}</th>
          <th scope="col">{{ t('stays.history.bed') }}</th>
          <th scope="col">{{ t('stays.history.caseType') }}</th>
          <th scope="col">{{ t('stays.history.phone') }}</th>
          <th scope="col">{{ t('stays.history.notes') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="stay in stays" :key="stay.id" data-testid="stay-row">
          <td>{{ formatDate(stay.entry_date) }}</td>
          <td>
            <span v-if="stay.exit_date">{{ formatDate(stay.exit_date) }}</span>
            <span v-else class="badge text-bg-success">{{ t('stays.history.open') }}</span>
          </td>
          <td>{{ stay.bed }}</td>
          <td>{{ catalogs.label('case_types', stay.case_type_code) }}</td>
          <td>{{ t(`phoneStatus.${stay.phone_status}`) }}</td>
          <td class="text-break">{{ stay.notes }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
