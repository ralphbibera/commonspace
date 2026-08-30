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

async function loadState(
  version: number,
  inboxReadAt?: unknown,
  inboxReadMessageIds?: unknown,
  channels: unknown[] = [],
  attentionPreferences: Record<string, unknown> = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'commonspace-inbox-migration-'))
  roots.push(root)
  await writeFile(join(root, 'state.json'), JSON.stringify({
    version,
    revision: 7,
    ...(inboxReadAt === undefined ? {} : { inboxReadAt }),
    ...(inboxReadMessageIds === undefined ? {} : { inboxReadMessageIds }),
    ...attentionPreferences,
    defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
    agents: [{ id: 'backend', displayName: 'Backend', adapter: 'hermes', model: null, createdAt: '2026-08-27T08:00:00.000Z' }],
    dmSessions: {},
    agentSessions: {},
    projects: [],
    channels,
    threads: [],
    messages: {
      'dm:backend': [{
        id: 'reply-1',
        conversation: { kind: 'dm', id: 'backend' },
        authorType: 'agent',
        authorId: 'backend',
        authorName: 'Backend',
        text: 'Finished.',
        createdAt: '2026-08-27T10:01:00.000Z',
      }],
    },
  }))
  const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
  await service.initialize()
  return service.snapshot()
}

describe('Commonspace Inbox state migration', () => {
  it('migrates v12 without losing state and defaults missing read state', async () => {
    const state = await loadState(12)

    expect(state).toMatchObject({
      version: COMMONSPACE_STATE_VERSION,
      revision: 7,
      inboxReadAt: null,
      inboxReadMessageIds: [],
    })
  })

  it('migrates every prior state version without dropping channels', async () => {
    const channel = {
      id: 'channel-1',
      name: 'engineering',
      projectId: null,
      agentIds: ['backend'],
      instructions: 'Keep the room history.',
      memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
      settings: { model: null, reasoning: null },
      createdAt: '2026-08-27T09:00:00.000Z',
    }

    for (let version = 1; version < COMMONSPACE_STATE_VERSION; version += 1) {
      const state = await loadState(version, undefined, undefined, [channel])
      expect(state.channels, `state version ${String(version)}`).toEqual([{
        id: 'channel-1',
        name: 'engineering',
        agentIds: ['backend'],
        instructions: 'Keep the room history.',
        memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
        settings: { model: null, reasoning: null },
        createdAt: '2026-08-27T09:00:00.000Z',
      }])
    }
  })

  it('preserves only a valid persisted read cursor', async () => {
    const valid = await loadState(COMMONSPACE_STATE_VERSION, '2026-08-27T10:00:00.000Z')
    const malformed = await loadState(COMMONSPACE_STATE_VERSION, '/Users/private/native-session')

    expect(valid.inboxReadAt).toBe('2026-08-27T10:00:00.000Z')
    expect(malformed.inboxReadAt).toBeNull()
  })

  it('preserves only unique read IDs for persisted agent replies', async () => {
    const state = await loadState(COMMONSPACE_STATE_VERSION, null, ['reply-1', 'missing', 42, 'reply-1'])

    expect(state.inboxReadMessageIds).toEqual(['reply-1'])
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

  it('sanitizes and preserves attention preferences', async () => {
    const state = await loadState(COMMONSPACE_STATE_VERSION, null, [], [], {
      inboxSavedItemIds: ['reply-1', 'missing', 'reply-1'],
      followedSessionIds: ['reply-1:backend', 'reply-1:backend', 42],
      mutedSessionIds: ['other:backend', 42],
    })

    expect(state.inboxSavedItemIds).toEqual(['reply-1'])
    expect(state.followedSessionIds).toEqual(['reply-1:backend'])
    expect(state.mutedSessionIds).toEqual(['other:backend'])
  })
})
