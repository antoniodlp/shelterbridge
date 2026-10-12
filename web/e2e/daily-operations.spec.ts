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

test('bed and phone status are edited in place in the residents list', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de prueba')
  const firstName = uniqueName('Nora')
  await registerPerson(page, firstName, 'Camas')
  const name = `${firstName} Camas`
  const row = await residentRow(page, firstName)

  const bed = row.getByLabel(`Cama de ${name}`)
  await expect(bed).toHaveValue('Z9')
  await bed.fill('C4')
  await bed.press('Enter')
  await expect(page.getByText(`Cama actualizada: ${name}`)).toBeVisible()

  await row.getByLabel(`Teléfono de ${name}`).selectOption('in_custody')
  await expect(page.getByText(`Teléfono actualizado: ${name}`)).toBeVisible()

  // Opening the list again reads the database, so this proves both values were saved.
  const reloaded = await residentRow(page, firstName)
  await expect(reloaded.getByLabel(`Cama de ${name}`)).toHaveValue('C4')
  await expect(reloaded.getByLabel(`Teléfono de ${name}`)).toHaveValue('in_custody')
})
