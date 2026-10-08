<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { registerAndCheckIn } from '@/api/people'
import { uploadPersonPhoto } from '@/api/photos'
import PageHeader from '@/components/common/PageHeader.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import DuplicatePanel from '@/components/people/DuplicatePanel.vue'
import PersonForm from '@/components/people/PersonForm.vue'
import { emptyPerson, formToPersonInput, validatePerson } from '@/components/people/personFormModel'
import PhotoCapture from '@/components/people/PhotoCapture.vue'
import StayForm from '@/components/stays/StayForm.vue'
import { emptyStay, formToStayInput, validateStay } from '@/components/stays/stayFormModel'
import { useDuplicateCheck } from '@/composables/useDuplicateCheck'
import { useNotify } from '@/composables/useNotify'
import { usePendingPhotos } from '@/composables/usePendingPhotos'
import { useShelterTime } from '@/composables/useShelterTime'
import type { PhotoPair } from '@/lib/imageResize'

const { t } = useI18n()
const router = useRouter()
const notify = useNotify()
const { today } = useShelterTime()

const person = ref(emptyPerson())
const stay = ref(emptyStay(today()))
const personErrors = ref<FieldErrors>({})
const stayErrors = ref<FieldErrors>({})
const saving = ref(false)
const pendingPhotos = usePendingPhotos()
const photo = shallowRef<PhotoPair | null>(null)
const preview = ref<string | null>(null)

function setPhoto(next: PhotoPair | null): void {
  if (preview.value) URL.revokeObjectURL(preview.value)
  photo.value = next
  preview.value = next ? URL.createObjectURL(next.thumb) : null
}

onBeforeUnmount(() => setPhoto(null))
const showErrorSummary = computed(() => hasErrors(personErrors.value) || hasErrors(stayErrors.value))

const { candidates, checking, failed } = useDuplicateCheck(() => ({
  first_name: person.value.first_name,
  last_name: person.value.last_name,
  birth_date: person.value.birth_date,
  country_code: person.value.country_code,
}))
// Candidates dismissed with "Es una persona nueva" stay hidden; new ones still show.
const dismissed = ref<Set<string>>(new Set())
const visibleCandidates = computed(() =>
  candidates.value.filter((candidate) => !dismissed.value.has(candidate.person_id)),
)
const showPanel = computed(() => visibleCandidates.value.length > 0 || failed.value)

function dismissCandidates(): void {
  dismissed.value = new Set([...dismissed.value, ...candidates.value.map((candidate) => candidate.person_id)])
}

async function openCandidate(personId: string): Promise<void> {
  await router.push({ name: 'person', params: { id: personId }, query: { checkIn: '1' } })
}

async function save(): Promise<void> {
  if (saving.value) return
  const todayDate = today()
  personErrors.value = validatePerson(person.value, todayDate)
  stayErrors.value = validateStay(stay.value, todayDate)
  if (showErrorSummary.value) return
  saving.value = true
  let personId: string
  try {
    const registered = await registerAndCheckIn(
      formToPersonInput(person.value, todayDate),
      formToStayInput(stay.value),
    )
    personId = registered.person_id
  } catch (error) {
    // Nothing was saved, so the form opens again with everything that was typed.
    notify.error(error)
    saving.value = false
    return
  }
  // The person and the stay are saved. The form stays locked from here on, so a failed
  // navigation (for example a lazy route chunk that does not load) cannot lead to a
  // second registration of the same person.
  notify.success('registration.saved')
  const chosen = photo.value
  if (chosen) {
    try {
      await uploadPersonPhoto(personId, chosen.full, chosen.thumb)
    } catch {
      // The person is registered. Their record offers "Reintentar foto" with this picture.
      pendingPhotos.set(personId, chosen)
    }
  }
  try {
    await router.push({ name: 'person', params: { id: personId } })
  } catch (error) {
    notify.error(error)
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.newPerson" />
    <form class="registration-form" novalidate @submit.prevent="save">
      <div class="row g-4">
        <div class="col-lg-8">
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title">{{ t('registration.personSection') }}</h2>
              <PersonForm v-model="person" :errors="personErrors" />
            </div>
          </section>
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title">{{ t('registration.staySection') }}</h2>
              <StayForm v-model="stay" :errors="stayErrors" />
            </div>
          </section>
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title">{{ t('photos.title') }}</h2>
              <div v-if="preview" class="d-flex align-items-center gap-3">
                <img
                  :src="preview"
                  :alt="t('photos.previewAlt')"
                  width="96"
                  height="96"
                  class="rounded object-fit-cover"
                />
                <div>
                  <p class="mb-2" data-testid="photo-ready">{{ t('photos.ready') }}</p>
                  <button type="button" class="btn btn-sm btn-outline-secondary" @click="setPhoto(null)">
                    {{ t('photos.remove') }}
                  </button>
                </div>
              </div>
              <PhotoCapture v-else id-prefix="registration-photo" @captured="setPhoto" />
            </div>
          </section>
          <p v-if="showErrorSummary" class="text-danger" role="alert">{{ t('registration.fixErrors') }}</p>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="saving">
            {{ saving ? t('registration.saving') : t('registration.save') }}
          </button>
        </div>
        <aside class="col-lg-4">
          <DuplicatePanel
            v-if="showPanel"
            :candidates="visibleCandidates"
            :checking="checking"
            :failed="failed"
            @select="openCandidate"
            @dismiss="dismissCandidates"
          />
        </aside>
      </div>
    </form>
  </div>
</template>
