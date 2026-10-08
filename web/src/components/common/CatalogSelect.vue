<script setup lang="ts">
import { DropDownListComponent as EjsDropdownlist, type ChangeEventArgs } from '@syncfusion/ej2-vue-dropdowns'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCatalogsStore } from '@/stores/catalogs'
import type { CatalogName } from '@/types/domain'

const props = withDefaults(
  defineProps<{
    catalog: CatalogName
    modelValue: string | null
    placeholderKey?: string
    allowEmpty?: boolean
    id?: string
  }>(),
  { placeholderKey: 'common.select', allowEmpty: false, id: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t } = useI18n()
const catalogs = useCatalogsStore()

// Inactive values stay selectable on records that already use them.
const options = computed(() => catalogs.options(props.catalog, props.modelValue))

function onChange(args: ChangeEventArgs): void {
  const value = args.value === null || args.value === undefined ? null : String(args.value)
  if (value !== props.modelValue) emit('update:modelValue', value)
}
</script>

<template>
  <EjsDropdownlist
    :id="id"
    :data-source="options"
    :fields="{ text: 'text', value: 'value' }"
    :value="modelValue"
    :placeholder="t(placeholderKey)"
    :show-clear-button="allowEmpty"
    :allow-filtering="options.length > 15"
    filter-type="Contains"
    :ignore-accent="true"
    :change="onChange"
  />
</template>
