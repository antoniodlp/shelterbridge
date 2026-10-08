import { expect, test } from '@playwright/test'
import { dismissLicenseBanner, signIn, uniqueName } from './fixtures'
import { registerPerson, residentRow, shelterDate, typeDate } from './steps'

test('a returning person is found by the duplicate panel and gets a new stay', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de prueba')
  const firstName = uniqueName('Luis')
  await registerPerson(page, firstName, 'Regresa', { entryDaysAgo: 10 })

  // The first stay ended days ago, so a new stay today does not overlap it.
  const row = await residentRow(page, firstName)
  await row.getByRole('button', { name: 'Egreso', exact: true }).click()
  await typeDate(page, 'Fecha de egreso', shelterDate(5))
  await page.getByRole('button', { name: 'Registrar egreso' }).click()
  await expect(row).toHaveCount(0)

  // They come back, typed in different case.
  await page.goto('/people/new')
  await dismissLicenseBanner(page)
  await page.getByLabel('Nombre(s)', { exact: true }).fill(firstName.toLowerCase())
  await page.getByLabel('Apellidos', { exact: true }).fill('REGRESA')
  const candidate = page.getByTestId('duplicate-candidate').filter({ hasText: firstName })
  await expect(candidate).toBeVisible()
  await candidate.getByRole('button', { name: 'Es esta persona' }).click()

  await page.waitForURL(/\/people\/[0-9a-f-]{36}\?checkIn=1$/)
  await page.getByLabel('Cama', { exact: true }).fill('B7')
  await page.getByRole('button', { name: 'Abrir estancia' }).click()
  await expect(page.getByTestId('stay-status')).toContainText('En el albergue desde')
  await expect(page.getByTestId('stay-row')).toHaveCount(2)
})
