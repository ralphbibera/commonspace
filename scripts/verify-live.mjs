import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from 'playwright'

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

let browser
let output = ''

async function serverUrl() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Commonspace did not start in time\n${output}`))
    }, 15_000)
    const inspect = (chunk) => {
      output += chunk.toString()
      const match = output.match(/Commonspace is running at (http:\/\/127\.0\.0\.1:\d+)/)
      if (match?.[1] === undefined) return
      clearTimeout(timer)
      resolve(match[1])
    }
    server.stdout.on('data', inspect)
    server.stderr.on('data', inspect)
    server.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`Commonspace exited before startup (${String(code)})\n${output}`))
    })
  })
}

try {
  const url = await serverUrl()
  const health = await fetch(`${url}/api/health`)
  if (!health.ok) throw new Error(`health check failed with ${String(health.status)}`)
  const healthBody = await health.json()
  if (healthBody.status !== 'ok') throw new Error('health check returned an unexpected body')

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })
  const pageErrors = []
  page.on('pageerror', error => { pageErrors.push(error.message) })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Commonspace application').waitFor({ state: 'visible' })
  await page.getByLabel('Commonspace browser').waitFor({ state: 'visible' })
  await page.getByLabel('Commonspace conversation').waitFor({ state: 'visible' })
  if (pageErrors.length > 0) throw new Error(`browser errors: ${pageErrors.join(' | ')}`)

  console.log(JSON.stringify({
    url,
    health: healthBody,
    standalone: true,
    browserMounted: true,
  }))
} finally {
  await browser?.close()
  if (server.exitCode === null) {
    server.kill('SIGTERM')
    await Promise.race([
      once(server, 'exit'),
      new Promise(resolve => setTimeout(resolve, 5_000)),
    ])
    if (server.exitCode === null) server.kill('SIGKILL')
  }
  await rm(stateRoot, { recursive: true, force: true })
}