<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiError } from '@/api/errors'
import { endOuting, startOuting } from '@/api/outings'
import PageHeader from '@/components/common/PageHeader.vue'
import OutingStartDialog from '@/components/outings/OutingStartDialog.vue'
import HeadcountBar from '@/components/residents/HeadcountBar.vue'
import ResidentsGrid from '@/components/residents/ResidentsGrid.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { type ResidentRow, useResidents } from '@/composables/useResidents'

const { t } = useI18n()
const notify = useNotify()
const { confirm } = useConfirm()
const { rows, counts, loading, query, busyStayId, findRow, reload } = useResidents()

const outingTarget = ref<ResidentRow | null>(null)

onMounted(reload)

/**
 * Runs one row action at a time and always reloads afterwards, so a row that
 * another computer changed shows its real state after the error. The lock is
 * released only when the fresh list is in, because until then the rows still
 * show the old state and a second click would repeat the action.
 */
async function runRowAction(row: ResidentRow, action: () => Promise<void>): Promise<void> {
  if (busyStayId.value) return
  busyStayId.value = row.stay_id
  try {
    await action()
  } catch (error) {
    notify.error(error)
  } finally {
    try {
      await reload()
    } finally {
      busyStayId.value = null
    }
  }
}

function openOuting(stayId: string): void {
  outingTarget.value = findRow(stayId) ?? null
}

async function confirmOuting(comment: string | null): Promise<void> {
  const row = outingTarget.value
  outingTarget.value = null
  if (!row) return
  await runRowAction(row, async () => {
    // A person who already went out today needs the exception confirmed first.
    // A list that is out of date can still hit the server's rule, so that
    // answer is handled too.
    let confirmed = false
    if (row.outings_today >= 1) {
      if (!(await askForException())) return
      confirmed = true
    }
    try {
      await startOuting(row.stay_id, comment, confirmed)
    } catch (error) {
      if (confirmed || !isApiError(error, 'outing_exception_needs_confirmation')) throw error
      if (!(await askForException())) return
      await startOuting(row.stay_id, comment, true)
    }
    notify.success('outings.started', { name: row.full_name })
  })
}

function askForException(): Promise<boolean> {
  return confirm({
    titleKey: 'outings.exception.title',
    messageKey: 'errors.outing_exception_needs_confirmation',
    confirmKey: 'outings.exception.confirm',
  })
}

async function recordReturn(stayId: string): Promise<void> {
  const row = findRow(stayId)
  if (!row) return
  await runRowAction(row, async () => {
    await endOuting(row.stay_id)
    notify.success('outings.ended', { name: row.full_name })
  })
}
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
    <ResidentsGrid :rows="rows" @start-outing="openOuting" @end-outing="recordReturn" />
    <OutingStartDialog
      :name="outingTarget?.full_name ?? null"
      @confirm="confirmOuting"
      @cancel="outingTarget = null"
    />
  </div>
</template>

<style scoped>
.residents-search {
  max-width: 24rem;
}
</style>
