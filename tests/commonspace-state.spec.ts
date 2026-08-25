import { describe, expect, it } from 'vitest'
import { applyMutation, createInitialState } from '../src/host/state.ts'

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
})
