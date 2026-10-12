<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DuplicateCandidate } from '@/api/people'
import PersonThumb from '@/components/people/PersonThumb.vue'
import { useShelterTime } from '@/composables/useShelterTime'
import { useThumbnails } from '@/composables/useThumbnails'
import { formatAge, fullName } from '@/lib/people'
import { ageOn } from '@/lib/shelterTime'
import { useCatalogsStore } from '@/stores/catalogs'

const props = defineProps<{ candidates: DuplicateCandidate[]; checking: boolean; failed: boolean }>()
const emit = defineEmits<{ select: [personId: string]; dismiss: [] }>()

const { t } = useI18n()
const { formatDate, today } = useShelterTime()
const catalogs = useCatalogsStore()
const thumbs = useThumbnails()
const root = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)

/** Brings the panel on screen and moves focus to its heading, so a screen reader announces it too. */
function reveal(): void {
  // scrollIntoView is missing in some test environments.
  root.value?.scrollIntoView?.({ block: 'center' })
  heading.value?.focus({ preventScroll: true })
}

defineExpose({ reveal })

watch(
  () => props.candidates,
  (list) => thumbs.load(list.map((candidate) => candidate.photo_path)),
  { immediate: true },
)

function ageLabel(candidate: DuplicateCandidate): string {
  const age = formatAge(ageOn(candidate.birth_date, today()))
  return age ? t('registration.duplicates.age', { age }) : ''
}

function stayLabel(candidate: DuplicateCandidate): string {
  if (!candidate.last_entry_date) return t('registration.duplicates.noStays')
  if (!candidate.last_exit_date) {
    return t('registration.duplicates.staying', { from: formatDate(candidate.last_entry_date) })
  }
  return t('registration.duplicates.lastStay', {
    from: formatDate(candidate.last_entry_date),
    to: formatDate(candidate.last_exit_date),
  })
}
</script>

<template>
  <section ref="root" class="card border-warning" aria-live="polite" data-testid="duplicate-panel">
    <div class="card-body">
      <h2 ref="heading" class="h5 card-title" tabindex="-1">{{ t('registration.duplicates.title') }}</h2>
      <p class="small text-body-secondary">{{ t('registration.duplicates.intro') }}</p>
      <p v-if="checking" class="small">{{ t('registration.duplicates.checking') }}</p>
      <p v-if="failed" class="small text-danger">{{ t('registration.duplicates.failed') }}</p>
      <ul class="list-unstyled mb-3">
        <li
          v-for="candidate in candidates"
          :key="candidate.person_id"
          class="d-flex gap-2 align-items-start border-bottom py-2"
          data-testid="duplicate-candidate"
        >
          <PersonThumb
            :url="thumbs.thumbUrl(candidate.photo_path)"
            :name="fullName(candidate.first_name, candidate.last_name)"
            :size="48"
          />
          <div class="flex-grow-1">
            <div class="fw-semibold">{{ fullName(candidate.first_name, candidate.last_name) }}</div>
            <div class="small text-body-secondary">
              <span v-if="ageLabel(candidate)">{{ ageLabel(candidate) }}</span>
              <span v-if="ageLabel(candidate) && candidate.country_code">, </span>
              <span v-if="candidate.country_code">{{ catalogs.label('countries', candidate.country_code) }}</span>
            </div>
            <div class="small">{{ stayLabel(candidate) }}</div>
            <button
              type="button"
              class="btn btn-sm btn-outline-primary mt-1"
              @click="emit('select', candidate.person_id)"
            >
              {{ t('registration.duplicates.isThisPerson') }}
            </button>
          </div>
        </li>
      </ul>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('dismiss')">
        {{ t('registration.duplicates.isNewPerson') }}
      </button>
    </div>
  </section>
</template>
