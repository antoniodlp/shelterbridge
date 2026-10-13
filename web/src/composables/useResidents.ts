import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listCurrentResidents } from '@/api/stays'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { useThumbnails } from '@/composables/useThumbnails'
import { formatAge, fullName, normalizeForSearch } from '@/lib/people'
import type { CurrentResident, PhoneStatus, Presence } from '@/types/domain'

export interface HeadcountSummary {
  total: number
  inside: number
  outside: number
  minors: number
  unaccompanied: number
}

/** One grid row. Everything a cell shows is precomputed here. */
export interface ResidentRow {
  stay_id: string
  person_id: string
  first_name: string
  last_name: string
  full_name: string
  photo_path: string | null
  thumb_url: string | null
  age: number | null
  age_label: string
  /** The carer's name when the carer is staying too, otherwise empty. */
  carer_name: string
  bed: string
  entry_date: string
  entry_date_label: string
  days_in_shelter: number
  presence: Presence
  presence_label: string
  out_since: string | null
  out_since_label: string
  outings_today: number
  phone_status: PhoneStatus
  phone_status_label: string
  /** The stay's `updated_at` when the list was loaded, for the in-cell edits' concurrency check. */
  stay_updated_at: string
  is_minor: boolean
  is_unaccompanied_minor: boolean
  busy: boolean
}

export function countResidents(residents: CurrentResident[]): HeadcountSummary {
  return {
    total: residents.length,
    inside: residents.filter((r) => r.presence !== 'outside').length,
    outside: residents.filter((r) => r.presence === 'outside').length,
    minors: residents.filter((r) => r.is_minor === true).length,
    unaccompanied: residents.filter((r) => r.is_unaccompanied_minor === true).length,
  }
}

export function matchesQuery(row: Pick<ResidentRow, 'full_name'>, query: string): boolean {
  const needle = normalizeForSearch(query)
  if (!needle) return true
  return normalizeForSearch(row.full_name).includes(needle)
}

export function useResidents() {
  const { t } = useI18n()
  const notify = useNotify()
  const time = useShelterTime()
  const thumbs = useThumbnails()

  const residents = ref<CurrentResident[]>([])
  const loading = ref(false)
  const query = ref('')
  const busyStayId = ref<string | null>(null)

  const counts = computed(() => countResidents(residents.value))

  /** `byPerson` maps person ids to the residents, so a carer who is staying is found without another request. */
  function toRow(resident: CurrentResident, byPerson: Map<string | null, CurrentResident>): ResidentRow {
    const presence: Presence = resident.presence === 'outside' ? 'outside' : 'inside'
    const phoneStatus = (resident.phone_status ?? 'none') as PhoneStatus
    const carer = resident.carer_id ? byPerson.get(resident.carer_id) : undefined
    return {
      stay_id: resident.stay_id ?? '',
      person_id: resident.person_id ?? '',
      first_name: resident.first_name ?? '',
      last_name: resident.last_name ?? '',
      full_name: fullName(resident.first_name, resident.last_name),
      photo_path: resident.photo_path,
      thumb_url: thumbs.thumbUrl(resident.photo_path),
      age: resident.age,
      age_label: formatAge(resident.age),
      carer_name: carer ? fullName(carer.first_name, carer.last_name) : '',
      bed: resident.bed ?? '',
      entry_date: resident.entry_date ?? '',
      entry_date_label: time.formatDate(resident.entry_date),
      days_in_shelter: resident.days_in_shelter ?? 0,
      presence,
      presence_label: t(`presence.${presence}`),
      out_since: resident.out_since,
      out_since_label: resident.out_since ? time.formatDateTime(resident.out_since) : '',
      outings_today: resident.outings_today ?? 0,
      phone_status: phoneStatus,
      phone_status_label: t(`phoneStatus.${phoneStatus}`),
      stay_updated_at: resident.stay_updated_at ?? '',
      is_minor: resident.is_minor === true,
      is_unaccompanied_minor: resident.is_unaccompanied_minor === true,
      // One row action runs at a time, so every row's buttons wait for it.
      busy: busyStayId.value !== null,
    }
  }

  const allRows = computed(() => {
    const byPerson = new Map(residents.value.map((resident) => [resident.person_id, resident]))
    return residents.value.map((resident) => toRow(resident, byPerson))
  })
  const rows = computed(() => allRows.value.filter((row) => matchesQuery(row, query.value)))

  function findRow(stayId: string): ResidentRow | undefined {
    return allRows.value.find((row) => row.stay_id === stayId)
  }

  async function reload(): Promise<void> {
    loading.value = true
    try {
      residents.value = await listCurrentResidents()
      // Thumbnails are optional and fill in when signed: a slow Storage must not hold the row lock.
      // load() swallows its own failures.
      void thumbs.load(residents.value.map((resident) => resident.photo_path))
    } catch (error) {
      notify.error(error)
    } finally {
      loading.value = false
    }
  }

  return { rows, counts, loading, query, busyStayId, findRow, reload }
}
