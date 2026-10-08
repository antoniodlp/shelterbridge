import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { getSettings, updateTimezone } from '@/api/settings'
import { useSettingsStore } from '@/stores/settings'
import SettingsView from '@/views/admin/SettingsView.vue'
import { mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/settings', () => ({ getSettings: vi.fn(), updateTimezone: vi.fn() }))

const SERVER_VERSION = '2026-10-07T15:00:00+00:00'

async function mountView() {
  const { wrapper } = await mountWithApp(SettingsView, { initialRoute: '/admin/settings', session: { role: 'admin' } })
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountView>>

function timezoneSelect(wrapper: Wrapper): HTMLSelectElement {
  return wrapper.find('#settings-timezone').element as HTMLSelectElement
}

function saveDisabled(wrapper: Wrapper): boolean {
  return wrapper.find('form.settings-form button[type="submit"]').attributes('disabled') !== undefined
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSettings).mockResolvedValue({
    timezone: 'America/Tijuana',
    timezone_updated_at: SERVER_VERSION,
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SettingsView', () => {
  it('shows the current timezone', async () => {
    const wrapper = await mountView()
    expect(timezoneSelect(wrapper).value).toBe('America/Mexico_City')
  })

  it('saves a new timezone with the version that was loaded and reloads the settings', async () => {
    vi.mocked(updateTimezone).mockResolvedValue()
    const wrapper = await mountView()
    const loadedVersion = useSettingsStore().timezoneUpdatedAt
    await wrapper.find('#settings-timezone').setValue('America/Tijuana')
    await wrapper.find('form.settings-form').trigger('submit')
    await vi.waitFor(() => expect(updateTimezone).toHaveBeenCalledWith('America/Tijuana', loadedVersion))
    await vi.waitFor(() => expect(getSettings).toHaveBeenCalled())
    expect(notify.success).toHaveBeenCalledWith('admin.settings.saved')
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('uses the refreshed version for the next save', async () => {
    vi.mocked(updateTimezone).mockResolvedValue()
    const wrapper = await mountView()
    await wrapper.find('#settings-timezone').setValue('America/Tijuana')
    await wrapper.find('form.settings-form').trigger('submit')
    await vi.waitFor(() => expect(useSettingsStore().timezoneUpdatedAt).toBe(SERVER_VERSION))
    await vi.waitFor(() => expect(saveDisabled(wrapper)).toBe(false))

    await wrapper.find('#settings-timezone').setValue('America/Cancun')
    await wrapper.find('form.settings-form').trigger('submit')
    await vi.waitFor(() => expect(updateTimezone).toHaveBeenCalledTimes(2))
    expect(updateTimezone).toHaveBeenLastCalledWith('America/Cancun', SERVER_VERSION)
  })

  it('reloads the settings when another admin changed them first', async () => {
    vi.mocked(updateTimezone).mockRejectedValue(new ApiError('stale_record'))
    const wrapper = await mountView()
    await wrapper.find('#settings-timezone').setValue('America/Cancun')
    await wrapper.find('form.settings-form').trigger('submit')
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'stale_record' })),
    )
    await vi.waitFor(() => expect(timezoneSelect(wrapper).value).toBe('America/Tijuana'))
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('does not report a saved timezone as failed when the reload afterwards fails', async () => {
    vi.mocked(updateTimezone).mockResolvedValue()
    vi.mocked(getSettings).mockRejectedValue(new ApiError('not_authorized'))
    const wrapper = await mountView()
    await wrapper.find('#settings-timezone').setValue('America/Cancun')
    await wrapper.find('form.settings-form').trigger('submit')
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledWith('admin.settings.saved'))
    await vi.waitFor(() => expect(getSettings).toHaveBeenCalled())
    await vi.waitFor(() => expect(saveDisabled(wrapper)).toBe(false))
    // Only the reload is reported, with its own error. The save is not.
    expect(notify.error).toHaveBeenCalledTimes(1)
    expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'not_authorized' }))
    // The select keeps the zone that was saved.
    expect(timezoneSelect(wrapper).value).toBe('America/Cancun')
  })

  describe('before the settings have loaded', () => {
    // A direct load or a refresh mounts this view before AppShell's load resolves.
    it('follows the store once it loads, and saves the real zone, not the default', async () => {
      vi.mocked(updateTimezone).mockResolvedValue()
      const wrapper = await mountView()
      const settings = useSettingsStore()
      settings.$patch({ loaded: false, timezone: 'America/Mexico_City', timezoneUpdatedAt: null })
      await wrapper.vm.$nextTick()
      expect(saveDisabled(wrapper)).toBe(true)

      await settings.load()
      await vi.waitFor(() => expect(timezoneSelect(wrapper).value).toBe('America/Tijuana'))
      expect(saveDisabled(wrapper)).toBe(false)

      await wrapper.find('form.settings-form').trigger('submit')
      await vi.waitFor(() => expect(updateTimezone).toHaveBeenCalledWith('America/Tijuana', SERVER_VERSION))
    })

    it('does not save until the settings have loaded', async () => {
      const wrapper = await mountView()
      // The version stays set, so only the loaded flag can stop the save.
      useSettingsStore().$patch({ loaded: false })
      await wrapper.vm.$nextTick()
      await wrapper.find('form.settings-form').trigger('submit')
      expect(updateTimezone).not.toHaveBeenCalled()
      expect(notify.error).not.toHaveBeenCalled()
    })
  })
})
