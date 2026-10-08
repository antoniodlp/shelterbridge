import { expect, test } from '@playwright/test'
import { dismissLicenseBanner, signIn, uniqueName } from './fixtures'

test('a volunteer names the shift and reaches the residents page', async ({ page }) => {
  const operator = uniqueName('Turno de prueba')
  await signIn(page, 'volunteer')

  await expect(page.getByRole('heading', { name: '¿Quién está de turno?' })).toBeVisible()
  await page.getByLabel('Nombres de quienes están de turno').fill(operator)
  await page.getByRole('button', { name: 'Empezar turno' }).click()

  await expect(page).toHaveURL((url) => url.pathname === '/residents')
  await expect(page.getByRole('heading', { name: 'Residentes' })).toBeVisible()
  await expect(page.getByTestId('operator-name')).toHaveText(`De turno: ${operator}`)
  await expect(page.getByRole('button', { name: 'Administración' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
})

test('the operator name survives a page reload', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de recarga')
  await page.reload()
  await expect(page).toHaveURL((url) => url.pathname === '/residents')
  await expect(page.getByTestId('operator-name')).toHaveText('De turno: Turno de recarga')
})

test('an admin goes straight to residents and sees the admin links', async ({ page }) => {
  await signIn(page, 'admin')
  await expect(page.getByRole('heading', { name: 'Residentes' })).toBeVisible()
  await page.getByRole('button', { name: 'Administración' }).click()
  for (const name of ['Usuarios', 'Catálogos', 'Configuración', 'Bitácora de cambios', 'Unir duplicados']) {
    await expect(page.getByRole('link', { name })).toBeVisible()
  }
  await page.getByRole('link', { name: 'Usuarios' }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
})

test('a wrong password shows a Spanish message', async ({ page }) => {
  await page.goto('/login')
  await dismissLicenseBanner(page)
  await page.getByLabel('Correo electrónico').fill('legal@shelterbridge.test')
  await page.getByLabel('Contraseña').fill('not-the-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByTestId('login-error')).toHaveText('El correo o la contraseña no son correctos.')
})
