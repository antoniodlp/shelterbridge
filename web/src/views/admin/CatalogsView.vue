<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createCatalogItem, updateCatalogItem } from '@/api/catalogs'
import { isApiError } from '@/api/errors'
import CatalogItemDialog from '@/components/admin/CatalogItemDialog.vue'
import type { CatalogItemPayload } from '@/components/admin/catalogItemModel'
import PageHeader from '@/components/common/PageHeader.vue'
import { useNotify } from '@/composables/useNotify'
import { useCatalogsStore } from '@/stores/catalogs'
import type { CatalogItem, CatalogName } from '@/types/domain'

const NAMES: CatalogName[] = ['case_types', 'genders', 'countries']

const { t } = useI18n()
const notify = useNotify()
const catalogs = useCatalogsStore()

const current = ref<CatalogName>('case_types')
const dialogOpen = ref(false)
const editing = ref<CatalogItem | null>(null)
const saving = ref(false)
// Counts the times the dialog was opened, so a save that finishes late never closes a later opening.
let openings = 0

const items = computed(() =>
  [...catalogs.items[current.value]].sort(
    (a, b) => a.sort_order - b.sort_order || (a.labels.es ?? '').localeCompare(b.labels.es ?? '', 'es'),
  ),
)

function openNew(): void {
  editing.value = null
  openings += 1
  dialogOpen.value = true
}

function openEdit(item: CatalogItem): void {
  editing.value = item
  openings += 1
  dialogOpen.value = true
}

// Pickers everywhere read the store, so they see the change as soon as it is reloaded.
// Reports its own failure, so a failed reload is never taken for a failed save.
async function refresh(name: CatalogName): Promise<void> {
  try {
    await catalogs.reload(name)
  } catch (error) {
    notify.error(error)
  }
}

async function save(payload: CatalogItemPayload): Promise<void> {
  if (saving.value) return
  saving.value = true
  // The tab may change while the request runs; the change belongs to the catalog it was made in.
  const name = current.value
  const target = editing.value
  const opening = openings
  try {
    if (target) {
      await updateCatalogItem(name, target.code, target.updated_at, {
        labels: payload.labels,
        sort_order: payload.sort_order,
        active: payload.active,
      })
    } else {
      await createCatalogItem(name, payload)
    }
  } catch (error) {
    saving.value = false
    notify.error(error)
    // Someone else changed this value: close so the reloaded list shows the current version.
    // Any other failure keeps the form open, because nothing was saved and the same save can be sent again.
    if (isApiError(error, 'stale_record') && opening === openings) dialogOpen.value = false
    await refresh(name)
    return
  }
  // The change is saved: close the form first, so nothing after this can leave it ready to be sent again.
  if (opening === openings) dialogOpen.value = false
  saving.value = false
  notify.success('admin.catalogs.saved')
  await refresh(name)
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.catalogs">
      <template #actions>
        <button type="button" class="btn btn-primary" @click="openNew">{{ t('admin.catalogs.add') }}</button>
      </template>
    </PageHeader>
    <ul class="nav nav-tabs mb-3" role="tablist">
      <li v-for="name in NAMES" :key="name" class="nav-item" role="presentation">
        <button
          type="button"
          class="nav-link"
          :class="{ active: name === current }"
          role="tab"
          :aria-selected="name === current"
          @click="current = name"
        >
          {{ t(`admin.catalogs.names.${name}`) }}
        </button>
      </li>
    </ul>
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th scope="col">{{ t('admin.catalogs.columns.code') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.labelEs') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.labelEn') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.order') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.status') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.code" data-testid="catalog-row">
            <td>
              <code>{{ item.code }}</code>
            </td>
            <td>{{ item.labels.es }}</td>
            <td>{{ item.labels.en }}</td>
            <td>{{ item.sort_order }}</td>
            <td>
              <span class="badge" :class="item.active ? 'text-bg-success' : 'text-bg-secondary'">{{
                item.active ? t('admin.catalogs.active') : t('admin.catalogs.inactive')
              }}</span>
            </td>
            <td>
              <button type="button" class="btn btn-sm btn-link" @click="openEdit(item)">
                {{ t('admin.catalogs.edit') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <CatalogItemDialog
      :open="dialogOpen"
      :catalog="current"
      :item="editing"
      :saving="saving"
      @save="save"
      @cancel="dialogOpen = false"
    />
  </div>
</template>
