import { deriveCommonspaceInboxItems } from '@commonspace/shared'
import { describe, expect, it } from 'vitest'
import { applyMutation, createInitialState } from '../server/src/state.ts'

describe('Commonspace Inbox state', () => {
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
