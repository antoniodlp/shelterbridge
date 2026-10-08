<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import { useCatalogsStore } from '@/stores/catalogs'
import type { Stay } from '@/types/domain'

withDefaults(
  defineProps<{ stays: Stay[]; canEdit?: boolean; canDelete?: boolean; reopenableId?: string | null }>(),
  { canEdit: false, canDelete: false, reopenableId: null },
)
const emit = defineEmits<{ edit: [stay: Stay]; remove: [stay: Stay]; reopen: [stay: Stay] }>()

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
          <th v-if="canEdit" scope="col">
            <span class="visually-hidden">{{ t('stays.history.actions') }}</span>
          </th>
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
          <td v-if="canEdit" class="text-nowrap">
            <button type="button" class="btn btn-sm btn-link" @click="emit('edit', stay)">
              {{ t('stays.edit.action') }}
            </button>
            <button
              v-if="stay.id === reopenableId"
              type="button"
              class="btn btn-sm btn-link"
              @click="emit('reopen', stay)"
            >
              {{ t('stays.reopen.action') }}
            </button>
            <button
              v-if="canDelete"
              type="button"
              class="btn btn-sm btn-link text-danger"
              @click="emit('remove', stay)"
            >
              {{ t('stays.edit.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
