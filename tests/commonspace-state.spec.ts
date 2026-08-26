import { describe, expect, it } from 'vitest'
import { applyMutation, createInitialState } from '../server/src/state.ts'

describe('Commonspace local state', () => {
  it('creates filesystem projects and channels with real agent membership', () => {
    const initial = createInitialState()
    const withProject = applyMutation(initial, {
      action: 'create-project',
      name: 'Checkout',
      paths: ['/Users/example/Developer/storefront', '/Users/example/Developer/api'],
    }, { ids: () => 'project-1', now: () => '2026-08-25T00:00:00.000Z' })
    const withChannel = applyMutation(withProject, {
      action: 'create-channel',
      name: 'checkout',
      projectId: 'project-1',
      agentIds: ['frontend', 'backend'],
    }, { ids: () => 'channel-1', now: () => '2026-08-25T00:00:01.000Z' })

    expect(withChannel.projects[0]).toMatchObject({
      id: 'project-1',
      name: 'Checkout',
      paths: ['/Users/example/Developer/storefront', '/Users/example/Developer/api'],
    })
    expect(withChannel.channels[0]).toMatchObject({
      id: 'channel-1',
      name: 'checkout',
      projectId: 'project-1',
      agentIds: ['frontend', 'backend'],
    })
    expect(withChannel.revision).toBe(2)
  })

  it('rejects project names that resolve to the same tag', () => {
    const state = applyMutation(createInitialState(), {
      action: 'create-project',
      name: 'Checkout App',
      paths: ['/tmp/checkout-a'],
    }, { ids: () => 'project-1', now: () => 'now' })

    expect(() => applyMutation(state, {
      action: 'create-project',
      name: 'checkout-app',
      paths: ['/tmp/checkout-b'],
    }, { ids: () => 'project-2', now: () => 'now' }))
      .toThrow('project name already exists')
  })

  it('removing a project detaches its channels without deleting room history', () => {
    const seeded = {
      ...createInitialState(),
      revision: 2,
      projects: [{ id: 'p', name: 'P', paths: ['/tmp/p'], createdAt: 'now' }],
      channels: [{ id: 'c', name: 'general', projectId: 'p', agentIds: [], instructions: '', memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null }, settings: { model: null, reasoning: null }, createdAt: 'now' }],
      messages: { 'channel:c': [] },
    }
    const next = applyMutation(seeded, { action: 'remove-project', projectId: 'p' })
    expect(next.projects).toHaveLength(0)
    expect(next.channels[0]?.projectId).toBeNull()
    expect(next.messages['channel:c']).toEqual([])
  })

  it('applies bounded defaults and per-channel overrides', () => {
    let state = createInitialState()
    state = applyMutation(state, { action: 'set-defaults', model: 'openai/gpt-5.2', reasoning: 'high', maxAgentsPerTurn: 99, memoryThreads: 0 })
    expect(state.defaults).toEqual({ model: 'openai/gpt-5.2', reasoning: 'high', maxAgentsPerTurn: 8, memoryThreads: 1 })
    state = applyMutation(state, { action: 'create-project', name: 'P', paths: ['/tmp/p'] }, { ids: () => 'p', now: () => 'now' })
    state = applyMutation(state, { action: 'create-channel', name: 'general', projectId: 'p', agentIds: [] }, { ids: () => 'c', now: () => 'now' })
    state = applyMutation(state, { action: 'set-channel-settings', channelId: 'c', model: null, reasoning: null })
    expect(state.channels[0]?.settings).toEqual({ model: null, reasoning: null })
  })

  it('rejects unsupported reasoning values at the runtime mutation boundary', () => {
    const state = createInitialState()
    expect(() => applyMutation(state, { action: 'set-defaults', reasoning: 'high"; malicious=true' } as never))
      .toThrow('unsupported reasoning')
  })

  it('adds and removes managed CLI agents with their channel and session state', () => {
    let state = createInitialState()
    state = applyMutation(state, {
      action: 'add-agent',
      displayName: 'Review Bot',
      adapter: 'codex',
      model: '  gpt-5.4  ',
    }, { ids: () => 'unused', now: () => '2026-08-25T01:00:00.000Z' })

    expect(state.agents).toEqual([{
      id: 'codex-review-bot',
      displayName: 'Review Bot',
      adapter: 'codex',
      model: 'gpt-5.4',
      createdAt: '2026-08-25T01:00:00.000Z',
    }])

    const seeded = {
      ...state,
      channels: [{
        id: 'channel-1',
        name: 'general',
        projectId: null,
        agentIds: ['codex-review-bot'],
        instructions: '',
        memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
        settings: { model: null, reasoning: null },
        createdAt: 'now',
      }],
      agentSessions: {
        'codex-review-bot': { 'Bot Chat': '123e4567-e89b-42d3-a456-426614174000' },
      },
      messages: { 'dm:codex-review-bot': [] },
    }
    const removed = applyMutation(seeded, { action: 'remove-agent', agentId: 'codex-review-bot' })

    expect(removed.agents).toEqual([])
    expect(removed.channels[0]?.agentIds).toEqual([])
    expect(removed.agentSessions).toEqual({})
    expect(removed.messages).toEqual({})
  })

  it('removes native thread sessions with a deleted channel while preserving DMs', () => {
    const threadId = '123e4567-e89b-42d3-a456-426614174000'
    const sessionId = '223e4567-e89b-42d3-a456-426614174000'
    const state = {
      ...createInitialState(),
      channels: [{
        id: 'channel-1',
        name: 'general',
        projectId: null,
        agentIds: ['codex-review-bot'],
        instructions: '',
        memory: { summary: '', decisions: [], openQuestions: [], threadIds: [threadId], updatedAt: null },
        settings: { model: null, reasoning: null },
        createdAt: 'now',
      }],
      threads: [{
        id: threadId,
        channelId: 'channel-1',
        projectId: null,
        rootMessageId: 'root-1',
        agentIds: ['codex-review-bot'],
        status: 'complete' as const,
        createdAt: 'now',
        updatedAt: 'now',
      }],
      agentSessions: {
        'codex-review-bot': {
          'Bot Chat': sessionId,
          [`Commonspace Thread: ${threadId}`]: sessionId,
        },
      },
    }

    expect(applyMutation(state, { action: 'remove-channel', channelId: 'channel-1' }).agentSessions).toEqual({
      'codex-review-bot': { 'Bot Chat': sessionId },
    })
  })
})
