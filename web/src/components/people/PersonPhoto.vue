<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSignedPhotoUrls, uploadPersonPhoto } from '@/api/photos'
import PhotoCapture from '@/components/people/PhotoCapture.vue'
import { useNotify } from '@/composables/useNotify'
import { usePendingPhotos } from '@/composables/usePendingPhotos'
import type { PhotoPair } from '@/lib/imageResize'

const props = withDefaults(
  defineProps<{ personId: string; photoPath: string | null; name: string; readonly?: boolean }>(),
  { readonly: false },
)
const emit = defineEmits<{ updated: [] }>()

const { t } = useI18n()
const notify = useNotify()
const pendingPhotos = usePendingPhotos()

// The newest signed URL, with the path it was signed for. It is shown only while that is the
// record's path, so one person's picture never stays on screen under another path.
const signed = ref<{ path: string; url: string } | null>(null)
const url = computed(() => (signed.value && signed.value.path === props.photoPath ? signed.value.url : null))
const capturing = ref(false)
const uploading = ref(false)
const pending = computed(() => pendingPhotos.get(props.personId))

/**
 * Signs the path again. A failure leaves the picture that is already shown: the photo
 * is optional on screen, and nothing here can undo an upload that already succeeded.
 */
async function refresh(path: string | null): Promise<void> {
  if (!path) return
  try {
    const fresh = (await getSignedPhotoUrls([path]))[path]
    if (fresh) signed.value = { path, url: fresh }
  } catch {
    // The previous picture, or "Sin foto", stays.
  }
}

watch(() => props.photoPath, refresh, { immediate: true })

async function upload(photo: PhotoPair): Promise<void> {
  if (uploading.value) return
  const id = props.personId
  uploading.value = true
  let path: string
  try {
    path = await uploadPersonPhoto(id, photo.full, photo.thumb)
  } catch (error) {
    pendingPhotos.set(id, photo)
    notify.error(error)
    return
  } finally {
    uploading.value = false
  }
  // The photo is saved. Nothing below may put it back in the retry store or report an upload
  // error. The path is always the same, so the record's photoPath prop does not change after
  // a replacement: the new picture is signed here, which also gives it a new URL for the browser.
  pendingPhotos.clear(id)
  capturing.value = false
  notify.success('photos.saved')
  emit('updated')
  await refresh(path)
}

async function retry(): Promise<void> {
  if (pending.value) await upload(pending.value)
}
</script>

<template>
  <section class="card mb-4">
    <div class="card-body text-center">
      <img v-if="url" :src="url" :alt="t('photos.thumbAlt', { name })" class="img-fluid rounded mb-3 person-photo" />
      <div v-else class="text-body-secondary border rounded py-4 mb-3">{{ t('photos.none') }}</div>
      <div v-if="pending" class="alert alert-warning text-start" role="alert" data-testid="photo-pending">
        <p class="mb-2">{{ t('photos.uploadFailed') }}</p>
        <button v-if="!readonly" type="button" class="btn btn-sm btn-warning" :disabled="uploading" @click="retry">
          {{ t('photos.retry') }}
        </button>
      </div>
      <template v-if="!readonly">
        <PhotoCapture v-if="capturing" id-prefix="record-photo" @captured="upload" />
        <button v-else type="button" class="btn btn-sm btn-outline-primary" @click="capturing = true">
          {{ photoPath ? t('photos.change') : t('photos.add') }}
        </button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.person-photo {
  max-height: 18rem;
  object-fit: cover;
}
</style>
