<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HeadcountSummary } from '@/composables/useResidents'

const props = defineProps<{ summary: HeadcountSummary }>()
const { t } = useI18n()

const items = computed(() => [
  { key: 'total', value: props.summary.total, alert: false },
  { key: 'inside', value: props.summary.inside, alert: false },
  { key: 'outside', value: props.summary.outside, alert: false },
  { key: 'minors', value: props.summary.minors, alert: false },
  { key: 'unaccompanied', value: props.summary.unaccompanied, alert: props.summary.unaccompanied > 0 },
])
</script>

<template>
  <section class="row row-cols-2 row-cols-md-5 g-2" :aria-label="t('residents.headcount.label')">
    <div v-for="item in items" :key="item.key" class="col">
      <div class="border rounded p-2 h-100" :class="{ 'border-danger': item.alert }">
        <div
          class="fs-3 fw-semibold"
          :class="{ 'text-danger': item.alert }"
          :data-testid="`count-${item.key}`"
        >
          {{ item.value }}
        </div>
        <div class="small text-body-secondary">{{ t(`residents.headcount.${item.key}`) }}</div>
      </div>
    </div>
  </section>
</template>
