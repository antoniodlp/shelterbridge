<script setup lang="ts">
import { computed } from 'vue'
import { DatePickerComponent as EjsDatepicker } from '@syncfusion/ej2-vue-calendars'
import { usePickerLabel } from '@/components/forms/usePickerLabel'
import { fromLocalDate, toLocalDate } from '@/lib/dates'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string | null
    min?: string | null
    max?: string | null
    invalid?: boolean
  }>(),
  { min: null, max: null, invalid: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

// Syncfusion's own bounds, used when no bound is given.
const FIRST_DAY = new Date(1900, 0, 1)
const LAST_DAY = new Date(2099, 11, 31)

const pickerValue = computed(() => toLocalDate(props.modelValue))
const minDate = computed(() => toLocalDate(props.min) ?? FIRST_DAY)
const maxDate = computed(() => toLocalDate(props.max) ?? LAST_DAY)

function onChange(args: { value: Date | null }): void {
  const next = fromLocalDate(args.value)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

const { picker, onCreated } = usePickerLabel()
</script>

<template>
  <ejs-datepicker
    :id="id"
    ref="picker"
    :value="pickerValue"
    format="dd/MM/yyyy"
    :min="minDate"
    :max="maxDate"
    :css-class="invalid ? 'e-error' : ''"
    @created="onCreated"
    @change="onChange"
  />
</template>
