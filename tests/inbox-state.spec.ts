import { deriveCommonspaceInboxItems } from '@commonspace/shared'
import { describe, expect, it } from 'vitest'
import { applyMutation, createInitialState } from '../server/src/state.ts'

describe('Commonspace Inbox state', () => {
  it('marks a pending permission Inbox item read by its source message', () => {
    const state = {
      ...createInitialState(),
      agents: [{ id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: null, createdAt: 'now' }],
      messages: {
        'dm:backend': [{
          id: 'request-1',
          conversation: { kind: 'dm' as const, id: 'backend' },
          authorType: 'user' as const,
          authorId: 'user',
          authorName: 'Ralph',
          text: 'Run it.',
          createdAt: '2026-08-27T09:00:00.000Z',
        }],
      },
      permissions: [{
        id: 'permission-1',
        sourceMessageId: 'request-1',
        agentId: 'backend',
        conversation: { kind: 'dm' as const, id: 'backend' },
        toolCallId: 'call-1',
        title: 'Run command',
        options: [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }],
        status: 'pending' as const,
        createdAt: '2026-08-27T09:01:00.000Z',
        resolvedAt: null,
      }],
    }

    const next = applyMutation(state, { action: 'mark-inbox-item-read', messageId: 'request-1' })

    expect(deriveCommonspaceInboxItems(next)[0]?.unread).toBe(false)
  })

  it('persists follow, mute, and save-for-later independently', () => {
    const state = {
      ...createInitialState(),
      agents: [{ id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: null, createdAt: 'now' }],
      messages: {
        'dm:backend': [{
          id: 'reply-1',
          sourceMessageId: 'request-1',
          conversation: { kind: 'dm' as const, id: 'backend' },
          authorType: 'agent' as const,
          authorId: 'backend',
          authorName: 'Backend',
          text: 'Done.',
          createdAt: '2026-08-27T09:00:00.000Z',
        }],
      },
    }

    const saved = applyMutation(state, { action: 'set-inbox-item-saved', messageId: 'reply-1', saved: true })
    const followed = applyMutation(saved, { action: 'set-session-followed', sessionId: 'request-1:backend', followed: true })
    const muted = applyMutation(followed, { action: 'set-session-muted', sessionId: 'request-1:backend', muted: true })

    expect(muted).toMatchObject({
      inboxSavedItemIds: ['reply-1'],
      followedSessionIds: [],
      mutedSessionIds: ['request-1:backend'],
    })
    expect(deriveCommonspaceInboxItems(muted)[0]).toMatchObject({ saved: true, muted: true, unread: false })
  })

  it('marks one agent reply read without clearing a different unread reply', () => {
    const state = {
      ...createInitialState(),
      messages: {
        'dm:backend': [
          {
            id: 'reply-1',
            conversation: { kind: 'dm' as const, id: 'backend' },
            authorType: 'agent' as const,
            authorId: 'backend',
            authorName: 'Backend',
            text: 'First reply.',
            createdAt: '2026-08-27T09:00:00.000Z',
          },
          {
            id: 'reply-2',
            conversation: { kind: 'dm' as const, id: 'backend' },
            authorType: 'agent' as const,
            authorId: 'backend',
            authorName: 'Backend',
            text: 'Second reply.',
            createdAt: '2026-08-27T09:01:00.000Z',
          },
        ],
      },
    }

    const next = applyMutation(state, { action: 'mark-inbox-item-read', messageId: 'reply-2' } as never)
    const items = deriveCommonspaceInboxItems(next)

    expect(items.find(item => item.id === 'message:reply-2')?.unread).toBe(false)
    expect(items.find(item => item.id === 'message:reply-1')?.unread).toBe(true)
    expect(next.revision).toBe(1)
  })

  it('persists the read cursor when all Inbox activity is marked read', () => {
    const state = {
      ...createInitialState(),
      messages: {
        'dm:backend': [{
          id: 'reply-1',
          conversation: { kind: 'dm' as const, id: 'backend' },
          authorType: 'agent' as const,
          authorId: 'backend',
          authorName: 'Backend',
          text: 'Finished the review.',
          createdAt: '2026-08-27T09:00:00.000Z',
        }],
      },
    }

    expect(deriveCommonspaceInboxItems(state).filter(item => item.unread)).toHaveLength(1)

    const next = applyMutation(
      state,
      { action: 'mark-inbox-read' },
      { ids: () => 'unused', now: () => '2026-08-27T10:00:00.000Z' },
    )

    expect(next.inboxReadAt).toBe('2026-08-27T10:00:00.000Z')
    expect(deriveCommonspaceInboxItems(next).filter(item => item.unread)).toHaveLength(0)
    expect(next.revision).toBe(1)
  })
})
