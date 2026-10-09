// Renders public/favicon.svg to public/favicon.png (64 x 64, transparent corners) for
// browsers that cannot show SVG tab icons. Run it again whenever favicon.svg changes:
//   node web/scripts/favicon-png.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const SIZE = 64
const publicDir = new URL('../public/', import.meta.url)
const svg = await readFile(new URL('favicon.svg', publicDir), 'utf8')

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;background:transparent}img{display:block}</style>` +
      `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" width="${SIZE}" height="${SIZE}">`,
  )
  await page.waitForFunction(() => document.images[0]?.complete)
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: SIZE, height: SIZE } })
  await writeFile(new URL('favicon.png', publicDir), png)
} finally {
  await browser.close()
}
console.log(`Wrote ${fileURLToPath(new URL('favicon.png', publicDir))}`)
