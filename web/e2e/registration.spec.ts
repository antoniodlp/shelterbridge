import { expect, test } from '@playwright/test'
import { signIn, uniqueName } from './fixtures'
import { registerPerson, residentRow } from './steps'

test('a new person is registered with a photo and appears among the residents', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de prueba')
  const firstName = uniqueName('Ana')
  await registerPerson(page, firstName, 'Prueba', { photo: true })

  await expect(page.getByTestId('stay-status')).toContainText('En el albergue desde')
  await expect(page.getByRole('img', { name: `Foto de ${firstName} Prueba` })).toBeVisible()

  const row = await residentRow(page, firstName)
  await expect(row).toHaveCount(1)
  await expect(row.getByTestId('presence')).toHaveAttribute('data-presence', 'inside')
  await expect(row.getByRole('img', { name: `Foto de ${firstName} Prueba` })).toBeVisible()
})
