import { expect, test, type Locator } from '@playwright/test'
import { signIn } from './fixtures'

// The ShelterBridge mark (web/src/assets/logo.svg) sits above the sign-in card and next
// to the app name in the navbar. The tab icon is web/public/favicon.svg, with a PNG
// fallback for browsers that cannot show SVG icons.

function isLoaded(logo: Locator): Promise<boolean> {
  return logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
}

test('the sign-in page shows the logo and the tab icons resolve', async ({ page, request }) => {
  await page.goto('/login')
  const logo = page.locator('main img[alt="ShelterBridge"]')
  await expect(logo).toBeVisible()
  await expect.poll(() => isLoaded(logo)).toBe(true)

  const icons = await page.locator('link[rel="icon"]').evaluateAll((links) =>
    links.map((link) => ({ href: (link as HTMLLinkElement).href, type: (link as HTMLLinkElement).type })),
  )
  expect(icons.map((icon) => icon.type).sort()).toEqual(['image/png', 'image/svg+xml'])
  for (const icon of icons) {
    const response = await request.get(icon.href)
    expect(response.status(), icon.href).toBe(200)
    expect(response.headers()['content-type'], icon.href).toContain(icon.type)
  }
})

test('the navbar shows the logo next to the app name', async ({ page }) => {
  await signIn(page, 'admin')
  const brand = page.locator('nav.navbar a.navbar-brand')
  await expect(brand).toHaveText('ShelterBridge')
  const logo = brand.locator('img')
  await expect(logo).toBeVisible()
  await expect.poll(() => isLoaded(logo)).toBe(true)
})
