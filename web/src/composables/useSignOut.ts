import { useRouter } from 'vue-router'
import { useNotify } from '@/composables/useNotify'
import { useSessionStore } from '@/stores/session'

// Signs out and goes to the login page. A failed sign-out request is reported, but the
// session store already clears the local session, so the user still leaves the app.
export function useSignOut(): { signOut(): Promise<void> } {
  const router = useRouter()
  const session = useSessionStore()
  const notify = useNotify()

  async function signOut(): Promise<void> {
    try {
      await session.signOut()
    } catch (error) {
      notify.error(error)
    }
    await router.replace({ name: 'login' })
  }

  return { signOut }
}
