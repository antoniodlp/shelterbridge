<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useOnline } from '@/composables/useOnline'

const { t } = useI18n()
const { online } = useOnline()
</script>

<template>
  <div v-if="!online" class="alert alert-warning rounded-0 mb-0 py-2 text-center" role="status">
    <strong>{{ t('common.offline') }}.</strong>
    {{ t('common.offlineHint') }}
  </div>
</template>
