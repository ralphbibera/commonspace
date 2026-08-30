import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { findStartupUrl } from './startup-output.mjs'

const repoRoot = process.cwd()
const stateRoot = await mkdtemp(join(tmpdir(), 'commonspace-live-'))
const server = spawn(process.execPath, [join(repoRoot, 'server/dist/index.js')], {
  cwd: repoRoot,
  env: {
    ...process.env,
    COMMONSPACE_HOME: stateRoot,
    COMMONSPACE_PORT: '0',
    NODE_ENV: 'production',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let uiServer
let browser

function waitForUrl(child, pattern, label) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => {
      reject(new Error(`${label} did not start in time\n${output}`))
    }, 15_000)
    const inspect = (chunk) => {
      output += chunk.toString()
      const url = findStartupUrl(output, pattern)
      if (url === undefined) return
      clearTimeout(timer)
      resolve(url)
    }
    child.stdout.on('data', inspect)
    child.stderr.on('data', inspect)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`${label} exited before startup (${String(code)})\n${output}`))
    })
  })
}

async function stopProcess(child) {
  if (child === undefined || child.exitCode !== null || child.signalCode !== null) return
  const exit = once(child, 'exit')
  child.kill('SIGTERM')
  await Promise.race([
    exit,
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ])
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await exit
  }
}

try {
  const url = await waitForUrl(server, /Commonspace is running at (http:\/\/127\.0\.0\.1:\d+)/, 'Commonspace server')
  const health = await fetch(`${url}/api/health`)
  if (!health.ok) throw new Error(`health check failed with ${String(health.status)}`)
  const healthBody = await health.json()
  if (healthBody.status !== 'ok') throw new Error('health check returned an unexpected body')
  const rootResponse = await fetch(url)
  if (!rootResponse.ok) throw new Error(`API root health check failed with ${String(rootResponse.status)}`)
  const rootBody = await rootResponse.json()
  if (rootBody.status !== 'ok') throw new Error('API root health check returned an unexpected body')
  const assetResponse = await fetch(`${url}/index.html`)
  if (assetResponse.status !== 404) throw new Error(`API server served UI asset with status ${String(assetResponse.status)}`)

  uiServer = spawn(process.execPath, [join(repoRoot, 'ui/node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '0'], {
    cwd: join(repoRoot, 'ui'),
    env: {
      ...process.env,
      COMMONSPACE_API_TARGET: url,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const uiUrl = await waitForUrl(uiServer, /Local:\s+(http:\/\/127\.0\.0\.1:\d+)/, 'Vite preview')

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })
  const pageErrors = []
  page.on('pageerror', error => { pageErrors.push(error.message) })
  await page.goto(uiUrl, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Commonspace application').waitFor({ state: 'visible' })
  await page.getByLabel('Commonspace browser').waitFor({ state: 'visible' })
  await page.getByLabel('Commonspace conversation').waitFor({ state: 'visible' })
  if (pageErrors.length > 0) throw new Error(`browser errors: ${pageErrors.join(' | ')}`)

  console.log(JSON.stringify({
    apiUrl: url,
    uiUrl,
    health: healthBody,
    apiServer: true,
    browserMounted: true,
  }))
} finally {
  await browser?.close()
  await stopProcess(uiServer)
  await stopProcess(server)
  await rm(stateRoot, { recursive: true, force: true })
}
