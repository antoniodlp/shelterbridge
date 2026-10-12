<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type PersonSearchResult, searchPeople } from '@/api/people'
import PageHeader from '@/components/common/PageHeader.vue'
import PersonThumb from '@/components/people/PersonThumb.vue'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { useThumbnails } from '@/composables/useThumbnails'
import { formatAge, fullName, normalizeForSearch } from '@/lib/people'
import { ageOn } from '@/lib/shelterTime'
import { useCatalogsStore } from '@/stores/catalogs'

const { t } = useI18n()
const notify = useNotify()
const { formatDate, today } = useShelterTime()
const catalogs = useCatalogsStore()
const thumbs = useThumbnails()

// The search text stays in this component. Names never go into the URL.
const query = ref('')
const results = ref<PersonSearchResult[] | null>(null)
const searching = ref(false)
const tooShort = ref(false)

async function search(): Promise<void> {
  tooShort.value = normalizeForSearch(query.value).length < 2
  if (tooShort.value) {
    results.value = null
    return
  }
  if (searching.value) return
  searching.value = true
  try {
    results.value = await searchPeople(query.value.trim())
    await thumbs.load(results.value.map((row) => row.photo_path))
  } catch (error) {
    notify.error(error)
  } finally {
    searching.value = false
  }
}

function ageLabel(row: PersonSearchResult): string {
  return formatAge(ageOn(row.birth_date, today()))
}

function lastStay(row: PersonSearchResult): string {
  if (!row.last_entry_date) return t('search.noStays')
  return t('search.lastStay', {
    from: formatDate(row.last_entry_date),
    to: formatDate(row.last_exit_date),
  })
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.search">
      <template #actions>
        <RouterLink class="btn btn-outline-primary" :to="{ name: 'person-new' }">{{ t('nav.newPerson') }}</RouterLink>
      </template>
    </PageHeader>
    <form class="people-search-form mb-4" role="search" @submit.prevent="search">
      <label for="people-search-query" class="form-label">{{ t('search.label') }}</label>
      <div class="input-group search-box">
        <input
          id="people-search-query"
          v-model="query"
          type="search"
          class="form-control"
          :placeholder="t('search.placeholder')"
          autocomplete="off"
        />
        <button type="submit" class="btn btn-primary" :disabled="searching">{{ t('search.submit') }}</button>
      </div>
      <p v-if="tooShort" class="form-text text-danger">{{ t('search.tooShort') }}</p>
    </form>

    <p v-if="results && results.length === 0" class="text-body-secondary">{{ t('search.noResults') }}</p>
    <div v-else-if="results" class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th scope="col"><span class="visually-hidden">{{ t('search.columns.photo') }}</span></th>
            <th scope="col">{{ t('search.columns.name') }}</th>
            <th scope="col">{{ t('search.columns.age') }}</th>
            <th scope="col">{{ t('search.columns.country') }}</th>
            <th scope="col">{{ t('search.columns.lastStay') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in results" :key="row.person_id" data-testid="search-result">
            <td>
              <PersonThumb :url="thumbs.thumbUrl(row.photo_path)" :name="fullName(row.first_name, row.last_name)" />
            </td>
            <td>
              <RouterLink :to="{ name: 'person', params: { id: row.person_id } }">{{
                fullName(row.first_name, row.last_name)
              }}</RouterLink>
            </td>
            <td>{{ ageLabel(row) }}</td>
            <td>{{ catalogs.label('countries', row.country_code) }}</td>
            <td>
              <span v-if="row.has_open_stay" class="badge text-bg-success">{{ t('search.staying') }}</span>
              <span v-else>{{ lastStay(row) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.search-box {
  max-width: 32rem;
}
</style>
