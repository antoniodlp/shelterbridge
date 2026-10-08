<script setup lang="ts">
import { ToastComponent as EjsToast } from '@syncfusion/ej2-vue-notifications'
import { onMounted, ref, watch } from 'vue'
import { pendingNotifications } from '@/composables/useNotify'

const toast = ref<InstanceType<typeof EjsToast> | null>(null)

// Syncfusion renders toast content as HTML. Messages can hold names typed by
// staff, so they are escaped and always show as plain text.
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESC[c] ?? c)
}

function showPending(): void {
  if (!toast.value) return
  for (const notification of pendingNotifications.value.splice(0)) {
    const isError = notification.kind === 'error'
    toast.value.show({
      content: escapeHtml(notification.text),
      cssClass: isError ? 'e-toast-danger' : 'e-toast-success',
      timeOut: isError ? 8000 : 4000,
    })
  }
}

watch(() => pendingNotifications.value.length, showPending, { flush: 'post' })

// Notifications queued before this host mounted wait in the queue. The Toast
// is ready once this hook runs, because a child's mounted hook runs first.
onMounted(showPending)
</script>

<template>
  <EjsToast ref="toast" :position="{ X: 'Right', Y: 'Top' }" :show-close-button="true" data-testid="toast-host" />
</template>
