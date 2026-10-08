<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type PersonSearchResult, searchPeople } from '@/api/people'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { fullName, normalizeForSearch } from '@/lib/people'

defineProps<{ position: 'first' | 'second' }>()
const emit = defineEmits<{ select: [personId: string] }>()

const { t } = useI18n()
const notify = useNotify()
const { formatDate } = useShelterTime()
const query = ref('')
const results = ref<PersonSearchResult[] | null>(null)
const searching = ref(false)

async function search(): Promise<void> {
  if (normalizeForSearch(query.value).length < 2 || searching.value) return
  searching.value = true
  try {
    results.value = await searchPeople(query.value.trim(), 20)
  } catch (error) {
    notify.error(error)
  } finally {
    searching.value = false
  }
}
</script>

<template>
  <div class="card">
    <div class="card-body">
      <form :class="`merge-${position}-search-form`" role="search" @submit.prevent="search">
        <label :for="`merge-${position}-search`" class="form-label">{{ t('admin.merge.search') }}</label>
        <div class="input-group">
          <input
            :id="`merge-${position}-search`"
            v-model="query"
            type="search"
            class="form-control"
            autocomplete="off"
          />
          <button type="submit" class="btn btn-outline-primary" :disabled="searching">
            {{ t('admin.merge.searchSubmit') }}
          </button>
        </div>
      </form>
      <p v-if="results && results.length === 0" class="text-body-secondary mt-3 mb-0">{{ t('admin.merge.noResults') }}</p>
      <div v-else-if="results" class="list-group mt-3">
        <button
          v-for="result in results"
          :key="result.person_id"
          type="button"
          class="list-group-item list-group-item-action"
          :data-testid="`merge-${position}-result-${result.person_id}`"
          @click="emit('select', result.person_id)"
        >
          <span class="fw-semibold">{{ fullName(result.first_name, result.last_name) }}</span>
          <span v-if="result.birth_date" class="small text-body-secondary ms-2">{{
            formatDate(result.birth_date)
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
