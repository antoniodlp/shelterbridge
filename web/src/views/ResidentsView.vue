<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/common/PageHeader.vue'
import HeadcountBar from '@/components/residents/HeadcountBar.vue'
import ResidentsGrid from '@/components/residents/ResidentsGrid.vue'
import { useResidents } from '@/composables/useResidents'

const { t } = useI18n()
const { rows, counts, loading, query, reload } = useResidents()

onMounted(reload)
</script>

<template>
  <div>
    <PageHeader title-key="nav.residents">
      <template #actions>
        <RouterLink class="btn btn-primary" :to="{ name: 'person-new' }">{{ t('nav.newPerson') }}</RouterLink>
        <button type="button" class="btn btn-outline-secondary" :disabled="loading" @click="reload">
          {{ t('residents.refresh') }}
        </button>
      </template>
    </PageHeader>
    <HeadcountBar :summary="counts" class="mb-3" />
    <div class="mb-3 residents-search">
      <label for="residents-search" class="form-label">{{ t('residents.search.label') }}</label>
      <input
        id="residents-search"
        v-model="query"
        type="search"
        class="form-control"
        :placeholder="t('residents.search.placeholder')"
        autocomplete="off"
      />
    </div>
    <ResidentsGrid :rows="rows" />
  </div>
</template>

<style scoped>
.residents-search {
  max-width: 24rem;
}
</style>
