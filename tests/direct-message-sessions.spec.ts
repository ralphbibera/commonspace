import { describe, expect, it } from 'vitest'
import { applyMutation, createInitialState } from '../src/host/state.ts'

describe('Commonspace direct-message sessions', () => {
  it('starts a fresh adapter session and clears only that DM transcript', () => {
    const previousSessionId = '123e4567-e89b-42d3-a456-426614174000'
    const seeded = {
      ...createInitialState(),
      agents: [{
        id: 'codex-review-bot',
        displayName: 'Review Bot',
        adapter: 'codex' as const,
        model: 'gpt-5.4',
        createdAt: '2026-08-25T00:00:00.000Z',
      }],
      agentSessions: {
        'codex-review-bot': { 'Bot Chat': previousSessionId },
      },
      messages: {
        'dm:codex-review-bot': [{
          id: 'message-1',
          conversation: { kind: 'dm' as const, id: 'codex-review-bot' },
          authorType: 'user' as const,
          authorId: 'ralph',
          authorName: 'Ralph',
          text: 'Old context',
          createdAt: '2026-08-25T00:00:00.000Z',
        }],
        'dm:other': [],
      },
    }

    const next = applyMutation(
      seeded,
      { action: 'reset-dm', agentId: 'codex-review-bot' } as never,
      { ids: () => '223e4567-e89b-42d3-a456-426614174000', now: () => '2026-08-25T01:00:00.000Z' },
    )

    expect(next.dmSessions).toEqual({
      'codex-review-bot': 'Commonspace DM: 223e4567-e89b-42d3-a456-426614174000',
    })
    expect(next.agentSessions).toEqual({})
    expect(next.messages).toEqual({ 'dm:other': [] })
    expect(next.revision).toBe(seeded.revision + 1)
  })
})
