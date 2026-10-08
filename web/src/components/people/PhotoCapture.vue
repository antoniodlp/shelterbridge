<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { makePhotoPair, type PhotoPair } from '@/lib/imageResize'

withDefaults(defineProps<{ idPrefix?: string }>(), { idPrefix: 'photo' })
// busy: true while a chosen picture is being resized, so a form around this component can wait for it.
const emit = defineEmits<{ captured: [photo: PhotoPair]; busy: [active: boolean] }>()

const { t } = useI18n()
// Desktops use the webcam; phones use the file input, which opens the camera directly.
const canUseCamera =
  typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
const video = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const problem = ref<string | null>(null)
const busy = ref(false)
const starting = ref(false)
let disposed = false

function stopCamera(): void {
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
}

async function startCamera(): Promise<void> {
  if (starting.value || stream.value) return
  starting.value = true
  problem.value = null
  try {
    const opened = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    if (disposed) {
      // The component went away while the browser was asking for permission: do not leave the camera on.
      opened.getTracks().forEach((track) => track.stop())
      return
    }
    stream.value = opened
    await nextTick()
    if (video.value) {
      video.value.srcObject = opened
      await video.value.play()
    }
  } catch {
    stopCamera()
    problem.value = 'photos.cameraUnavailable'
  } finally {
    starting.value = false
  }
}

function setBusy(active: boolean): void {
  busy.value = active
  emit('busy', active)
}

async function process(source: Blob): Promise<void> {
  // A picture was chosen, so the webcam preview is no longer needed (and its light should go off).
  stopCamera()
  setBusy(true)
  problem.value = null
  try {
    emit('captured', await makePhotoPair(source))
  } catch {
    problem.value = 'photos.processFailed'
  } finally {
    setBusy(false)
  }
}

async function takeSnapshot(): Promise<void> {
  const element = video.value
  if (!element || !element.videoWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = element.videoWidth
  canvas.height = element.videoHeight
  canvas.getContext('2d')?.drawImage(element, 0, 0)
  const frame = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  stopCamera()
  if (frame) await process(frame)
}

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await process(file)
}

onBeforeUnmount(() => {
  disposed = true
  stopCamera()
})
</script>

<template>
  <div>
    <video v-if="stream" ref="video" class="w-100 rounded mb-2 bg-dark" autoplay playsinline muted />
    <div class="d-flex flex-wrap gap-2">
      <button
        v-if="canUseCamera && !stream"
        type="button"
        class="btn btn-outline-primary"
        :disabled="busy || starting"
        @click="startCamera"
      >
        {{ t('photos.useCamera') }}
      </button>
      <template v-if="stream">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="takeSnapshot">
          {{ t('photos.takePhoto') }}
        </button>
        <button type="button" class="btn btn-outline-secondary" @click="stopCamera">
          {{ t('photos.closeCamera') }}
        </button>
      </template>
      <label class="btn btn-outline-primary mb-0" :for="`${idPrefix}-file`">{{ t('photos.chooseFile') }}</label>
      <input
        :id="`${idPrefix}-file`"
        type="file"
        accept="image/*"
        capture="environment"
        class="visually-hidden"
        :disabled="busy"
        @change="onFileChosen"
      />
    </div>
    <p v-if="busy" class="small text-body-secondary mt-2 mb-0">{{ t('photos.processing') }}</p>
    <p v-if="problem" class="small text-danger mt-2 mb-0" role="alert">{{ t(problem) }}</p>
  </div>
</template>
