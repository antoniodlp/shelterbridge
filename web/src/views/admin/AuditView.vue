<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AuditFilters, listAuditLog } from '@/api/audit'
import { listAppUsers } from '@/api/users'
import { changedFields } from '@/components/admin/auditChanges'
import PageHeader from '@/components/common/PageHeader.vue'
import DateField from '@/components/forms/DateField.vue'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { addDays, startOfDayInstant } from '@/lib/dates'
import { useSettingsStore } from '@/stores/settings'
import type { AppUser, AuditEntry } from '@/types/domain'

const PAGE_SIZE = 50
const TABLES = ['people', 'stays', 'outings', 'countries', 'case_types', 'genders', 'settings', 'app_users']

const { t } = useI18n()
const notify = useNotify()
const { formatDateTime } = useShelterTime()
const settings = useSettingsStore()

const filters = ref({
  table_name: '',
  record_id: '',
  actor_user_id: '',
  from: null as string | null,
  to: null as string | null,
})
const applied = ref<AuditFilters>({})
const page = ref(0)
// shallowRef: audit rows hold deep JSON that Vue does not need to track.
const rows = shallowRef<AuditEntry[]>([])
const total = ref(0)
const loading = ref(false)
const users = ref<AppUser[]>([])

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const knownUsers = computed(() => users.value.filter((user) => user.user_id))
const userNames = computed(() => new Map(knownUsers.value.map((user) => [user.user_id as string, user.display_name])))

function buildFilters(): AuditFilters {
  const current = filters.value
  const result: AuditFilters = {}
  if (current.table_name) result.table_name = current.table_name
  if (current.record_id.trim()) result.record_id = current.record_id.trim()
  if (current.actor_user_id) result.actor_user_id = current.actor_user_id
  // Dates are shelter days: from local midnight up to the next local midnight.
  if (current.from) result.from = startOfDayInstant(current.from, settings.timezone)
  if (current.to) result.to = startOfDayInstant(addDays(current.to, 1), settings.timezone)
  return result
}

async function fetchPage(): Promise<void> {
  loading.value = true
  try {
    const result = await listAuditLog({ ...applied.value, limit: PAGE_SIZE, offset: page.value * PAGE_SIZE })
    rows.value = result.rows
    total.value = result.total
  } catch (error) {
    notify.error(error)
  } finally {
    loading.value = false
  }
}

async function apply(): Promise<void> {
  applied.value = buildFilters()
  page.value = 0
  await fetchPage()
}

async function goTo(target: number): Promise<void> {
  page.value = target
  await fetchPage()
}

function userLabel(entry: AuditEntry): string {
  return (entry.actor_user_id && userNames.value.get(entry.actor_user_id)) || t('admin.audit.unknownUser')
}

onMounted(async () => {
  try {
    users.value = await listAppUsers()
  } catch {
    // Names are a convenience; the log still shows roles and operators.
    users.value = []
  }
  await apply()
})
</script>

<template>
  <div>
    <PageHeader title-key="nav.audit" />
    <form class="audit-filters row g-3 align-items-end mb-4" @submit.prevent="apply">
      <div class="col-md-2">
        <label for="audit-table" class="form-label">{{ t('admin.audit.filters.table') }}</label>
        <select id="audit-table" v-model="filters.table_name" class="form-select">
          <option value="">{{ t('admin.audit.filters.allTables') }}</option>
          <option v-for="table in TABLES" :key="table" :value="table">{{ t(`admin.audit.tables.${table}`) }}</option>
        </select>
      </div>
      <div class="col-md-3">
        <label for="audit-record" class="form-label">{{ t('admin.audit.filters.record') }}</label>
        <input id="audit-record" v-model="filters.record_id" type="text" class="form-control" autocomplete="off" />
      </div>
      <div class="col-md-2">
        <label for="audit-user" class="form-label">{{ t('admin.audit.filters.user') }}</label>
        <select id="audit-user" v-model="filters.actor_user_id" class="form-select">
          <option value="">{{ t('admin.audit.filters.allUsers') }}</option>
          <option v-for="user in knownUsers" :key="user.email" :value="user.user_id">
            {{ user.display_name }}
          </option>
        </select>
      </div>
      <div class="col-md-2">
        <label for="audit-from" class="form-label">{{ t('admin.audit.filters.from') }}</label>
        <DateField id="audit-from" v-model="filters.from" />
      </div>
      <div class="col-md-2">
        <label for="audit-to" class="form-label">{{ t('admin.audit.filters.to') }}</label>
        <DateField id="audit-to" v-model="filters.to" :min="filters.from" />
      </div>
      <div class="col-md-1">
        <button type="submit" class="btn btn-primary w-100" :disabled="loading">
          {{ t('admin.audit.filters.apply') }}
        </button>
      </div>
    </form>

    <p v-if="rows.length === 0 && !loading" class="text-body-secondary">{{ t('admin.audit.empty') }}</p>
    <div v-else class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th scope="col">{{ t('admin.audit.columns.at') }}</th>
            <th scope="col">{{ t('admin.audit.columns.user') }}</th>
            <th scope="col">{{ t('admin.audit.columns.operator') }}</th>
            <th scope="col">{{ t('admin.audit.columns.table') }}</th>
            <th scope="col">{{ t('admin.audit.columns.action') }}</th>
            <th scope="col">{{ t('admin.audit.columns.changes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in rows" :key="entry.id" data-testid="audit-row">
            <td class="text-nowrap">{{ formatDateTime(entry.at) }}</td>
            <td>
              {{ userLabel(entry) }}
              <div v-if="entry.actor_role" class="small text-body-secondary">
                {{ t(`admin.users.roles.${entry.actor_role}`) }}
              </div>
            </td>
            <td>{{ entry.operator_name }}</td>
            <td>
              {{ t(`admin.audit.tables.${entry.table_name}`) }}
              <div class="small text-body-secondary text-break"><code>{{ entry.record_id }}</code></div>
            </td>
            <td>{{ t(`admin.audit.actions.${entry.action}`) }}</td>
            <td>
              <span class="small">{{ changedFields(entry).join(', ') }}</span>
              <details class="small">
                <summary>{{ t('admin.audit.showChanges') }}</summary>
                <template v-if="entry.old_data !== null">
                  <div class="fw-semibold">{{ t('admin.audit.before') }}</div>
                  <pre class="audit-json mb-2">{{ JSON.stringify(entry.old_data, null, 2) }}</pre>
                </template>
                <template v-if="entry.new_data !== null">
                  <div class="fw-semibold">{{ t('admin.audit.after') }}</div>
                  <pre class="audit-json mb-0">{{ JSON.stringify(entry.new_data, null, 2) }}</pre>
                </template>
              </details>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav class="d-flex align-items-center gap-3" :aria-label="t('admin.audit.pager')">
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm"
        :disabled="page === 0 || loading"
        @click="goTo(page - 1)"
      >
        {{ t('admin.audit.previous') }}
      </button>
      <span data-testid="audit-page">{{ t('admin.audit.page', { page: page + 1, pages }) }}</span>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm"
        :disabled="page + 1 >= pages || loading"
        @click="goTo(page + 1)"
      >
        {{ t('admin.audit.next') }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.audit-json {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
