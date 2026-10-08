import { expect, test } from '@playwright/test'
import { signIn } from './fixtures'

// The app ships its own copy of Clarity City (web/src/assets/fonts) and points both
// Bootstrap and the Syncfusion theme at it, so page text and components match.
test('pages and Syncfusion components render in Clarity City', async ({ page }) => {
  await signIn(page, 'admin')
  await expect(page.getByRole('heading', { name: 'Residentes' })).toBeVisible()
  await expect(page.locator('.e-grid')).toBeVisible()

  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    const statuses: string[] = []
    document.fonts.forEach((face) => {
      if (face.family.replace(/["']/g, '') === 'Clarity City') statuses.push(face.status)
    })
    const family = (element: Element | null): string => (element ? getComputedStyle(element).fontFamily : '')
    return { statuses, body: family(document.body), grid: family(document.querySelector('.e-grid')) }
  })

  expect(fonts.statuses).toContain('loaded')
  expect(fonts.statuses).not.toContain('error')
  expect(fonts.body).toMatch(/^"?Clarity City"?,/)
  expect(fonts.grid).toMatch(/^"?Clarity City"?,/)
})
