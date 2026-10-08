<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import type { Outing } from '@/types/domain'

withDefaults(defineProps<{ outings: Outing[]; canEdit?: boolean; canDelete?: boolean }>(), {
  canEdit: false,
  canDelete: false,
})
const emit = defineEmits<{ edit: [outing: Outing]; remove: [outing: Outing] }>()

const { t } = useI18n()
const { formatDateTime } = useShelterTime()
</script>

<template>
  <p v-if="outings.length === 0" class="text-body-secondary mb-0">{{ t('outings.list.empty') }}</p>
  <div v-else class="table-responsive">
    <table class="table table-sm align-middle mb-0">
      <thead>
        <tr>
          <th scope="col">{{ t('outings.list.left') }}</th>
          <th scope="col">{{ t('outings.list.returned') }}</th>
          <th scope="col">{{ t('outings.list.comment') }}</th>
          <th v-if="canEdit" scope="col">
            <span class="visually-hidden">{{ t('outings.list.actions') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="outing in outings" :key="outing.id" data-testid="outing-row">
          <td>
            {{ formatDateTime(outing.left_at) }}
            <span v-if="outing.is_exception" class="badge text-bg-warning ms-1">{{
              t('outings.list.exception')
            }}</span>
          </td>
          <td>
            <span v-if="outing.returned_at">{{ formatDateTime(outing.returned_at) }}</span>
            <span v-else class="badge text-bg-warning">{{ t('outings.list.notReturned') }}</span>
          </td>
          <td class="text-break">{{ outing.comment }}</td>
          <td v-if="canEdit" class="text-nowrap">
            <button type="button" class="btn btn-sm btn-link" @click="emit('edit', outing)">
              {{ t('outings.edit.action') }}
            </button>
            <button
              v-if="canDelete"
              type="button"
              class="btn btn-sm btn-link text-danger"
              @click="emit('remove', outing)"
            >
              {{ t('outings.edit.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
