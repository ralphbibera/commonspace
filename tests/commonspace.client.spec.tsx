// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../ui/src/CommonspaceConversation.tsx'
import { CommonspaceSidebar } from '../ui/src/CommonspaceSidebar.tsx'
import { tagReferenceParts, tagSuggestions } from '../ui/src/tagging.ts'

afterEach(cleanup)

describe('Commonspace interface', () => {
  it('highlights supported references without changing message text', () => {
    expect(tagReferenceParts('Ask @backend about @@commonspace in #general')).toEqual([
      { text: 'Ask ', kind: 'text' },
      { text: '@backend', kind: 'agent' },
      { text: ' about ', kind: 'text' },
      { text: '@@commonspace', kind: 'project' },
      { text: ' in ', kind: 'text' },
      { text: '#general', kind: 'channel' },
    ])
  })

  it('suggests the active tag type from the current word', () => {
    expect(tagSuggestions('Please ask @ba', {
      agents: [{ id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'x', status: 'running' }],
      state: { version: 6, revision: 0, defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 }, agents: [], dmSessions: {}, agentSessions: {}, projects: [{ id: 'commonspace', name: 'Commonspace', paths: [], createdAt: '' }], channels: [{ id: 'general', name: 'general', projectId: null, agentIds: [], instructions: '', memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null }, settings: { model: null, reasoning: null }, createdAt: '' }], threads: [], messages: {} },
    })).toEqual([{ kind: 'agent', id: 'backend', label: 'Backend', token: '@backend' }])
  })

  it('suggests a readable name-derived project tag instead of its internal id', () => {
    expect(tagSuggestions('Please inspect @@client-p', {
      agents: [],
      state: { version: 6, revision: 0, defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 }, agents: [], dmSessions: {}, agentSessions: {}, projects: [{ id: '0d5a95f3-77a7-4412-937f-6aa57d2d62e6', name: 'Client Portal', paths: [], createdAt: '' }], channels: [], threads: [], messages: {} },
    })).toEqual([{
      kind: 'project',
      id: '0d5a95f3-77a7-4412-937f-6aa57d2d62e6',
      label: 'Client Portal',
      token: '@@client-portal',
    }])
  })


  it('creates channels without offering or sending a project binding', async () => {
    const mutate = vi.fn(async () => undefined)
    const snapshot = {
      bootstrap: {
        agents: [],
        state: {
          version: 6,
          revision: 1,
          defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
          agents: [],
          dmSessions: {},
          agentSessions: {},
          projects: [{ id: 'project-1', name: 'Commonspace', paths: [], createdAt: '2026-08-25T00:00:00.000Z' }],
          channels: [],
          threads: [],
          messages: {},
        },
      },
      loading: false,
      sending: false,
      error: null,
      activeConversation: null,
      activeProjectId: null,
      activeThreadId: null,
    } as const
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined),
      mutate,
      selectConversation: vi.fn(),
      selectProject: vi.fn(),
    }

    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add channel' }))

    expect(screen.queryByLabelText('Channel project')).toBeNull()
    fireEvent.change(screen.getByLabelText('Channel name'), { target: { value: 'engineering' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'create-channel', name: 'engineering', agentIds: [] })
    })
  })

  it('adds and removes managed Codex and Claude Code agents from the sidebar', async () => {
    const mutate = vi.fn(async () => undefined)
    const snapshot = {
      bootstrap: {
        agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-5.4', status: 'unknown' }],
        state: {
          version: 6,
          revision: 1,
          defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
          agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-5.4', createdAt: '2026-08-25T00:00:00.000Z' }],
          dmSessions: {},
          agentSessions: {},
          projects: [],
          channels: [],
          threads: [],
          messages: {},
        },
      },
      loading: false,
      sending: false,
      error: null,
      activeConversation: null,
      activeProjectId: null,
      activeThreadId: null,
    } as const
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined),
      mutate,
      selectConversation: vi.fn(),
      selectProject: vi.fn(),
    }
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)
    expect(screen.getByText('Codex CLI', { selector: '.csp-adapter-badge' })).toBeTruthy()
    expect(screen.getByText('configured', { selector: '.csp-agent-status' })).toBeTruthy()
    expect(document.querySelector('.csp-agent-avatar[data-adapter="codex"]')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add agent' }))
    fireEvent.change(screen.getByLabelText('Agent name'), { target: { value: 'Builder' } })
    fireEvent.change(screen.getByLabelText('Agent adapter'), { target: { value: 'claude-code' } })
    fireEvent.change(screen.getByLabelText('Agent model'), { target: { value: 'claude-sonnet-4-6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'add-agent', displayName: 'Builder', adapter: 'claude-code', model: 'claude-sonnet-4-6' })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove agent Review Bot' }))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'remove-agent', agentId: 'codex-review-bot' })
    })
  })

  it('presents the Commonspace product model in the empty conversation state', () => {
    const snapshot = {
      bootstrap: {
        agents: [],
        state: {
          version: 6,
          revision: 0,
          defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
          agents: [],
          dmSessions: {},
          agentSessions: {},
          projects: [],
          channels: [],
          threads: [],
          messages: {},
        },
      },
      loading: false,
      sending: false,
      error: null,
      activeConversation: null,
      activeProjectId: null,
      activeThreadId: null,
    } as const
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      messages: () => [],
      send: vi.fn(),
      selectThread: vi.fn(),
    }

    render(<CommonspaceConversation store={store as never} />)
    expect(screen.getByRole('heading', { name: 'Make space for the whole team.' })).toBeTruthy()
    expect(screen.getByText('Projects set context. Channels gather agents. Threads keep work focused.')).toBeTruthy()
  })

})
