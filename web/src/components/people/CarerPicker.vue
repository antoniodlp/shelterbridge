<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DropDownListComponent as EjsDropdownlist } from '@syncfusion/ej2-vue-dropdowns'
import { listCurrentResidents } from '@/api/stays'
import { useNotify } from '@/composables/useNotify'
import { fullName } from '@/lib/people'
import type { CurrentResident } from '@/types/domain'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string | null
    excludeId?: string | null
    currentLabel?: string | null
  }>(),
  { excludeId: null, currentLabel: null },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t } = useI18n()
const notify = useNotify()
const residents = ref<CurrentResident[]>([])
const loaded = ref(false)

onMounted(async () => {
  try {
    residents.value = await listCurrentResidents()
  } catch (error) {
    notify.error(error)
  } finally {
    loaded.value = true
  }
})

interface Option {
  value: string
  text: string
}

const options = computed<Option[]>(() => {
  const list = residents.value
    .filter(
      (resident): resident is CurrentResident & { person_id: string } =>
        !!resident.person_id && resident.person_id !== props.excludeId,
    )
    .map((resident) => {
      const name = fullName(resident.first_name, resident.last_name)
      return { value: resident.person_id, text: resident.bed ? `${name} (${resident.bed})` : name }
    })
    .sort((a, b) => a.text.localeCompare(b.text, 'es'))
  // A carer who already left the shelter stays selectable so editing does not lose them.
  if (props.modelValue && props.currentLabel && !list.some((option) => option.value === props.modelValue)) {
    list.unshift({ value: props.modelValue, text: props.currentLabel })
  }
  return list
})

const fields = { text: 'text', value: 'value' }

function onChange(args: { value: string | null }): void {
  const next = args.value ?? null
  if (next !== props.modelValue) emit('update:modelValue', next)
}
</script>

<template>
  <ejs-dropdownlist
    v-if="loaded"
    :id="id"
    :value="modelValue"
    :data-source="options"
    :fields="fields"
    :allow-filtering="true"
    filter-type="Contains"
    :ignore-accent="true"
    :show-clear-button="true"
    :placeholder="t('person.form.carerPlaceholder')"
    :filter-bar-placeholder="t('person.form.carerFilter')"
    @change="onChange"
  />
  <input v-else :id="id" class="form-control" disabled :placeholder="t('person.form.carerLoading')" />
</template>
