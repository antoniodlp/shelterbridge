<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef } from 'vue'
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
// True while a chosen photo is being resized. Saving then would register the person without it.
const photoBusy = ref(false)
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

const { candidates, checking, failed, settle } = useDuplicateCheck(() => ({
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

const duplicatePanel = useTemplateRef('duplicatePanel')

async function openCandidate(personId: string): Promise<void> {
  // After a saved registration the form stays locked, and a second stay must not be opened from here.
  if (saving.value) return
  await router.push({ name: 'person', params: { id: personId }, query: { checkIn: '1' } })
}

/**
 * Enter in a field must not register anyone: the person has not seen the duplicate panel yet.
 * Buttons, links, the notes field and the hidden file input keep their own Enter behavior.
 * Syncfusion's date fields apply a typed date on their own keydown, before it reaches the form.
 */
function blockImplicitSubmit(event: KeyboardEvent): void {
  if (!(event.target instanceof Element)) return
  if (event.target.closest('button, a, textarea, input[type="file"]')) return
  event.preventDefault()
}

async function save(): Promise<void> {
  if (saving.value || photoBusy.value) return
  const todayDate = today()
  personErrors.value = validatePerson(person.value, todayDate)
  stayErrors.value = validateStay(stay.value, todayDate)
  if (showErrorSummary.value) return
  saving.value = true
  // The panel is advisory, so people it already showed when they pressed the button do not stop
  // the registration. Anyone who turns up only now has not been seen yet: show them first.
  const seen = new Set(visibleCandidates.value.map((candidate) => candidate.person_id))
  await settle()
  if (visibleCandidates.value.some((candidate) => !seen.has(candidate.person_id))) {
    saving.value = false
    await nextTick()
    duplicatePanel.value?.reveal()
    return
  }
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
      pendingPhotos.set(personId, chosen, { afterRegistration: true })
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
    <form class="registration-form" novalidate @submit.prevent="save" @keydown.enter="blockImplicitSubmit">
      <!-- One element per part, in phone order: the duplicate panel follows the person section so it
           is seen while the name is typed. From the lg breakpoint it moves to a column on the right. -->
      <div class="registration-layout">
        <section class="card">
          <div class="card-body">
            <h2 class="h5 card-title">{{ t('registration.personSection') }}</h2>
            <PersonForm v-model="person" :errors="personErrors" />
          </div>
        </section>
        <aside v-if="showPanel" class="registration-duplicates">
          <DuplicatePanel
            ref="duplicatePanel"
            :candidates="visibleCandidates"
            :checking="checking"
            :failed="failed"
            @select="openCandidate"
            @dismiss="dismissCandidates"
          />
        </aside>
        <section class="card">
          <div class="card-body">
            <h2 class="h5 card-title">{{ t('registration.staySection') }}</h2>
            <StayForm v-model="stay" :errors="stayErrors" />
          </div>
        </section>
        <section class="card">
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
            <PhotoCapture
              v-else
              id-prefix="registration-photo"
              @captured="setPhoto"
              @busy="photoBusy = $event"
            />
          </div>
        </section>
        <div>
          <p v-if="showErrorSummary" class="text-danger" role="alert">{{ t('registration.fixErrors') }}</p>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="saving || photoBusy">
            {{ saving ? t('registration.saving') : t('registration.save') }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.registration-layout {
  display: grid;
  gap: 1.5rem;
}

/* Bootstrap's lg breakpoint: the form on the left (two thirds), the duplicate panel on the right. */
@media (min-width: 992px) {
  .registration-layout {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: start;
  }

  .registration-layout > * {
    grid-column: 1;
  }

  .registration-layout > .registration-duplicates {
    grid-column: 2;
    grid-row: 1 / span 4;
  }
}
</style>
