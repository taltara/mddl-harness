/**
 * Captures the readme's canvas image from a real run.
 *
 * A drag-and-drop tool whose readme has no picture is asking people to imagine
 * it. This drives the studio the same way DEMO.md tells a human to, so the
 * image and the instructions cannot drift apart.
 *
 *   pnpm dev                       # in another shell
 *   npm i -D playwright-core
 *   node scripts/shoot-studio.mjs  # writes docs/studio.png
 *
 * Uses the installed Chrome via `channel`, so there is no browser download.
 */

import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--force-color-profile=srgb', '--hide-scrollbars'],
})
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2, // retina, so the readme image stays crisp
  colorScheme: 'dark',
})
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })

// Same three steps DEMO.md documents for a human.
for (const label of ['Dismiss hint', 'Hide overlay']) {
  const b = page.getByRole('button', { name: label })
  if (await b.count()) await b.first().click()
}
await page.getByRole('button', { name: 'Fit View' }).click()
await page.waitForTimeout(700)

// Select a node so the inspector shows a real row rather than the
// standalone-mode caveat panel. This is what a user sees while working.
await page.getByText('DeepSeek V4 Flash', { exact: true }).nth(1).click()
await page.waitForTimeout(600)

await page.screenshot({ path: 'docs/studio.png' })
console.log('viewport 1600x900 @2x ->', 'studio.png')
await browser.close()
