<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { isApiError } from '@/api/errors'
import { listOutingsForStay } from '@/api/outings'
import { getPerson, updatePerson } from '@/api/people'
import { checkIn, listStaysForPerson } from '@/api/stays'
import PageHeader from '@/components/common/PageHeader.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import OutingList from '@/components/outings/OutingList.vue'
import PersonDetails from '@/components/people/PersonDetails.vue'
import PersonForm from '@/components/people/PersonForm.vue'
import {
  formToPersonInput,
  type PersonFormValue,
  personToForm,
  validatePerson,
} from '@/components/people/personFormModel'
import StayForm from '@/components/stays/StayForm.vue'
import StayHistory from '@/components/stays/StayHistory.vue'
import { emptyStay, formToStayInput, type StayFormValue, validateStay } from '@/components/stays/stayFormModel'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { fullName } from '@/lib/people'
import type { Outing, Person, Stay } from '@/types/domain'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const notify = useNotify()
const { confirm } = useConfirm()
const { formatDate, today } = useShelterTime()

const personId = computed(() => String(route.params.id))
const person = ref<Person | null>(null)
const carer = ref<Person | null>(null)
const stays = ref<Stay[]>([])
const outings = ref<Outing[]>([])
const notFound = ref(false)

const openStay = computed(() => stays.value.find((stay) => stay.exit_date === null) ?? null)
const merged = computed(() => !!person.value?.merged_into_id)
const name = computed(() => (person.value ? fullName(person.value.first_name, person.value.last_name) : ''))
const carerName = computed(() => (carer.value ? fullName(carer.value.first_name, carer.value.last_name) : null))

const personForm = ref<PersonFormValue | null>(null)
// The version the form was opened from. load() can refresh person while the form is open
// (a photo, a correction, a check-in), and saving must not overwrite someone else's change.
const personVersion = ref<string | null>(null)
const personErrors = ref<FieldErrors>({})
const savingPerson = ref(false)

const stayForm = ref<StayFormValue | null>(null)
const stayErrors = ref<FieldErrors>({})
const savingStay = ref(false)
const overlapHint = ref(false)

async function load(): Promise<void> {
  const id = personId.value
  try {
    const loadedPerson = await getPerson(id)
    const [loadedStays, loadedCarer] = await Promise.all([
      listStaysForPerson(id),
      loadedPerson.carer_id ? getPerson(loadedPerson.carer_id).catch(() => null) : Promise.resolve(null),
    ])
    const current = loadedStays.find((stay) => stay.exit_date === null)
    const loadedOutings = current ? await listOutingsForStay(current.id) : []
    // The route may have moved to another record while this one was loading (a carer or merge
    // link reuses this view). Showing the old answer would put one person's data, and later
    // their id in a save, under another person's address.
    if (id !== personId.value) return
    person.value = loadedPerson
    stays.value = loadedStays
    carer.value = loadedCarer
    outings.value = loadedOutings
    notFound.value = false
  } catch (error) {
    if (id !== personId.value) return
    if (isApiError(error, 'not_found') || isApiError(error, 'validation')) notFound.value = true
    else notify.error(error)
  }
}

watch(
  personId,
  async () => {
    person.value = null
    personForm.value = null
    stayForm.value = null
    overlapHint.value = false
    await load()
    if (route.query.checkIn === '1' && person.value && !openStay.value && !merged.value) startCheckIn()
  },
  { immediate: true },
)

/** stale_record offers a reload; any other error is shown and the form keeps its input. */
async function handleSaveError(error: unknown, discard: () => void): Promise<void> {
  if (!isApiError(error, 'stale_record')) {
    notify.error(error)
    return
  }
  const reload = await confirm({
    titleKey: 'person.staleTitle',
    messageKey: 'person.staleMessage',
    confirmKey: 'common.reload',
    cancelKey: 'person.keepEditing',
  })
  if (!reload) return
  discard()
  await load()
}

function startEdit(): void {
  if (!person.value) return
  personForm.value = personToForm(person.value)
  personVersion.value = person.value.updated_at
  personErrors.value = {}
}

async function savePerson(): Promise<void> {
  const current = person.value
  const version = personVersion.value
  if (!current || !version || !personForm.value || savingPerson.value) return
  const todayDate = today()
  personErrors.value = validatePerson(personForm.value, todayDate)
  if (hasErrors(personErrors.value)) return
  savingPerson.value = true
  try {
    await updatePerson(current.id, version, formToPersonInput(personForm.value, todayDate))
    personForm.value = null
    notify.success('person.saved')
    await load()
  } catch (error) {
    await handleSaveError(error, () => {
      personForm.value = null
    })
  } finally {
    savingPerson.value = false
  }
}

function startCheckIn(): void {
  stayForm.value = emptyStay(today())
  stayErrors.value = {}
  overlapHint.value = false
}

function cancelCheckIn(): void {
  stayForm.value = null
  overlapHint.value = false
}

async function saveCheckIn(): Promise<void> {
  if (!stayForm.value || savingStay.value) return
  stayErrors.value = validateStay(stayForm.value, today())
  if (hasErrors(stayErrors.value)) return
  savingStay.value = true
  overlapHint.value = false
  try {
    await checkIn(personId.value, formToStayInput(stayForm.value))
  } catch (error) {
    notify.error(error)
    // A stay that started and ended today occupies today; reopening it is the fix (see the stay history).
    if (isApiError(error, 'overlapping_stays')) overlapHint.value = true
    // Another computer checked the person in first: show what is really there.
    if (isApiError(error, 'already_checked_in')) {
      stayForm.value = null
      await load()
    }
    return
  } finally {
    savingStay.value = false
  }
  // The stay is open. Close the form first, and keep what comes next out of the error
  // handling above: a failure after the write must not be reported as a failed check-in.
  stayForm.value = null
  notify.success('stays.newStay.saved')
  await load()
  if (route.query.checkIn) {
    try {
      await router.replace({ name: 'person', params: { id: personId.value } })
    } catch {
      // The flag only opens this form from the duplicate panel. The stay is already shown.
    }
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="common.personRecord" />
    <div v-if="notFound" class="alert alert-warning" role="alert">{{ t('person.notFound') }}</div>
    <p v-else-if="!person" class="text-body-secondary">{{ t('common.loading') }}</p>
    <template v-else>
      <div v-if="merged" class="alert alert-info" role="status" data-testid="merged-alert">
        {{ t('person.merged') }}
        <RouterLink :to="{ name: 'person', params: { id: person.merged_into_id ?? '' } }">{{
          t('person.mergedLink')
        }}</RouterLink>
      </div>
      <div class="row g-4">
        <div class="col-lg-4">
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h4" data-testid="person-name">{{ name }}</h2>
              <p class="mb-0" data-testid="stay-status">
                <span v-if="openStay" class="badge text-bg-success">{{
                  t('person.status.staying', { date: formatDate(openStay.entry_date) })
                }}</span>
                <span v-else class="badge text-bg-secondary">{{ t('person.status.notStaying') }}</span>
              </p>
            </div>
          </section>
        </div>
        <div class="col-lg-8">
          <section class="card mb-4">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">{{ t('person.detailsTitle') }}</h2>
                <button
                  v-if="!personForm && !merged"
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  @click="startEdit"
                >
                  {{ t('person.edit') }}
                </button>
              </div>
              <form v-if="personForm" class="person-edit-form" novalidate @submit.prevent="savePerson">
                <PersonForm
                  v-model="personForm"
                  :errors="personErrors"
                  :person-id="person.id"
                  :carer-label="carerName"
                />
                <div class="d-flex gap-2 mt-3">
                  <button type="submit" class="btn btn-primary" :disabled="savingPerson">
                    {{ t('person.save') }}
                  </button>
                  <button type="button" class="btn btn-outline-secondary" @click="personForm = null">
                    {{ t('common.cancel') }}
                  </button>
                </div>
              </form>
              <PersonDetails v-else :person="person" :carer="carer" />
            </div>
          </section>

          <section v-if="!merged && !openStay" class="card mb-4">
            <div class="card-body">
              <button v-if="!stayForm" type="button" class="btn btn-primary" @click="startCheckIn">
                {{ t('stays.newStay.action') }}
              </button>
              <form v-else class="new-stay-form" novalidate @submit.prevent="saveCheckIn">
                <h2 class="h5">{{ t('stays.newStay.title') }}</h2>
                <StayForm v-model="stayForm" :errors="stayErrors" id-prefix="new-stay" />
                <div
                  v-if="overlapHint"
                  class="alert alert-warning mt-3 mb-0"
                  role="alert"
                  data-testid="overlap-hint"
                >
                  {{ t('stays.newStay.overlapHint') }}
                </div>
                <div class="d-flex gap-2 mt-3">
                  <button type="submit" class="btn btn-primary" :disabled="savingStay">
                    {{ t('stays.newStay.save') }}
                  </button>
                  <button type="button" class="btn btn-outline-secondary" @click="cancelCheckIn">
                    {{ t('common.cancel') }}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section v-if="openStay" class="card mb-4">
            <div class="card-body">
              <h2 class="h5">{{ t('outings.list.title') }}</h2>
              <OutingList :outings="outings" />
            </div>
          </section>

          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5">{{ t('stays.history.title') }}</h2>
              <StayHistory :stays="stays" />
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
