<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiError } from '@/api/errors'
import { endOuting, startOuting } from '@/api/outings'
import { checkOut, updateStay } from '@/api/stays'
import PageHeader from '@/components/common/PageHeader.vue'
import OutingStartDialog from '@/components/outings/OutingStartDialog.vue'
import HeadcountBar from '@/components/residents/HeadcountBar.vue'
import ResidentsGrid from '@/components/residents/ResidentsGrid.vue'
import CheckOutDialog from '@/components/stays/CheckOutDialog.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { type ResidentRow, useResidents } from '@/composables/useResidents'
import type { PhoneStatus } from '@/types/domain'

const { t } = useI18n()
const notify = useNotify()
const { confirm } = useConfirm()
const { rows, counts, loading, query, busyStayId, findRow, reload } = useResidents()

const outingTarget = ref<{ row: ResidentRow; exceptionConfirmed: boolean } | null>(null)
const checkOutTarget = ref<ResidentRow | null>(null)

onMounted(reload)

/**
 * Runs one row action at a time and always reloads afterwards, so a row that
 * another computer changed shows its real state after the error. The lock is
 * held until that reload has finished, because until then the rows still show
 * the old state and a second click would repeat the action. If the reload
 * fails, the lock is released anyway (the error is reported) and the rows stay
 * as they were. Thumbnail signing is not part of the reload and never holds
 * the lock.
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

// A person who already went out today needs the exception confirmed before the
// comment dialog opens. Declining leaves everything as it was.
async function openOuting(stayId: string): Promise<void> {
  const row = findRow(stayId)
  if (!row) return
  const exceptionConfirmed = row.outings_today >= 1
  if (exceptionConfirmed && !(await askForException())) return
  outingTarget.value = { row, exceptionConfirmed }
}

async function confirmOuting(comment: string | null): Promise<void> {
  const target = outingTarget.value
  outingTarget.value = null
  if (!target) return
  const { row, exceptionConfirmed } = target
  await runRowAction(row, async () => {
    // A list that is out of date can still hit the server's once-a-day rule,
    // so that answer is handled too.
    try {
      await startOuting(row.stay_id, comment, exceptionConfirmed)
    } catch (error) {
      if (exceptionConfirmed || !isApiError(error, 'outing_exception_needs_confirmation')) throw error
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

function openCheckOut(stayId: string): void {
  checkOutTarget.value = findRow(stayId) ?? null
}

async function confirmCheckOut(exitDate: string): Promise<void> {
  const row = checkOutTarget.value
  checkOutTarget.value = null
  if (!row) return
  await runRowAction(row, async () => {
    await checkOut(row.stay_id, exitDate)
    notify.success('stays.checkOut.done', { name: row.full_name })
  })
}

// In-cell edits save against the stay's updated_at from the last load, so a stay
// that someone else changed meanwhile fails with stale_record and the reload
// shows their value.
async function saveBed(stayId: string, bed: string): Promise<void> {
  const row = findRow(stayId)
  if (!row) return
  await runRowAction(row, async () => {
    await updateStay(row.stay_id, row.stay_updated_at, { bed })
    notify.success('residents.inline.bedSaved', { name: row.full_name })
  })
}

async function savePhoneStatus(stayId: string, status: PhoneStatus): Promise<void> {
  const row = findRow(stayId)
  if (!row) return
  await runRowAction(row, async () => {
    await updateStay(row.stay_id, row.stay_updated_at, { phone_status: status })
    notify.success('residents.inline.phoneSaved', { name: row.full_name })
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
    <div class="mb-3 residents-search form-inline">
        <div class="input-group">
          <div class="input-group-text">🔍</div>
          <input
            id="residents-search"
            v-model="query"
            type="search"
            class="form-control"
            :placeholder="t('residents.search.placeholder')"
            autocomplete="off"
          />
        </div>
    </div>
    
    <ResidentsGrid
      :rows="rows"
      @start-outing="openOuting"
      @end-outing="recordReturn"
      @check-out="openCheckOut"
      @change-bed="saveBed"
      @change-phone-status="savePhoneStatus"
    />
    <OutingStartDialog
      :name="outingTarget?.row.full_name ?? null"
      @confirm="confirmOuting"
      @cancel="outingTarget = null"
    />
    <CheckOutDialog :resident="checkOutTarget" @confirm="confirmCheckOut" @cancel="checkOutTarget = null" />
  </div>
</template>

<style scoped>
.residents-search {
  max-width: 24rem;
}
</style>
