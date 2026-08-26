import { expect, it } from 'vitest'
import type { CommonspaceState } from '../packages/shared/src/contracts.ts'
import { projectChannelMemory } from '../server/src/memory.ts'

it('projects completed thread context into inspectable channel memory', () => {
  const state: CommonspaceState = {
    version: 6,
    revision: 4,
    defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
    agents: [],
    dmSessions: {},
    agentSessions: {},
    projects: [],
    channels: [{ id: 'general', name: 'general', projectId: null, agentIds: ['frontend'], instructions: '', memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null }, settings: { model: null, reasoning: null }, createdAt: '2026-08-25T00:00:00Z' }],
    threads: [{ id: 'thread-1', channelId: 'general', projectId: null, rootMessageId: 'root-1', agentIds: ['frontend'], status: 'complete', createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:01:00Z' }],
    messages: {
      'channel:general': [
        { id: 'root-1', conversation: { kind: 'channel', id: 'general' }, authorType: 'user', authorId: 'user', authorName: 'Ralph', text: 'Checkout fails after payment. Open question: Is state reset?', createdAt: '2026-08-25T00:00:00Z', threadId: 'thread-1' },
        { id: 'reply-1', conversation: { kind: 'channel', id: 'general' }, authorType: 'agent', authorId: 'frontend', authorName: 'Frontend', text: 'Decision: reset checkout state after success.', createdAt: '2026-08-25T00:01:00Z', threadId: 'thread-1', parentMessageId: 'root-1' },
      ],
    },
  }
  const memory = projectChannelMemory(state, 'general')
  expect(memory.summary).toContain('Checkout fails after payment')
  expect(memory.summary).toContain('Frontend: Decision: reset checkout state')
  expect(memory.decisions).toEqual(['reset checkout state after success.'])
  expect(memory.openQuestions).toContain('Is state reset?')
  expect(memory.threadIds).toEqual(['thread-1'])
})
