<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ColumnDirective as EColumn,
  ColumnsDirective as EColumns,
  Filter,
  GridComponent as EjsGrid,
  Sort,
} from '@syncfusion/ej2-vue-grids'
import PersonThumb from '@/components/people/PersonThumb.vue'
import { PHONE_STATUSES } from '@/components/stays/stayFormModel'
import type { ResidentRow } from '@/composables/useResidents'
import { cleanText } from '@/lib/text'
import type { PhoneStatus } from '@/types/domain'

defineProps<{ rows: ResidentRow[] }>()
const emit = defineEmits<{
  'start-outing': [stayId: string]
  'end-outing': [stayId: string]
  'check-out': [stayId: string]
  'change-bed': [stayId: string, bed: string]
  'change-phone-status': [stayId: string, status: PhoneStatus]
}>()

const { t } = useI18n()
provide('grid', [Sort, Filter])

// The bed and phone status are edited in their cells. A change is emitted once the
// value differs from the row; the view saves it and reloads, so the row then shows
// what was saved. Key presses stay inside the fields: the grid otherwise takes the
// arrows, Enter and Escape for its own cell navigation.
function commitBed(row: ResidentRow, event: Event): void {
  const input = event.target as HTMLInputElement
  const bed = cleanText(input.value) ?? ''
  if (bed !== row.bed) emit('change-bed', row.stay_id, bed)
}

function onBedKeydown(row: ResidentRow, event: KeyboardEvent): void {
  event.stopPropagation()
  const input = event.target as HTMLInputElement
  if (event.key === 'Enter') {
    commitBed(row, event)
    input.blur()
  } else if (event.key === 'Escape') {
    input.value = row.bed
    input.blur()
  }
}

function commitPhoneStatus(row: ResidentRow, event: Event): void {
  const status = (event.target as HTMLSelectElement).value as PhoneStatus
  if (status !== row.phone_status) emit('change-phone-status', row.stay_id, status)
}

// Phones get Syncfusion's adaptive layout, which stacks each row vertically.
const narrowQuery = window.matchMedia('(max-width: 767.98px)')
const narrow = ref(narrowQuery.matches)
function onNarrowChange(event: MediaQueryListEvent): void {
  narrow.value = event.matches
}
narrowQuery.addEventListener?.('change', onNarrowChange)
onBeforeUnmount(() => narrowQuery.removeEventListener?.('change', onNarrowChange))

const adaptive = computed(() => ({
  enableAdaptiveUI: narrow.value,
  rowRenderingMode: narrow.value ? 'Vertical' : 'Horizontal',
}))
const filterSettings = { type: 'CheckBox' }
</script>

<template>
  <ejs-grid
    :key="narrow ? 'narrow' : 'wide'"
    :data-source="rows"
    :allow-sorting="true"
    :allow-filtering="true"
    :filter-settings="filterSettings"
    v-bind="adaptive"
  >
    <e-columns>
      <e-column
        :header-text="t('residents.columns.photo')"
        width="64"
        :allow-sorting="false"
        :allow-filtering="false"
        :template="'photo'"
      >
        <!-- The name links already lead to the record, so this one stays out of the tab order and screen readers. -->
        <template #photo="{ data }">
          <RouterLink :to="{ name: 'person', params: { id: data.person_id } }" tabindex="-1" aria-hidden="true">
            <PersonThumb :url="data.thumb_url" :name="data.full_name" />
          </RouterLink>
        </template>
      </e-column>
      <e-column
        field="first_name"
        :header-text="t('residents.columns.firstName')"
        width="130"
        :allow-filtering="true"
        :template="'firstname'"
      >
        <template #firstname="{ data }">
          <RouterLink class="link-dark text-decoration-none" :to="{ name: 'person', params: { id: data.person_id } }">{{ data.first_name }}</RouterLink>
        </template>
      </e-column>
      <e-column
        field="last_name"
        :header-text="t('residents.columns.lastName')"
        width="130"
        :allow-filtering="true"
        :template="'lastname'"
      >
        <template #lastname="{ data }">
          <RouterLink class="link-dark text-decoration-none" :to="{ name: 'person', params: { id: data.person_id } }">{{ data.last_name }}</RouterLink>
        </template>
      </e-column>
      <e-column
        field="age"
        :header-text="t('residents.columns.age')"
        width="70"
        :allow-filtering="true"
        :template="'age'"
      >
        <template #age="{ data }">
          <span data-testid="age" :class="{ 'text-danger fw-semibold': data.is_minor }">{{ data.age_label }}</span>
        </template>
      </e-column>
      <e-column
        field="carer_name"
        :header-text="t('residents.columns.unaccompanied')"
        width="170"
        :allow-filtering="true"
        :template="'carer'"
      >
        <template #carer="{ data }">
          <span v-if="data.carer_name" data-testid="carer-name">{{ data.carer_name }}</span>
          <span
            v-if="data.is_unaccompanied_minor"
            class="badge text-bg-danger"
            data-testid="unaccompanied-badge"
            >{{ t('residents.unaccompaniedBadge') }}</span
          >
        </template>
      </e-column>
      <e-column field="bed" :header-text="t('residents.columns.bed')" width="75" :template="'bed'">
        <template #bed="{ data }">
          <input
            type="text"
            class="form-control form-control-sm"
            :value="data.bed"
            :aria-label="t('residents.inline.bedLabel', { name: data.full_name })"
            :disabled="data.busy"
            autocomplete="off"
            @keydown="onBedKeydown(data, $event)"
            @change="commitBed(data, $event)"
          />
        </template>
      </e-column>
      <e-column
        field="entry_date"
        :header-text="t('residents.columns.entryDate')"
        width="105"
        :allow-filtering="false"
        :template="'entry'"
      >
        <template #entry="{ data }">{{ data.entry_date_label }}</template>
      </e-column>
      <e-column
        field="days_in_shelter"
        :header-text="t('residents.columns.days')"
        width="70"
        :allow-filtering="false"
      />
      <e-column
        field="presence_label"
        :header-text="t('residents.columns.presence')"
        width="105"
        :template="'presence'"
      >
        <template #presence="{ data }">
          <span
            class="badge"
            :class="data.presence === 'outside' ? 'text-bg-warning' : 'text-bg-success'"
            data-testid="presence"
            :data-presence="data.presence"
            >{{ data.presence_label }}</span
          >
        </template>
      </e-column>
      <e-column
        field="out_since"
        :header-text="t('residents.columns.outSince')"
        width="135"
        :allow-filtering="false"
        :template="'outsince'"
      >
        <template #outsince="{ data }">{{ data.out_since_label }}</template>
      </e-column>
      <e-column
        field="phone_status_label"
        :header-text="t('residents.columns.phone')"
        width="120"
        :template="'phone'"
      >
        <template #phone="{ data }">
          <select
            class="form-select form-select-sm"
            :value="data.phone_status"
            :aria-label="t('residents.inline.phoneLabel', { name: data.full_name })"
            :disabled="data.busy"
            @keydown.stop
            @change="commitPhoneStatus(data, $event)"
          >
            <option v-for="status in PHONE_STATUSES" :key="status" :value="status">
              {{ t(`phoneStatus.${status}`) }}
            </option>
          </select>
        </template>
      </e-column>
      <e-column
        :header-text="t('residents.columns.actions')"
        width="250"
        :allow-sorting="false"
        :allow-filtering="false"
        :template="'actions'"
      >
        <template #actions="{ data }">
          <div class="d-flex flex-wrap gap-1">
            <button
              v-if="data.presence === 'inside'"
              type="button"
              class="btn btn-sm btn-outline-primary"
              :disabled="data.busy"
              @click="emit('start-outing', data.stay_id)"
            >
              {{ t('outings.start') }}
            </button>
            <button
              v-else
              type="button"
              class="btn btn-sm btn-outline-success"
              :disabled="data.busy"
              @click="emit('end-outing', data.stay_id)"
            >
              {{ t('outings.end') }}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              :disabled="data.busy"
              @click="emit('check-out', data.stay_id)"
            >
              {{ t('stays.checkOut.action') }}
            </button>
          </div>
        </template>
      </e-column>
    </e-columns>
  </ejs-grid>
</template>
