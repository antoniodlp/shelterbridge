import { expect, test } from '@playwright/test'
import { signIn, uniqueName } from './fixtures'
import { registerPerson, residentRow } from './steps'

test('outing, return, exception and check-out from the residents list', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de prueba')
  const firstName = uniqueName('Eva')
  await registerPerson(page, firstName, 'Salidas')
  const row = await residentRow(page, firstName)
  const presence = row.getByTestId('presence')

  await row.getByRole('button', { name: 'Salida', exact: true }).click()
  await page.getByLabel('Comentario (opcional)').fill('Cita en el consulado')
  await page.getByRole('button', { name: 'Registrar salida' }).click()
  await expect(presence).toHaveAttribute('data-presence', 'outside')

  await row.getByRole('button', { name: 'Regreso', exact: true }).click()
  await expect(presence).toHaveAttribute('data-presence', 'inside')

  // The second outing of the day asks for the exception before the comment dialog opens.
  await row.getByRole('button', { name: 'Salida', exact: true }).click()
  await expect(page.getByText('Ya salió hoy, ¿registrar como excepción?')).toBeVisible()
  await page.getByRole('button', { name: 'Registrar excepción' }).click()
  await page.getByRole('button', { name: 'Registrar salida' }).click()
  await expect(presence).toHaveAttribute('data-presence', 'outside')

  await row.getByRole('button', { name: 'Egreso', exact: true }).click()
  await expect(page.getByText('se registrará como salió y no regresó')).toBeVisible()
  await page.getByRole('button', { name: 'Registrar egreso' }).click()
  await expect(row).toHaveCount(0)
})
