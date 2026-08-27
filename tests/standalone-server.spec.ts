import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startCommonspaceServer, type RunningCommonspaceServer } from '../server/src/index.ts'

const roots: string[] = []
const servers: RunningCommonspaceServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('standalone Commonspace server', () => {
  it('serves the application and API without a plugin host', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-standalone-'))
    roots.push(root)
    const uiDistPath = join(root, 'ui')
    const workspace = join(root, 'workspace')
    await writeFile(join(root, 'index.html'), 'unused')
    await mkdir(join(uiDistPath, 'assets'), { recursive: true })
    await mkdir(workspace)
    await writeFile(join(uiDistPath, 'index.html'), '<div id="root"></div><script type="module" src="/assets/app.js"></script>')
    await writeFile(join(uiDistPath, 'assets', 'app.js'), 'window.__COMMONSPACE_STANDALONE__ = true')

    const running = await startCommonspaceServer({
      root,
      port: 0,
      uiDistPath,
      directoryPicker: async () => workspace,
      dependencies: { discoverAgents: async () => [] },
      logger: { warn: () => undefined, info: () => undefined },
    })
    servers.push(running)

    const documentResponse = await fetch(running.url)
    expect(documentResponse.status).toBe(200)
    expect(documentResponse.headers.get('content-type')).toContain('text/html')
    const document = await documentResponse.text()
    expect(document).toContain('<div id="root"></div>')
    expect(document).toContain('<script type="module" src="/assets/app.js"></script>')

    const scriptResponse = await fetch(`${running.url}/assets/app.js`)
    expect(scriptResponse.status).toBe(200)
    expect(await scriptResponse.text()).toContain('__COMMONSPACE_STANDALONE__')

    const healthResponse = await fetch(`${running.url}/api/health`)
    await expect(healthResponse.json()).resolves.toEqual({ status: 'ok' })

    const directoryResponse = await fetch(`${running.url}/api/select-directory`, {
      method: 'POST',
      headers: { origin: running.url },
    })
    expect(directoryResponse.status).toBe(200)
    await expect(directoryResponse.json()).resolves.toEqual({ path: workspace })

    const bootstrapResponse = await fetch(`${running.url}/api/bootstrap`, {
      headers: { origin: running.url },
    })
    expect(bootstrapResponse.status).toBe(200)
    await expect(bootstrapResponse.json()).resolves.toMatchObject({
      agents: [],
      discoveredAgents: [],
      state: { version: 9, revision: 0 },
    })
  })
})
