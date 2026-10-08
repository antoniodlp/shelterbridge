import type { FieldErrors } from '@/components/forms/fieldErrors'
import { cleanText } from '@/lib/text'
import type { CatalogItem, CatalogName } from '@/types/domain'

export interface CatalogItemForm {
  code: string
  label_es: string
  label_en: string
  sort_order: string
  active: boolean
}

export type CatalogItemPayload = Omit<CatalogItem, 'updated_at'>

// sort_order is a Postgres integer.
const MAX_ORDER = 2147483647

/** Mirrors the database checks on catalog codes. */
export const CODE_PATTERNS: Record<CatalogName, RegExp> = {
  countries: /^[A-Z]{2}$/,
  case_types: /^[a-z][a-z0-9_]*$/,
  genders: /^[a-z][a-z0-9_]*$/,
}

export function emptyCatalogItem(): CatalogItemForm {
  return { code: '', label_es: '', label_en: '', sort_order: '0', active: true }
}

export function catalogItemToForm(item: CatalogItem): CatalogItemForm {
  return {
    code: item.code,
    label_es: item.labels.es ?? '',
    label_en: item.labels.en ?? '',
    sort_order: String(item.sort_order),
    active: item.active,
  }
}

function isWholeOrder(value: string): boolean {
  const trimmed = value.trim()
  return /^-?\d+$/.test(trimmed) && Math.abs(Number(trimmed)) <= MAX_ORDER
}

export function validateCatalogItem(catalog: CatalogName, form: CatalogItemForm, isNew: boolean): FieldErrors {
  const errors: FieldErrors = {}
  if (isNew && !CODE_PATTERNS[catalog].test(form.code.trim())) errors.code = 'admin.catalogs.validation.codeInvalid'
  if (!cleanText(form.label_es)) errors.label_es = 'validation.required'
  if (!isWholeOrder(form.sort_order)) errors.sort_order = 'admin.catalogs.validation.orderInvalid'
  return errors
}

/** Keeps labels in other languages, sets Spanish and English, and drops an empty English label. */
export function formToPayload(form: CatalogItemForm, previous: Record<string, string> = {}): CatalogItemPayload {
  const labels: Record<string, string> = { ...previous, es: cleanText(form.label_es) ?? '' }
  const english = cleanText(form.label_en)
  if (english) labels.en = english
  else delete labels.en
  return { code: form.code.trim(), labels, sort_order: Number(form.sort_order.trim()), active: form.active }
}
