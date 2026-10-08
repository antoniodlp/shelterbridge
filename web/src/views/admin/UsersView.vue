<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { inviteUser, listAppUsers, updateAppUser } from '@/api/users'
import PageHeader from '@/components/common/PageHeader.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { cleanText } from '@/lib/text'
import { useSessionStore } from '@/stores/session'
import type { AppRole, AppUser } from '@/types/domain'

const ROLES: AppRole[] = ['volunteer', 'legal', 'psychology', 'admin']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const { t } = useI18n()
const notify = useNotify()
const { confirm } = useConfirm()
const session = useSessionStore()

const users = ref<AppUser[]>([])
const busyEmail = ref<string | null>(null)
const invite = ref<{ email: string; display_name: string; role: AppRole }>({
  email: '',
  display_name: '',
  role: 'volunteer',
})
const inviteErrors = ref<FieldErrors>({})
const inviting = ref(false)
// Admins cannot change or deactivate their own account, so nobody locks themselves out.
const myEmail = computed(() => session.appUser?.email ?? null)

// Reports its own failure, so a failed reload is never taken for a failed save.
async function load(): Promise<void> {
  try {
    users.value = await listAppUsers()
  } catch (error) {
    notify.error(error)
  }
}

onMounted(load)

async function submitInvite(): Promise<void> {
  if (inviting.value) return
  const errors: FieldErrors = {}
  if (!EMAIL.test(invite.value.email.trim())) errors.email = 'validation.email'
  if (!cleanText(invite.value.display_name)) errors.display_name = 'validation.required'
  inviteErrors.value = errors
  if (hasErrors(errors)) return
  inviting.value = true
  try {
    await inviteUser({ ...invite.value })
  } catch (error) {
    notify.error(error)
    inviting.value = false
    return
  }
  // The invitation is saved: empty the form first, so nothing after this can leave it ready to be sent again.
  invite.value = { email: '', display_name: '', role: 'volunteer' }
  notify.success('admin.users.invite.done')
  try {
    await load()
  } finally {
    inviting.value = false
  }
}

// The list is reloaded whether or not the change was saved. That also puts a select that was
// moved back to the stored role, because clearing busyEmail re-renders the row.
async function update(user: AppUser, patch: Partial<Pick<AppUser, 'role' | 'active'>>): Promise<void> {
  busyEmail.value = user.email
  try {
    const row = await updateAppUser(user.email, user.updated_at, patch)
    // Show the saved row now, so a failed reload does not leave the old role and version on screen.
    users.value = users.value.map((candidate) => (candidate.email === row.email ? row : candidate))
    notify.success('admin.users.updated')
  } catch (error) {
    notify.error(error)
  } finally {
    busyEmail.value = null
    await load()
  }
}

async function onRoleChange(user: AppUser, event: Event): Promise<void> {
  const role = (event.target as HTMLSelectElement).value as AppRole
  if (role !== user.role) await update(user, { role })
}

async function toggleActive(user: AppUser): Promise<void> {
  if (user.active) {
    const approved = await confirm({
      titleKey: 'admin.users.deactivateTitle',
      messageKey: 'admin.users.deactivateMessage',
      messageParams: { name: user.display_name },
      confirmKey: 'admin.users.deactivate',
      danger: true,
    })
    if (!approved) return
  }
  await update(user, { active: !user.active })
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.users" />
    <p class="text-body-secondary">{{ t('admin.users.intro') }}</p>

    <section class="card mb-4">
      <div class="card-body">
        <h2 class="h5 card-title">{{ t('admin.users.invite.title') }}</h2>
        <form class="invite-form row g-3 align-items-start" novalidate @submit.prevent="submitInvite">
          <div class="col-md-4">
            <label for="invite-email" class="form-label">{{ t('admin.users.invite.email') }}</label>
            <input
              id="invite-email"
              v-model="invite.email"
              type="email"
              class="form-control"
              :class="{ 'is-invalid': inviteErrors.email }"
              autocomplete="off"
            />
            <div v-if="inviteErrors.email" class="invalid-feedback">{{ t(inviteErrors.email) }}</div>
          </div>
          <div class="col-md-4">
            <label for="invite-name" class="form-label">{{ t('admin.users.invite.displayName') }}</label>
            <input
              id="invite-name"
              v-model="invite.display_name"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': inviteErrors.display_name }"
              autocomplete="off"
            />
            <div v-if="inviteErrors.display_name" class="invalid-feedback">{{ t(inviteErrors.display_name) }}</div>
          </div>
          <div class="col-md-2">
            <label for="invite-role" class="form-label">{{ t('admin.users.invite.role') }}</label>
            <select id="invite-role" v-model="invite.role" class="form-select">
              <option v-for="role in ROLES" :key="role" :value="role">{{ t(`admin.users.roles.${role}`) }}</option>
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <button type="submit" class="btn btn-primary w-100 mt-md-4" :disabled="inviting">
              {{ t('admin.users.invite.submit') }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <div class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th scope="col">{{ t('admin.users.columns.name') }}</th>
            <th scope="col">{{ t('admin.users.columns.email') }}</th>
            <th scope="col">{{ t('admin.users.columns.role') }}</th>
            <th scope="col">{{ t('admin.users.columns.status') }}</th>
            <th scope="col">{{ t('admin.users.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.email" data-testid="user-row">
            <td>
              {{ user.display_name }}
              <span v-if="user.email === myEmail" class="badge text-bg-info ms-1">{{ t('admin.users.self') }}</span>
            </td>
            <td class="text-break">{{ user.email }}</td>
            <td>
              <select
                class="form-select form-select-sm role-select"
                :value="user.role"
                :aria-label="t('admin.users.columns.role')"
                :disabled="user.email === myEmail || busyEmail === user.email"
                @change="onRoleChange(user, $event)"
              >
                <option v-for="role in ROLES" :key="role" :value="role">{{ t(`admin.users.roles.${role}`) }}</option>
              </select>
            </td>
            <td>
              <span class="badge" :class="user.active ? 'text-bg-success' : 'text-bg-secondary'">{{
                user.active ? t('admin.users.active') : t('admin.users.inactive')
              }}</span>
              <span v-if="!user.user_id" class="badge text-bg-light ms-1">{{ t('admin.users.pending') }}</span>
            </td>
            <td>
              <button
                type="button"
                class="btn btn-sm"
                :class="user.active ? 'btn-outline-danger' : 'btn-outline-success'"
                :disabled="user.email === myEmail || busyEmail === user.email"
                @click="toggleActive(user)"
              >
                {{ user.active ? t('admin.users.deactivate') : t('admin.users.activate') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
