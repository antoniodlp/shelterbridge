<script setup lang="ts">
import { computed } from 'vue'
import { DateTimePickerComponent as EjsDatetimepicker } from '@syncfusion/ej2-vue-calendars'
import { fromWallClock, toWallClock } from '@/lib/dates'
import { useSettingsStore } from '@/stores/settings'

const props = withDefaults(
  defineProps<{ id: string; modelValue: string | null; max?: string | null; invalid?: boolean }>(),
  { max: null, invalid: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const settings = useSettingsStore()
const LAST_MOMENT = new Date(2099, 11, 31, 23, 59)

// The picker shows the shelter's wall-clock time, whatever the browser's timezone is.
const pickerValue = computed(() => toWallClock(props.modelValue, settings.timezone))
const maxValue = computed(() => toWallClock(props.max, settings.timezone) ?? LAST_MOMENT)

function sameMinute(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return Math.floor(Date.parse(a) / 60_000) === Math.floor(Date.parse(b) / 60_000)
}

function onChange(args: { value: Date | null }): void {
  const next = fromWallClock(args.value, settings.timezone)
  if (!sameMinute(next, props.modelValue)) emit('update:modelValue', next)
}
</script>

<template>
  <ejs-datetimepicker
    :id="id"
    :value="pickerValue"
    format="dd/MM/yyyy HH:mm"
    time-format="HH:mm"
    :step="5"
    :max="maxValue"
    :css-class="invalid ? 'e-error' : ''"
    @change="onChange"
  />
</template>
