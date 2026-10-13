import { expect, type Locator, type Page } from '@playwright/test'
import { dismissLicenseBanner } from './fixtures'

/** A 1x1 PNG: enough for the browser to decode, resize and upload. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const SHELTER_TZ = 'America/Mexico_City'

/** The shelter-local date `daysAgo` days back, as dd/MM/yyyy for typing into a date field. */
export function shelterDate(daysAgo: number): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHELTER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  const iso = date.toISOString().slice(0, 10)
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** Types a date into a Syncfusion date field and leaves it, as a person would. */
export async function typeDate(page: Page, label: string, value: string): Promise<void> {
  const field = page.getByLabel(label, { exact: true })
  await field.fill(value)
  await field.press('Tab')
}

export interface RegisterOptions {
  photo?: boolean
  entryDaysAgo?: number
}

/** Registers a fictitious person through the form and returns the new record id. */
export async function registerPerson(
  page: Page,
  firstName: string,
  lastName: string,
  options: RegisterOptions = {},
): Promise<string> {
  await page.goto('/people/new')
  await dismissLicenseBanner(page)
  await page.getByLabel('Nombre(s)', { exact: true }).fill(firstName)
  await page.getByLabel('Apellidos', { exact: true }).fill(lastName)
  await page.getByLabel('Cama', { exact: true }).fill('Z9')
  if (options.entryDaysAgo) await typeDate(page, 'Fecha de ingreso', shelterDate(options.entryDaysAgo))
  if (options.photo) {
    await page.getByLabel('Elegir archivo o tomar con el teléfono').setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    })
    await expect(page.getByText('Foto lista. Se guardará al registrar.')).toBeVisible()
  }
  const submit = page.getByRole('button', { name: 'Registrar e ingresar' })
  await submit.click()
  // The form looks for lookalikes before it registers. On a database that already holds one (an
  // earlier run without db:reset) the first click only shows the panel: say the person is new, send again.
  const panel = page.getByTestId('duplicate-panel')
  const registered = page.waitForURL(/\/people\/[0-9a-f-]{36}$/)
  await Promise.race([registered, panel.waitFor({ state: 'visible' })])
  if (await panel.isVisible()) {
    await panel.getByRole('button', { name: 'Es una persona nueva' }).click()
    await submit.click()
  }
  await registered
  return new URL(page.url()).pathname.split('/').pop() ?? ''
}

/** Opens the residents list filtered to one person and returns their grid row. */
export async function residentRow(page: Page, name: string): Promise<Locator> {
  await page.goto('/residents')
  await dismissLicenseBanner(page)
  await page.getByLabel('Buscar por nombre').fill(name)
  return page.getByRole('row').filter({ hasText: name })
}
