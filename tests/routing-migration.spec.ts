// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMMONSPACE_STATE_VERSION } from '@commonspace/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('routing state migration', () => {
  it('adds deterministic assignments to legacy resolved routing decisions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-migration-'))
    roots.push(root)
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 16,
      revision: 4,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [{ id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: null, createdAt: 'now' }],
      dmSessions: {},
      agentSessions: {},
      projects: [{ id: 'project-1', name: 'App', paths: ['/tmp/app'], createdAt: 'now' }],
      channels: [{
        id: 'general',
        name: 'general',
        agentIds: ['frontend'],
        instructions: '',
        memory: { summary: '', decisions: [], openQuestions: [], threadIds: ['thread-1'], updatedAt: null },
        settings: { model: null, reasoning: null },
        createdAt: 'now',
      }],
      threads: [{
        id: 'thread-1',
        channelId: 'general',
        projectIds: ['project-1'],
        projectId: 'project-1',
        rootMessageId: 'root-1',
        agentIds: ['frontend'],
        createdAt: 'now',
      }],
      messages: {
        'channel:general': [{
          id: 'root-1',
          conversation: { kind: 'channel', id: 'general' },
          authorType: 'user',
          authorId: 'user',
          authorName: 'Ralph',
          text: 'Fix the API.',
          createdAt: 'now',
          projectIds: ['project-1'],
          projectId: 'project-1',
          threadId: 'thread-1',
          routing: {
            source: 'ai',
            status: 'resolved',
            agentIds: ['frontend'],
            confidence: 0.9,
            reason: 'Backend work.',
          },
        }],
      },
    }))
    const service = new CommonspaceHostService({}, { root }, { discoverAgents: async () => [] })

    await service.initialize()

    const message = service.snapshot().messages['channel:general']?.[0]
    expect(service.snapshot().version).toBe(COMMONSPACE_STATE_VERSION)
    expect(message?.routing?.assignments).toEqual([{
      id: 'legacy:root-1:frontend',
      agentId: 'frontend',
      subRequest: 'Fix the API.',
      projectIds: ['project-1'],
    }])
    await service.close()
  })
})
