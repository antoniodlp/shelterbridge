<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import { cleanText } from '@/lib/text'

const props = defineProps<{ name: string | null }>()
const emit = defineEmits<{ confirm: [comment: string | null]; cancel: [] }>()

const { t } = useI18n()
const comment = ref('')

// The dialog stays mounted; start every opening with an empty comment.
watch(
  () => props.name,
  (name) => {
    if (name !== null) comment.value = ''
  },
)

function submit(): void {
  emit('confirm', cleanText(comment.value))
}

// Escape or the close icon. Closing because the parent cleared `name` is not interacted.
function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="name !== null"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="t('outings.startDialog.title')"
    width="min(28rem, 95vw)"
    @close="onClose"
  >
    <div>
      <!-- Always rendered, so the Dialog moves it into its padded content area when created. -->
      <form v-if="name !== null" class="outing-start-form" @submit.prevent="submit">
        <p class="fw-semibold">{{ name }}</p>
        <label for="outing-comment" class="form-label">{{ t('outings.startDialog.commentLabel') }}</label>
        <input
          id="outing-comment"
          v-model="comment"
          type="text"
          class="form-control"
          maxlength="500"
          autocomplete="off"
          :placeholder="t('outings.startDialog.commentPlaceholder')"
        />
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary">{{ t('outings.startDialog.submit') }}</button>
        </div>
      </form>
    </div>
  </ejs-dialog>
</template>
