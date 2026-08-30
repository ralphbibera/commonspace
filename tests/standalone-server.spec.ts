import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMMONSPACE_STATE_VERSION } from '@commonspace/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { startCommonspaceServer, type RunningCommonspaceServer } from '../server/src/index.ts'

const roots: string[] = []
const servers: RunningCommonspaceServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('standalone Commonspace server', () => {
  it('serves the API without serving a UI build', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-standalone-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    let discoveryCalls = 0

    const running = await startCommonspaceServer({
      root,
      port: 0,
      directoryPicker: async () => workspace,
      dependencies: { discoverAgents: async () => { discoveryCalls += 1; return [] } },
      logger: { warn: () => undefined, info: () => undefined },
    })
    servers.push(running)

    const documentResponse = await fetch(running.url)
    expect(documentResponse.status).toBe(200)
    await expect(documentResponse.json()).resolves.toEqual({ status: 'ok' })

    const assetResponse = await fetch(`${running.url}/assets/app.js`)
    expect(assetResponse.status).toBe(404)

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
      state: { version: COMMONSPACE_STATE_VERSION, revision: 0 },
    })
    expect(discoveryCalls).toBe(0)

    const routingResponse = await fetch(`${running.url}/api/routing`, {
      method: 'PUT',
      headers: { origin: running.url, 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai-compatible',
        model: 'local-router',
        baseUrl: 'http://127.0.0.1:11434/v1',
        apiKey: 'private-key',
      }),
    })
    expect(routingResponse.status).toBe(200)
    await expect(routingResponse.json()).resolves.toEqual({
      provider: 'openai-compatible',
      model: 'local-router',
      harnessAgentId: null,
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKeyConfigured: true,
    })
    const routingReadResponse = await fetch(`${running.url}/api/routing`, { headers: { origin: running.url } })
    expect(JSON.stringify(await routingReadResponse.json())).not.toContain('private-key')

    const discoveryResponse = await fetch(`${running.url}/api/discover-agents`, {
      method: 'POST',
      headers: { origin: running.url, 'content-type': 'application/json' },
      body: JSON.stringify({ adapter: 'hermes' }),
    })
    expect(discoveryResponse.status).toBe(200)
    expect(discoveryCalls).toBe(1)

    const codexDiscoveryResponse = await fetch(`${running.url}/api/discover-agents`, {
      method: 'POST',
      headers: { origin: running.url, 'content-type': 'application/json' },
      body: JSON.stringify({ adapter: 'codex' }),
    })
    expect(codexDiscoveryResponse.status).toBe(200)
    await expect(codexDiscoveryResponse.json()).resolves.toMatchObject({
      discoveredAgents: expect.arrayContaining([
        expect.objectContaining({ id: 'codex-default', adapter: 'codex', nativeProfile: 'default' }),
      ]),
    })
    expect(discoveryCalls).toBe(1)

    const unsupportedResponse = await fetch(`${running.url}/api/discover-agents`, {
      method: 'POST',
      headers: { origin: running.url, 'content-type': 'application/json' },
      body: JSON.stringify({ adapter: 'claude-code' }),
    })
    expect(unsupportedResponse.status).toBe(400)
  })

})
