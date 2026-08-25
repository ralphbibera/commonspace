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

async function openNavigation(target) {
  const trigger = target.getByRole('button', { name: 'Open Commonspace' })
  await trigger.waitFor({ state: 'visible', timeout: 30_000 })
  await trigger.click()

  const navigation = target.getByRole('navigation', { name: 'Commonspace navigation' })
  await navigation.waitFor({ state: 'visible' })
  if ((await target.getByRole('dialog', { name: 'Commonspace navigation' }).count()) !== 0) {
    throw new Error('Commonspace navigation must be embedded, not rendered as a dialog')
  }
  const launcher = target.locator('.csp-launcher')
  if ((await launcher.getByRole('navigation', { name: 'Commonspace navigation' }).count()) !== 1) {
    throw new Error('Commonspace navigation is not embedded inside the sidebar launcher')
  }
  return navigation
}

async function addItem(
  navigation,
  labels,
  value,
) {
  await navigation.getByRole('button', { name: labels.add }).click()
  await navigation.getByRole('textbox', { name: labels.input }).fill(value)
  await navigation.getByRole('button', { name: labels.create }).click()
  const row = navigation.getByRole('button', { name: labels.select })
  await row.waitFor({ state: 'visible' })
  if ((await row.getAttribute('aria-pressed')) !== 'true') {
    throw new Error(`${labels.select} was not selected after creation`)
  }
}

async function channelSessionId(target, label) {
  return target.evaluate(({ key, value }) => {
    const encoded = globalThis.localStorage.getItem(key)
    if (encoded === null) return null
    const state = JSON.parse(encoded)
    const item = state?.items?.channels?.find(candidate => candidate?.label === value)
    return typeof item?.sessionId === 'string' ? item.sessionId : null
  }, { key: 'commonspace.navigation.v2', value: label })
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  let navigation = await openNavigation(page)

  for (const name of ['Projects', 'Channels', 'Direct Messages']) {
    const button = navigation.getByRole('button', { name })
    if ((await button.count()) !== 1) throw new Error(`missing ${name} disclosure`)
  }

  await addItem(navigation, {
    add: 'Add project',
    input: 'Project name',
    create: 'Create project',
    select: 'Select project Apollo',
  }, 'Apollo')
  await addItem(navigation, {
    add: 'Add channel',
    input: 'Channel name',
    create: 'Create channel',
    select: 'Select channel #design-team',
  }, 'Design Team')
  await addItem(navigation, {
    add: 'Add direct message',
    input: 'Direct message name',
    create: 'Create direct message',
    select: 'Select direct message Ada',
  }, 'Ada')

  await page.reload({ waitUntil: 'domcontentloaded' })
  navigation = await openNavigation(page)
  for (const name of ['Projects', 'Channels', 'Direct Messages']) {
    await navigation.getByRole('button', { name }).click()
  }
  for (const name of ['Select project Apollo', 'Select channel #design-team', 'Select direct message Ada']) {
    await navigation.getByRole('button', { name }).waitFor({ state: 'visible' })
  }

  await navigation.getByRole('button', { name: 'Select project Apollo' }).click()
  await navigation.getByRole('button', { name: 'Select channel #design-team' }).click()
  await page.waitForFunction(() => {
    const encoded = globalThis.localStorage.getItem('commonspace.navigation.v2')
    if (encoded === null) return false
    const state = JSON.parse(encoded)
    return typeof state?.items?.channels?.find(item => item?.label === 'design-team')?.sessionId === 'string'
  }, undefined, { timeout: 30_000 })
  const firstSessionId = await channelSessionId(page, 'design-team')
  if (firstSessionId === null) throw new Error('channel selection did not bind a Harness session')
  await page.getByPlaceholder('Message the agent').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByText('#design-team · Apollo', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 })

  await page.reload({ waitUntil: 'domcontentloaded' })
  navigation = await openNavigation(page)
  await navigation.getByRole('button', { name: 'Channels' }).click()
  await navigation.getByRole('button', { name: 'Select channel #design-team' }).click()
  await page.getByPlaceholder('Message the agent').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByText('#design-team · Apollo', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 })
  const reopenedSessionId = await channelSessionId(page, 'design-team')
  if (reopenedSessionId !== firstSessionId) {
    throw new Error('channel selection did not reopen the same Harness session')
  }

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
    persistedItems: ['Apollo', '#design-team', 'Ada'],
    activeSessionId: firstSessionId,
    chatSwitched: true,
  }))
} finally {
  await browser.close()
}
