import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMMONSPACE_STATE_VERSION } from '@commonspace/shared'
import { startCommonspaceServer, type RunningCommonspaceServer } from '../server/src/index.ts'
import { CommonspaceHostService } from '../server/src/service.ts'
import { addTestCodexAgents } from './test-codex-agents.ts'

const roots: string[] = []
const servers: RunningCommonspaceServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function post(running: RunningCommonspaceServer, path: string, body: unknown): Promise<Response> {
  return fetch(`${running.url}${path}`, {
    method: 'POST',
    headers: { origin: running.url, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('managed chat image attachments', () => {
  it('migrates v10 image metadata without loading host paths or inline bytes into public state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-image-migration-'))
    roots.push(root)
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 10,
      revision: 1,
      inboxReadAt: null,
      inboxReadMessageIds: [],
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: null, createdAt: 'now' }],
      dmSessions: {},
      agentSessions: {},
      projects: [],
      channels: [],
      threads: [],
      messages: {
        'dm:codex-review-bot': [{
          id: 'message-1',
          conversation: { kind: 'dm', id: 'codex-review-bot' },
          authorType: 'user',
          authorId: 'user',
          authorName: 'Ralph',
          text: '',
          createdAt: '2026-08-27T00:00:00.000Z',
          attachments: [{
            id: '123e4567-e89b-42d3-a456-426614174000',
            name: 'clipboard.png',
            mimeType: 'image/png',
            size: 4,
            data: 'must-not-survive',
            path: '/private/attachment.png',
          }],
        }],
      },
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })

    await service.initialize()

    expect(service.snapshot().version).toBe(COMMONSPACE_STATE_VERSION)
    expect(service.snapshot().messages['dm:codex-review-bot']?.[0]?.attachments).toEqual([{
      id: '123e4567-e89b-42d3-a456-426614174000',
      name: 'clipboard.png',
      mimeType: 'image/png',
      size: 4,
    }])
  })

  it('persists pasted image bytes privately, delivers them to the agent, and serves a local preview', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-image-'))
    roots.push(root)
    const runAgent = vi.fn(async () => ({ text: 'I can see it.' }))
    const running = await startCommonspaceServer({
      root,
      port: 0,
      dependencies: { discoverAgents: async () => [], runAgent },
      logger: { warn: () => undefined, info: () => undefined },
    })
    servers.push(running)
    await addTestCodexAgents(running.service, 'codex-review-bot')

    const sendResponse = await post(running, '/api/send', {
      conversation: { kind: 'dm', id: 'codex-review-bot' },
      text: '',
      attachments: [{ name: 'clipboard.png', mimeType: 'image/png', data: 'iVBORw==' }],
    })

    expect(sendResponse.status).toBe(202)
    const sent = await sendResponse.json() as {
      accepted: { attachments?: Array<{ id: string; name: string; mimeType: string; size: number }> }
    }
    expect(sent.accepted.attachments).toEqual([{
      id: expect.any(String),
      name: 'clipboard.png',
      mimeType: 'image/png',
      size: 4,
    }])
    const attachment = sent.accepted.attachments![0]!

    await vi.waitFor(() => {
      expect(runAgent).toHaveBeenCalledWith(expect.objectContaining({
        message: '',
        images: [{ name: 'clipboard.png', mimeType: 'image/png', data: 'iVBORw==' }],
      }))
    })

    const preview = await fetch(`${running.url}/api/attachments/${attachment.id}`, {
      headers: { origin: running.url },
    })
    expect(preview.status).toBe(200)
    expect(preview.headers.get('content-type')).toBe('image/png')
    expect(preview.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await preview.arrayBuffer())).toEqual(Uint8Array.from([137, 80, 78, 71]))

    const persistedText = await readFile(join(root, 'state.json'), 'utf8')
    expect(persistedText).not.toContain('iVBORw==')
    expect(persistedText).not.toContain(root)
    expect((await stat(join(root, 'attachments', attachment.id))).mode & 0o777).toBe(0o600)
  })

  it('rejects active image formats before accepting the message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-image-reject-'))
    roots.push(root)
    const runAgent = vi.fn(async () => ({ text: 'Unexpected.' }))
    const running = await startCommonspaceServer({
      root,
      port: 0,
      dependencies: { discoverAgents: async () => [], runAgent },
      logger: { warn: () => undefined, info: () => undefined },
    })
    servers.push(running)
    await addTestCodexAgents(running.service, 'codex-review-bot')

    const response = await post(running, '/api/send', {
      conversation: { kind: 'dm', id: 'codex-review-bot' },
      text: 'Inspect this',
      attachments: [{ name: 'active.svg', mimeType: 'image/svg+xml', data: 'PHN2Zz4=' }],
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'unsupported image type' })
    expect(runAgent).not.toHaveBeenCalled()
  })
})
