import { describe, expect, it } from 'vitest'
import {
  COMMONSPACE_STATE_VERSION,
  deriveCommonspaceInboxItems,
  type CommonspaceState,
} from '@commonspace/shared'

function inboxState(): CommonspaceState {
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: 8,
    inboxReadAt: '2026-08-27T10:00:00.000Z',
    defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
    agents: [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: null, createdAt: '2026-08-27T08:00:00.000Z' },
      { id: 'reviewer', displayName: 'Reviewer', adapter: 'codex', model: null, createdAt: '2026-08-27T08:00:00.000Z' },
    ],
    dmSessions: { reviewer: 'Commonspace DM: private-native-scope' },
    agentSessions: { reviewer: { 'Bot Chat': 'private-native-session' } },
    projects: [{ id: 'project', name: 'App', paths: ['/Users/private/workspace'], createdAt: '2026-08-27T08:00:00.000Z' }],
    channels: [{
      id: 'general',
      name: 'general',
      projectId: 'project',
      agentIds: ['backend'],
      instructions: '',
      memory: { summary: '', decisions: [], openQuestions: [], threadIds: ['thread-1'], updatedAt: null },
      settings: { model: null, reasoning: null },
      createdAt: '2026-08-27T08:00:00.000Z',
    }],
    threads: [{
      id: 'thread-1',
      channelId: 'general',
      projectId: 'project',
      rootMessageId: 'root-1',
      agentIds: ['backend'],
      status: 'complete',
      createdAt: '2026-08-27T09:59:00.000Z',
      updatedAt: '2026-08-27T10:02:00.000Z',
    }],
    messages: {
      'channel:general': [
        {
          id: 'root-1',
          conversation: { kind: 'channel', id: 'general' },
          authorType: 'user',
          authorId: 'user',
          authorName: 'Ralph',
          text: 'Please investigate.',
          createdAt: '2026-08-27T09:59:00.000Z',
        },
        {
          id: 'reply-1',
          conversation: { kind: 'channel', id: 'general' },
          authorType: 'agent',
          authorId: 'backend',
          authorName: 'Backend',
          text: '  Found the issue and fixed it.  ',
          createdAt: '2026-08-27T10:01:00.000Z',
          threadId: 'thread-1',
          parentMessageId: 'root-1',
        },
      ],
      'dm:reviewer': [
        {
          id: 'reply-old',
          conversation: { kind: 'dm', id: 'reviewer' },
          authorType: 'agent',
          authorId: 'reviewer',
          authorName: 'Reviewer',
          text: 'Earlier reply.',
          createdAt: '2026-08-27T10:00:00.000Z',
        },
        {
          id: 'request-failed',
          conversation: { kind: 'dm', id: 'reviewer' },
          authorType: 'user',
          authorId: 'user',
          authorName: 'Ralph',
          text: 'Run the checks.',
          createdAt: '2026-08-27T10:03:00.000Z',
          replyStatus: 'error',
          replyError: 'Provider stopped unexpectedly.',
        },
      ],
    },
  }
}

describe('Commonspace Inbox items', () => {
  it('contains actual agent replies without thinking, failures, or duplicate completion status', () => {
    const items = deriveCommonspaceInboxItems(inboxState())

    expect(items.map(item => ({
      kind: item.kind,
      actor: item.actorName,
      conversation: item.conversationName,
      threadId: item.threadId,
      unread: item.unread,
    }))).toEqual([
      { kind: 'thread-reply', actor: 'Backend', conversation: '#general', threadId: 'thread-1', unread: true },
      { kind: 'agent-reply', actor: 'Reviewer', conversation: 'Reviewer', threadId: undefined, unread: false },
    ])
    expect(items.find(item => item.kind === 'thread-reply')?.text).toBe('Found the issue and fixed it.')
    expect(items.some(item => item.text === 'Please investigate.')).toBe(false)
    expect(JSON.stringify(items)).not.toContain('/Users/private')
    expect(JSON.stringify(items)).not.toContain('private-native')
  })

  it('treats malformed legacy timestamps as read once a valid cursor exists', () => {
    const state = inboxState()
    state.threads = []
    state.messages = {
      'dm:backend': [{
        id: 'legacy-agent-reply',
        conversation: { kind: 'dm', id: 'backend' },
        authorType: 'agent',
        authorId: 'backend',
        authorName: 'Backend',
        text: 'Legacy reply',
        createdAt: 'not-a-timestamp',
      }],
    }

    expect(deriveCommonspaceInboxItems(state)[0]?.unread).toBe(false)
  })
})
