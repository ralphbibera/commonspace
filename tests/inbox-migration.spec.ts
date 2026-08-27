// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { COMMONSPACE_STATE_VERSION } from '@commonspace/shared'
import { CommonspaceHostService } from '../server/src/service.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function loadState(version: number, inboxReadAt?: unknown) {
  const root = await mkdtemp(join(tmpdir(), 'commonspace-inbox-migration-'))
  roots.push(root)
  await writeFile(join(root, 'state.json'), JSON.stringify({
    version,
    revision: 7,
    ...(inboxReadAt === undefined ? {} : { inboxReadAt }),
    defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
    agents: [],
    dmSessions: {},
    agentSessions: {},
    projects: [],
    channels: [],
    threads: [],
    messages: {},
  }))
  const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
  await service.initialize()
  return service.snapshot()
}

describe('Commonspace Inbox state migration', () => {
  it('migrates v9 without losing state and defaults a missing cursor', async () => {
    const state = await loadState(9)

    expect(state).toMatchObject({
      version: COMMONSPACE_STATE_VERSION,
      revision: 7,
      inboxReadAt: null,
    })
  })

  it('preserves only a valid persisted read cursor', async () => {
    const valid = await loadState(COMMONSPACE_STATE_VERSION, '2026-08-27T10:00:00.000Z')
    const malformed = await loadState(COMMONSPACE_STATE_VERSION, '/Users/private/native-session')

    expect(valid.inboxReadAt).toBe('2026-08-27T10:00:00.000Z')
    expect(malformed.inboxReadAt).toBeNull()
  })

  it('persists the read cursor across a service restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-inbox-cursor-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()
    await service.mutate({ action: 'mark-inbox-read' })
    const readAt = service.snapshot().inboxReadAt

    expect(readAt).not.toBeNull()
    const restarted = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await restarted.initialize()
    expect(restarted.snapshot()).toMatchObject({ inboxReadAt: readAt, revision: 1 })
  })
})
