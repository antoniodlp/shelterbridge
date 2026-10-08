import { formatDate, formatDateTime, formatTime, todayIn } from '@/lib/shelterTime'
import { useSettingsStore } from '@/stores/settings'

type DateInput = string | Date | null | undefined

// The lib/shelterTime helpers, bound to the shelter timezone from settings.
export function useShelterTime(): {
  formatDate(value: DateInput): string
  formatTime(value: DateInput): string
  formatDateTime(value: DateInput): string
  today(): string
} {
  const settings = useSettingsStore()
  return {
    formatDate: (value) => formatDate(value, settings.timezone),
    formatTime: (value) => formatTime(value, settings.timezone),
    formatDateTime: (value) => formatDateTime(value, settings.timezone),
    today: () => todayIn(settings.timezone),
  }
}
