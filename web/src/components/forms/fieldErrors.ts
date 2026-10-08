/** Field name to the i18n key of its error message. */
export type FieldErrors = Record<string, string>

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}
