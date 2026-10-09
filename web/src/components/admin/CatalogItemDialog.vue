<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import {
  type CatalogItemForm,
  type CatalogItemPayload,
  catalogItemToForm,
  emptyCatalogItem,
  formToPayload,
  validateCatalogItem,
} from '@/components/admin/catalogItemModel'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import type { CatalogItem, CatalogName } from '@/types/domain'

const props = defineProps<{ open: boolean; catalog: CatalogName; item: CatalogItem | null; saving: boolean }>()
const emit = defineEmits<{ save: [payload: CatalogItemPayload]; cancel: [] }>()

const { t } = useI18n()
const form = ref<CatalogItemForm>(emptyCatalogItem())
const errors = ref<FieldErrors>({})
const isNew = computed(() => props.item === null)

// The dialog stays mounted; each opening loads the chosen value, or a blank one.
watch(
  () => [props.open, props.item] as const,
  ([open, item]) => {
    if (!open) return
    form.value = item ? catalogItemToForm(item) : emptyCatalogItem()
    errors.value = {}
  },
  { immediate: true },
)

const title = computed(() =>
  isNew.value
    ? t('admin.catalogs.dialog.newTitle', { catalog: t(`admin.catalogs.names.${props.catalog}`) })
    : t('admin.catalogs.dialog.editTitle'),
)
const codeHelp = computed(() =>
  props.catalog === 'countries' ? t('admin.catalogs.dialog.codeHelpCountries') : t('admin.catalogs.dialog.codeHelpSlug'),
)

function submit(): void {
  errors.value = validateCatalogItem(props.catalog, form.value, isNew.value)
  if (hasErrors(errors.value)) return
  emit('save', formToPayload(form.value, props.item?.labels ?? {}))
}

function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="open"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="title"
    width="min(32rem, 95vw)"
    @close="onClose"
  >
    <div>
      <!-- Always rendered, so the Dialog moves it into its padded content area when created. -->
      <form v-if="open" class="catalog-item-form" novalidate @submit.prevent="submit">
        <div class="mb-3">
          <label for="catalog-code" class="form-label">{{ t('admin.catalogs.dialog.code') }}</label>
          <input
            id="catalog-code"
            v-model="form.code"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': errors.code }"
            :readonly="!isNew"
            autocomplete="off"
          />
          <div class="form-text">{{ codeHelp }}</div>
          <div v-if="errors.code" class="invalid-feedback d-block">{{ t(errors.code) }}</div>
        </div>
        <div class="mb-3">
          <label for="catalog-label-es" class="form-label">{{ t('admin.catalogs.dialog.labelEs') }}</label>
          <input
            id="catalog-label-es"
            v-model="form.label_es"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': errors.label_es }"
            autocomplete="off"
          />
          <div v-if="errors.label_es" class="invalid-feedback">{{ t(errors.label_es) }}</div>
        </div>
        <div class="mb-3">
          <label for="catalog-label-en" class="form-label">{{ t('admin.catalogs.dialog.labelEn') }}</label>
          <input id="catalog-label-en" v-model="form.label_en" type="text" class="form-control" autocomplete="off" />
        </div>
        <div class="mb-3">
          <label for="catalog-order" class="form-label">{{ t('admin.catalogs.dialog.order') }}</label>
          <input
            id="catalog-order"
            v-model="form.sort_order"
            type="text"
            inputmode="numeric"
            class="form-control"
            :class="{ 'is-invalid': errors.sort_order }"
          />
          <div v-if="errors.sort_order" class="invalid-feedback">{{ t(errors.sort_order) }}</div>
        </div>
        <div class="form-check mb-3">
          <input id="catalog-active" v-model="form.active" class="form-check-input" type="checkbox" />
          <label for="catalog-active" class="form-check-label">{{ t('admin.catalogs.dialog.active') }}</label>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ t('common.save') }}</button>
        </div>
      </form>
    </div>
  </ejs-dialog>
</template>
