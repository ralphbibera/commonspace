import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const url = process.env.COMMONSPACE_TEST_URL ?? 'http://127.0.0.1:3081'
const screenshot = resolve('artifacts/commonspace-live.png')
const panelScreenshot = process.env.COMMONSPACE_UPDATE_DOCS === '1'
  ? resolve('docs/assets/commonspace-panel.png')
  : resolve('artifacts/commonspace-panel.png')
await mkdir(resolve('artifacts'), { recursive: true })
if (process.env.COMMONSPACE_UPDATE_DOCS === '1') {
  await mkdir(resolve('docs/assets'), { recursive: true })
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })
const pageErrors = []
page.on('pageerror', error => { pageErrors.push(error.message) })
page.on('console', message => {
  if (message.type() === 'error') pageErrors.push(message.text())
})

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const trigger = page.getByRole('button', { name: 'Open Commonspace' })
  await trigger.waitFor({ state: 'visible', timeout: 30_000 })
  await trigger.click()

  const navigation = page.getByRole('navigation', { name: 'Commonspace navigation' })
  await navigation.waitFor({ state: 'visible' })
  if ((await page.getByRole('dialog', { name: 'Commonspace navigation' }).count()) !== 0) {
    throw new Error('Commonspace navigation must be embedded, not rendered as a dialog')
  }
  const launcher = page.locator('.csp-launcher')
  if ((await launcher.getByRole('navigation', { name: 'Commonspace navigation' }).count()) !== 1) {
    throw new Error('Commonspace navigation is not embedded inside the sidebar launcher')
  }
  for (const name of ['Projects', 'Channels', 'Direct Messages']) {
    const button = navigation.getByRole('button', { name })
    if ((await button.count()) !== 1) throw new Error(`missing ${name} disclosure`)
  }

  await navigation.getByRole('button', { name: 'Projects' }).click()
  await navigation.getByText('No projects yet').waitFor({ state: 'visible' })
  await page.screenshot({ path: screenshot, fullPage: true })
  await navigation.screenshot({ path: panelScreenshot })

  if (pageErrors.length > 0) {
    throw new Error(`browser errors: ${pageErrors.join(' | ')}`)
  }

  console.log(JSON.stringify({
    url,
    screenshot,
    panelScreenshot,
    groups: ['Projects', 'Channels', 'Direct Messages'],
  }))
} finally {
  await browser.close()
}
