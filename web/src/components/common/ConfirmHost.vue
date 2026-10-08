<script setup lang="ts">
import { DialogComponent as EjsDialog, type CloseEventArgs } from '@syncfusion/ej2-vue-popups'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { activeConfirm, answerConfirm } from '@/composables/useConfirm'

const { t } = useI18n()

const options = computed(() => activeConfirm.value?.options ?? null)
const header = computed(() => (options.value ? t(options.value.titleKey) : ''))
// Rendered by Vue as text, never through the Dialog's HTML "content" property,
// because message parameters can hold names typed by staff.
const message = computed(() =>
  options.value ? t(options.value.messageKey, options.value.messageParams ?? {}) : '',
)
const buttons = computed(() => [
  {
    buttonModel: { content: t(options.value?.cancelKey ?? 'common.cancel'), cssClass: 'e-flat' },
    click: () => answerConfirm(false),
  },
  {
    buttonModel: {
      content: t(options.value?.confirmKey ?? 'common.confirm'),
      isPrimary: true,
      cssClass: options.value?.danger ? 'e-danger' : '',
    },
    click: () => answerConfirm(true),
  },
])

// Escape and the close icon count as "no". Closing because the question was
// answered (not interacted) must not answer the next question.
function onClose(args: CloseEventArgs): void {
  if (!args.isInteracted) return
  answerConfirm(false)
}
</script>

<template>
  <div>
    <EjsDialog
      :visible="options !== null"
      :header="header"
      :buttons="buttons"
      :is-modal="true"
      :show-close-icon="true"
      :close-on-escape="true"
      :animation-settings="{ effect: 'None' }"
      width="min(28rem, 95vw)"
      :close="onClose"
    >
      <p class="mb-0" data-testid="confirm-message">{{ message }}</p>
    </EjsDialog>
  </div>
</template>
