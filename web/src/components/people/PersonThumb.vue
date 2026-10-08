<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { initials } from '@/lib/people'

const props = withDefaults(defineProps<{ url: string | null; name: string; size?: number }>(), {
  size: 40,
})

const { t } = useI18n()
const failed = ref(false)

watch(
  () => props.url,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <img
    v-if="url && !failed"
    :src="url"
    :alt="t('photos.thumbAlt', { name })"
    :width="size"
    :height="size"
    class="rounded-circle object-fit-cover"
    @error="failed = true"
  />
  <span
    v-else
    class="d-inline-flex align-items-center justify-content-center rounded-circle bg-secondary-subtle text-secondary-emphasis fw-semibold"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 2.6)}px` }"
    aria-hidden="true"
    >{{ initials(name) }}</span
  >
</template>
