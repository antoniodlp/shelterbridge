<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { isApiError } from '@/api/errors'
import { getPerson, mergePeople } from '@/api/people'
import { listStaysForPerson } from '@/api/stays'
import MergePersonPicker from '@/components/admin/MergePersonPicker.vue'
import MergeSideCard from '@/components/admin/MergeSideCard.vue'
import { findOverlaps, type StayOverlap, stayRangeLabel } from '@/components/admin/mergeOverlaps'
import PageHeader from '@/components/common/PageHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { fullName } from '@/lib/people'
import type { Person, Stay } from '@/types/domain'

type Position = 'first' | 'second'
interface MergeSide {
  person: Person
  stays: Stay[]
}

const POSITIONS: Position[] = ['first', 'second']

const { t } = useI18n()
const router = useRouter()
const notify = useNotify()
const { confirm } = useConfirm()
const { formatDate } = useShelterTime()

const sides = ref<Record<Position, MergeSide | null>>({ first: null, second: null })
const survivor = ref<Position | null>(null)
const overlaps = ref<StayOverlap[]>([])
const merging = ref(false)

const columns = computed(() => POSITIONS.map((position) => ({ position, side: sides.value[position] })))
const samePerson = computed(
  () => !!sides.value.first && !!sides.value.second && sides.value.first.person.id === sides.value.second.person.id,
)
const canMerge = computed(
  () => !!sides.value.first && !!sides.value.second && survivor.value !== null && !samePerson.value && !merging.value,
)

function reset(): void {
  survivor.value = null
  overlaps.value = []
}

async function pick(position: Position, personId: string): Promise<void> {
  try {
    const [person, stays] = await Promise.all([getPerson(personId), listStaysForPerson(personId)])
    sides.value = { ...sides.value, [position]: { person, stays } }
    reset()
  } catch (error) {
    notify.error(error)
  }
}

function clear(position: Position): void {
  // While a merge is running, the pair on screen is the pair being merged.
  if (merging.value) return
  sides.value = { ...sides.value, [position]: null }
  reset()
}

async function merge(): Promise<void> {
  const keep = survivor.value
  if (!keep || !canMerge.value) return
  const kept = sides.value[keep]
  const other = sides.value[keep === 'first' ? 'second' : 'first']
  if (!kept || !other) return
  const survivorId = kept.person.id
  // Taken before the question is asked, so a second click while it is open sends nothing.
  merging.value = true
  try {
    const approved = await confirm({
      titleKey: 'admin.merge.confirmTitle',
      messageKey: 'admin.merge.confirmMessage',
      messageParams: {
        survivor: fullName(kept.person.first_name, kept.person.last_name),
        duplicate: fullName(other.person.first_name, other.person.last_name),
      },
      confirmKey: 'admin.merge.confirm',
      danger: true,
    })
    if (!approved) {
      merging.value = false
      return
    }
    await mergePeople(survivorId, other.person.id)
  } catch (error) {
    merging.value = false
    notify.error(error)
    if (isApiError(error, 'overlapping_stays')) overlaps.value = findOverlaps(kept.stays, other.stays)
    return
  }
  // The merge is saved. Start over before anything else can fail, so the merged pair is never
  // left on screen ready to be sent again.
  sides.value = { first: null, second: null }
  reset()
  merging.value = false
  notify.success('admin.merge.done')
  try {
    await router.push({ name: 'person', params: { id: survivorId } })
  } catch (error) {
    // Reported on its own: the merge itself worked.
    notify.error(error)
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.merge" />
    <p class="text-body-secondary">{{ t('admin.merge.intro') }}</p>
    <div class="row g-4">
      <div v-for="column in columns" :key="column.position" class="col-lg-6">
        <h2 class="h5">{{ t(`admin.merge.${column.position}`) }}</h2>
        <MergeSideCard
          v-if="column.side"
          :position="column.position"
          :person="column.side.person"
          :stays="column.side.stays"
          :selected="survivor === column.position"
          @keep="survivor = column.position"
          @change="clear(column.position)"
        />
        <MergePersonPicker v-else :position="column.position" @select="pick(column.position, $event)" />
      </div>
    </div>

    <p v-if="samePerson" class="text-danger mt-3" role="alert">{{ t('admin.merge.samePerson') }}</p>

    <div v-if="overlaps.length > 0" class="alert alert-warning mt-3" role="alert">
      <h3 class="h6">{{ t('admin.merge.overlapTitle') }}</h3>
      <p>{{ t('admin.merge.overlapIntro') }}</p>
      <ul class="mb-0">
        <li v-for="overlap in overlaps" :key="`${overlap.kept.id}-${overlap.other.id}`" data-testid="merge-overlap">
          {{
            t('admin.merge.overlapRow', {
              first: stayRangeLabel(overlap.kept, formatDate, t),
              second: stayRangeLabel(overlap.other, formatDate, t),
            })
          }}
          <RouterLink class="ms-2" :to="{ name: 'person', params: { id: overlap.other.person_id } }">{{
            t('admin.merge.openRecord')
          }}</RouterLink>
        </li>
      </ul>
    </div>

    <button type="button" class="btn btn-danger mt-4" :disabled="!canMerge" @click="merge">
      {{ t('admin.merge.submit') }}
    </button>
  </div>
</template>
