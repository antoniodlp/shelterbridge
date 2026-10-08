import { expect, type Page } from '@playwright/test'
import type { AppRole } from '../src/types/domain'

// Seeded by supabase/seed.sql for local development only.
const DEV_PASSWORD = 'shelterbridge-dev'

// Without VITE_SYNCFUSION_LICENSE_KEY, Syncfusion shows a fixed banner over the
// top of the page that would block clicks on the navbar. Close it if it is there.
export async function dismissLicenseBanner(page: Page): Promise<void> {
  const close = page.locator('.sf-license-validation-close')
  if (await close.isVisible()) await close.click()
}

// Signs in through the login page. A volunteer lands on the shift page; when
// operatorName is given it is entered there and the residents page is awaited.
export async function signIn(page: Page, role: AppRole, operatorName?: string): Promise<void> {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entrar a ShelterBridge' })).toBeVisible()
  await dismissLicenseBanner(page)
  await page.getByLabel('Correo electrónico').fill(`${role}@shelterbridge.test`)
  await page.getByLabel('Contraseña').fill(DEV_PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  if (role === 'volunteer') {
    await expect(page).toHaveURL(/\/shift/)
    if (operatorName === undefined) return
    await page.getByLabel('Nombres de quienes están de turno').fill(operatorName)
    await page.getByRole('button', { name: 'Empezar turno' }).click()
  }
  // Compare the path only: the shift page URL ends in "?redirect=/residents", which a
  // regex such as /\/residents$/ would match before the navigation has happened.
  await expect(page).toHaveURL((url) => url.pathname === '/residents')
}

// Fictitious, unique text so tests never collide with seed data or each other.
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
