import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const url = process.env.COMMONSPACE_TEST_URL ?? 'http://127.0.0.1:3080'
const projectPath = process.env.COMMONSPACE_TEST_PROJECT ?? process.cwd()
const screenshot = resolve('artifacts/commonspace-live.png')
const sidebarScreenshot = process.env.COMMONSPACE_UPDATE_DOCS === '1'
  ? resolve('docs/assets/commonspace-panel.png')
  : resolve('artifacts/commonspace-panel.png')
await mkdir(resolve('artifacts'), { recursive: true })
if (process.env.COMMONSPACE_UPDATE_DOCS === '1') await mkdir(resolve('docs/assets'), { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })
const pageErrors = []
page.on('pageerror', error => { pageErrors.push(error.message) })
page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()) })

async function switchToCommonspace() {
  const switcher = page.getByRole('button', { name: 'Switch to Commonspace' })
  await switcher.waitFor({ state: 'visible', timeout: 30_000 })
  await switcher.click()
  await page.getByLabel('Commonspace browser').waitFor({ state: 'visible' })
  await page.getByLabel('Commonspace conversation').waitFor({ state: 'visible' })
}

async function ensureProject() {
  if ((await page.getByRole('button', { name: 'Select project Commonspace' }).count()) === 0) {
    await page.getByRole('button', { name: 'Add project' }).click()
    await page.getByRole('textbox', { name: 'Project name' }).fill('Commonspace')
    await page.getByRole('textbox', { name: 'Project path' }).fill(projectPath)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByRole('button', { name: 'Select project Commonspace' }).waitFor({ state: 'visible' })
  }
  await page.getByRole('button', { name: 'Select project Commonspace' }).click()
  const secondWorkspace = '/Users/ralphbibera/Developer/deepseek-harness'
  if ((await page.getByText(secondWorkspace, { exact: true }).count()) === 0) {
    await page.getByRole('button', { name: 'Add workspace to project Commonspace' }).click()
    await page.getByRole('textbox', { name: 'Workspace path for Commonspace' }).fill(secondWorkspace)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
  }
  await page.getByText(secondWorkspace, { exact: true }).waitFor({ state: 'visible' })
}

async function ensureChannel() {
  if ((await page.getByRole('button', { name: /general.*agent/ }).count()) === 0) {
    await page.getByRole('button', { name: 'Add channel' }).click()
    await page.getByRole('textbox', { name: 'Channel name' }).fill('general')
    await page.getByRole('combobox', { name: 'Channel project' }).selectOption({ label: 'Commonspace' })
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByRole('button', { name: /general.*agent/ }).waitFor({ state: 'visible' })
  }
  if ((await page.getByRole('button', { name: /general.*2 agents/ }).count()) === 0) {
    await page.getByRole('button', { name: 'Manage agents in channel general' }).click()
    const desired = new Set(['Backend', 'Frontend'])
    for (const profile of ['AgentOps', 'Backend', 'Frontend', 'Infrastructure']) {
      const checkbox = page.getByRole('checkbox', { name: profile })
      if (desired.has(profile)) await checkbox.check()
      else await checkbox.uncheck()
    }
    await page.getByRole('button', { name: 'Save', exact: true }).click()
  }
  await page.getByRole('button', { name: /general.*2 agents/ }).waitFor({ state: 'visible' })
}

async function ensureSettings() {
  await page.getByRole('button', { name: 'Commonspace settings' }).click()
  await page.getByRole('combobox', { name: 'Default reasoning' }).selectOption('max')
  await page.getByRole('spinbutton', { name: 'Default max agents' }).fill('2')
  await page.getByRole('spinbutton', { name: 'Default memory threads' }).fill('12')
  await page.getByRole('button', { name: 'Save defaults' }).click()
}

async function ensureChannelContext() {
  await page.getByRole('button', { name: 'Manage agents in channel general' }).click()
  await page.getByRole('textbox', { name: 'Instructions for channel general' }).fill('Keep checkout work concise. Record decisions and unresolved questions explicitly.')
  await page.getByRole('combobox', { name: 'Reasoning for channel general' }).selectOption('high')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await switchToCommonspace()

  for (const label of ['Projects', 'Channels', 'Direct Messages', 'Agents']) {
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).waitFor({ state: 'visible' })
  }
  for (const profile of ['AgentOps', 'Backend', 'Frontend', 'Infrastructure']) {
    await page.getByRole('button', { name: `Message agent ${profile}` }).waitFor({ state: 'visible' })
  }

  await ensureProject()
  await ensureChannel()
  await ensureSettings()
  await ensureChannelContext()
  await page.getByRole('button', { name: /general.*agent/ }).click()
  await page.getByRole('heading', { name: '#general' }).waitFor({ state: 'visible' })
  const rootText = '@frontend Reply exactly: Threaded agent reply works.'
  let rootCard = page.locator('.csp-thread-root').filter({ hasText: rootText })
  if ((await rootCard.count()) === 0) {
    const startedAt = Date.now()
    const composer = page.getByPlaceholder('Post new work in #general')
    await composer.fill(rootText)
    await page.getByRole('button', { name: 'Post', exact: true }).click()
    await page.locator('.csp-channel-feed').getByText(rootText, { exact: true }).waitFor({ state: 'visible', timeout: 3_000 })
    if (Date.now() - startedAt > 3_000) throw new Error('channel root was not accepted immediately')
    rootCard = page.locator('.csp-thread-root').filter({ hasText: rootText })
  } else {
    await rootCard.getByRole('button').click()
  }
  const threadPanel = page.getByLabel('Thread replies')
  await threadPanel.waitFor({ state: 'visible' })
  await threadPanel.getByText('Threaded agent reply works.', { exact: true }).waitFor({ state: 'visible', timeout: 240_000 })
  if ((await page.locator('.csp-channel-feed').getByText('Threaded agent reply works.', { exact: true }).count()) !== 0) {
    throw new Error('agent reply leaked into the main channel feed')
  }
  await page.getByRole('button', { name: 'Manage agents in channel general' }).click()
  await page.getByText(/Projected memory · [1-9][0-9]* threads/).waitFor({ state: 'visible' })
  await page.getByText(rootText, { exact: false }).last().waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: 'Message agent Frontend' }).click()
  await page.getByRole('heading', { name: 'Frontend' }).waitFor({ state: 'visible' })
  const verifiedReply = page.getByText(/Commonspace Hermes DM works\./)
  if ((await verifiedReply.count()) === 0) {
    const composer = page.getByPlaceholder('Message Frontend')
    await composer.fill('Reply with exactly: Commonspace Hermes DM works.')
    await page.getByRole('button', { name: 'Send' }).click()
  }
  await verifiedReply.last().waitFor({ state: 'visible', timeout: 240_000 })

  await page.screenshot({ path: screenshot, fullPage: true })
  await page.getByLabel('Commonspace browser').screenshot({ path: sidebarScreenshot })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await switchToCommonspace()
  await page.getByRole('button', { name: /general.*agent/ }).click()
  const persistedRoot = page.locator('.csp-thread-root').filter({ hasText: rootText })
  await persistedRoot.getByRole('button').click()
  await page.getByLabel('Thread replies').getByText('Threaded agent reply works.', { exact: true }).waitFor({ state: 'visible' })
  const dmSection = page.locator('.csp-browser-section').filter({
    has: page.getByRole('button', { name: /^Direct Messages/ }),
  })
  await dmSection.getByRole('button', { name: /Frontend/ }).click()
  await page.getByText(/Commonspace Hermes DM works\./).last().waitFor({ state: 'visible' })

  await page.getByRole('button', { name: 'Switch to Workspaces' }).click()
  await page.getByText('Workspaces', { exact: true }).waitFor({ state: 'visible' })
  await page.getByLabel('Sessions', { exact: true }).getByText('Developer', { exact: true }).waitFor({ state: 'visible' })
  if ((await page.getByLabel('Commonspace conversation').count()) !== 0) {
    throw new Error('native conversation was not restored after switching to Workspaces')
  }

  if (pageErrors.length > 0) throw new Error(`browser errors: ${pageErrors.join(' | ')}`)

  console.log(JSON.stringify({
    url,
    screenshot,
    sidebarScreenshot,
    modeSwitch: true,
    agents: ['default', 'backend', 'frontend', 'infrastructure'],
    project: { name: 'Commonspace', paths: [projectPath, '/Users/ralphbibera/Developer/deepseek-harness'] },
    channel: 'general',
    channelAgents: ['backend', 'frontend'],
    channelReasoning: 'high',
    defaultMaxAgents: 2,
    channelMemory: true,
    immediateRoot: true,
    threadedReplies: true,
    dm: 'frontend',
    hermesReply: true,
    persistedAfterReload: true,
    nativeWorkspacesRestored: true,
  }))
} finally {
  await browser.close()
}
