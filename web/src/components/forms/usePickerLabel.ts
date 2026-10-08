import { ref } from 'vue'

interface PickerInstance {
  ej2Instances: { inputElement: HTMLInputElement }
}

/**
 * Syncfusion's date pickers give their input aria-label="datepicker" (or "datetimepicker")
 * when it has none, and an aria-label wins over the visible <label for>. Bind `picker` as the
 * component's template ref and call `onCreated` from its `created` event: it drops that
 * default so the form's label names the field.
 */
export function usePickerLabel() {
  const picker = ref<PickerInstance | null>(null)
  function onCreated(): void {
    picker.value?.ej2Instances.inputElement.removeAttribute('aria-label')
  }
  return { picker, onCreated }
}
