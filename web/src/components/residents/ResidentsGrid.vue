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
import type { ResidentRow } from '@/composables/useResidents'

defineProps<{ rows: ResidentRow[] }>()
const emit = defineEmits<{
  'start-outing': [stayId: string]
  'end-outing': [stayId: string]
}>()

const { t } = useI18n()
provide('grid', [Sort, Filter])

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
        <template #photo="{ data }">
          <PersonThumb :url="data.thumb_url" :name="data.full_name" />
        </template>
      </e-column>
      <e-column
        field="full_name"
        :header-text="t('residents.columns.name')"
        width="190"
        :allow-filtering="false"
      />
      <e-column
        field="age"
        :header-text="t('residents.columns.age')"
        width="70"
        :allow-filtering="false"
        :template="'age'"
      >
        <template #age="{ data }">{{ data.age_label }}</template>
      </e-column>
      <e-column field="gender_label" :header-text="t('residents.columns.gender')" width="110" />
      <e-column field="country_label" :header-text="t('residents.columns.country')" width="120" />
      <e-column field="bed" :header-text="t('residents.columns.bed')" width="80" />
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
        field="is_unaccompanied_minor"
        :header-text="t('residents.columns.unaccompanied')"
        width="140"
        :allow-filtering="false"
        :template="'unaccompanied'"
      >
        <template #unaccompanied="{ data }">
          <span
            v-if="data.is_unaccompanied_minor"
            class="badge text-bg-danger"
            data-testid="unaccompanied-badge"
            >{{ t('residents.unaccompaniedBadge') }}</span
          >
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
            <RouterLink class="btn btn-sm btn-link" :to="{ name: 'person', params: { id: data.person_id } }">{{
              t('residents.viewRecord')
            }}</RouterLink>
          </div>
        </template>
      </e-column>
    </e-columns>
  </ejs-grid>
</template>
