import { DOMWrapper, flushPromises } from '@vue/test-utils'

/** Syncfusion dialogs move their content to document.body, outside the mounted wrapper. */
export function body(): DOMWrapper<HTMLElement> {
  return new DOMWrapper(document.body)
}

/** Types into a Syncfusion date or date-time input the way a person does, then leaves the field. */
export async function typeInto(input: DOMWrapper<Element>, text: string): Promise<void> {
  const element = input.element as HTMLInputElement
  element.value = text
  await input.trigger('input')
  await input.trigger('change')
  await input.trigger('blur')
  await flushPromises()
}
