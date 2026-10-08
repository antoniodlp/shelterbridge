<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { registerAndCheckIn } from '@/api/people'
import PageHeader from '@/components/common/PageHeader.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import PersonForm from '@/components/people/PersonForm.vue'
import { emptyPerson, formToPersonInput, validatePerson } from '@/components/people/personFormModel'
import StayForm from '@/components/stays/StayForm.vue'
import { emptyStay, formToStayInput, validateStay } from '@/components/stays/stayFormModel'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'

const { t } = useI18n()
const router = useRouter()
const notify = useNotify()
const { today } = useShelterTime()

const person = ref(emptyPerson())
const stay = ref(emptyStay(today()))
const personErrors = ref<FieldErrors>({})
const stayErrors = ref<FieldErrors>({})
const saving = ref(false)
const showErrorSummary = computed(() => hasErrors(personErrors.value) || hasErrors(stayErrors.value))

async function save(): Promise<void> {
  if (saving.value) return
  const todayDate = today()
  personErrors.value = validatePerson(person.value, todayDate)
  stayErrors.value = validateStay(stay.value, todayDate)
  if (showErrorSummary.value) return
  saving.value = true
  try {
    const { person_id } = await registerAndCheckIn(
      formToPersonInput(person.value, todayDate),
      formToStayInput(stay.value),
    )
    notify.success('registration.saved')
    await router.push({ name: 'person', params: { id: person_id } })
  } catch (error) {
    notify.error(error)
  } finally {
    saving.value = false
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
          <p v-if="showErrorSummary" class="text-danger" role="alert">{{ t('registration.fixErrors') }}</p>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="saving">
            {{ saving ? t('registration.saving') : t('registration.save') }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
