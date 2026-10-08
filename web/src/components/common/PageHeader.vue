<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ titleKey: string; titleParams?: Record<string, unknown> }>()

const { t } = useI18n()
</script>

<template>
  <header class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
    <h1 class="h3 mb-0">{{ t(titleKey, titleParams ?? {}) }}</h1>
    <div class="d-flex flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
