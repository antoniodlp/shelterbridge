import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listCurrentResidents } from '@/api/stays'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { useThumbnails } from '@/composables/useThumbnails'
import { formatAge, fullName, normalizeForSearch } from '@/lib/people'
import { useCatalogsStore } from '@/stores/catalogs'
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
  full_name: string
  photo_path: string | null
  thumb_url: string | null
  age: number | null
  age_label: string
  gender_label: string
  country_label: string
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

export function matchesQuery(row: Pick<ResidentRow, 'full_name' | 'bed'>, query: string): boolean {
  const needle = normalizeForSearch(query)
  if (!needle) return true
  return (
    normalizeForSearch(row.full_name).includes(needle) || normalizeForSearch(row.bed).includes(needle)
  )
}

export function useResidents() {
  const { t } = useI18n()
  const notify = useNotify()
  const catalogs = useCatalogsStore()
  const time = useShelterTime()
  const thumbs = useThumbnails()

  const residents = ref<CurrentResident[]>([])
  const loading = ref(false)
  const query = ref('')
  const busyStayId = ref<string | null>(null)

  const counts = computed(() => countResidents(residents.value))

  function toRow(resident: CurrentResident): ResidentRow {
    const presence: Presence = resident.presence === 'outside' ? 'outside' : 'inside'
    return {
      stay_id: resident.stay_id ?? '',
      person_id: resident.person_id ?? '',
      full_name: fullName(resident.first_name, resident.last_name),
      photo_path: resident.photo_path,
      thumb_url: thumbs.thumbUrl(resident.photo_path),
      age: resident.age,
      age_label: formatAge(resident.age, resident.birth_date_estimated),
      gender_label: catalogs.label('genders', resident.gender_code),
      country_label: catalogs.label('countries', resident.country_code),
      bed: resident.bed ?? '',
      entry_date: resident.entry_date ?? '',
      entry_date_label: time.formatDate(resident.entry_date),
      days_in_shelter: resident.days_in_shelter ?? 0,
      presence,
      presence_label: t(`presence.${presence}`),
      out_since: resident.out_since,
      out_since_label: resident.out_since ? time.formatDateTime(resident.out_since) : '',
      outings_today: resident.outings_today ?? 0,
      phone_status: (resident.phone_status ?? 'none') as PhoneStatus,
      is_minor: resident.is_minor === true,
      is_unaccompanied_minor: resident.is_unaccompanied_minor === true,
      // One row action runs at a time, so every row's buttons wait for it.
      busy: busyStayId.value !== null,
    }
  }

  const allRows = computed(() => residents.value.map(toRow))
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
