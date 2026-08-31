// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../ui/src/CommonspaceConversation.tsx'
import { CommonspaceSidebar } from '../ui/src/CommonspaceSidebar.tsx'

afterEach(cleanup)

describe('Commonspace direct messages', () => {
  it('shows when a direct-message agent is responding', () => {
    Element.prototype.scrollIntoView = vi.fn()
    const messages = [{
      id: 'message-1',
      conversation: { kind: 'dm' as const, id: 'frontend' },
      authorType: 'user' as const,
      authorId: 'user',
      authorName: 'Ralph',
      text: 'Please review this.',
      createdAt: '2026-08-26T00:00:00.000Z',
      replyStatus: 'running' as const,
    }]
    const snapshot = {
      bootstrap: {
        agents: [{ id: 'frontend', displayName: 'Frontend', adapter: 'codex' as const, model: 'gpt-5.6-luna', status: 'stopped' as const }],
        liveActivities: [{
          id: 'run-1',
          sourceMessageId: 'message-1',
          agentId: 'frontend',
          agentName: 'Frontend',
          adapter: 'codex' as const,
          conversation: { kind: 'dm' as const, id: 'frontend' },
          startedAt: '2026-08-26T00:00:01.000Z',
          entries: [],
        }],
        queuedFollowups: [{
          messageId: 'message-2',
          conversation: { kind: 'dm' as const, id: 'frontend' },
          agentIds: ['frontend'],
          text: 'Then check the narrow layout.',
          position: 0,
          createdAt: '2026-08-26T00:00:02.000Z',
          delivery: 'queue' as const,
        }],
        state: {
          version: 9,
          revision: 2,
          defaults: { model: null, reasoning: 'max' as const, maxAgentsPerTurn: 2, memoryThreads: 12 },
          agents: [],
          dmSessions: {},
          agentSessions: {},
          projects: [
            { id: 'project-1', name: 'Commonspace', paths: [], createdAt: '2026-08-26T00:00:00.000Z' },
            { id: 'project-2', name: 'API', paths: [], createdAt: '2026-08-26T00:00:00.000Z' },
          ],
          channels: [],
          threads: [],
          messages: { 'dm:frontend': messages },
        },
      },
      loading: false,
      sending: false,
      error: null,
      activeConversation: { kind: 'dm' as const, id: 'frontend' },
      activeProjectId: null,
      activeThreadId: null,
    }
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      messages: () => messages,
      send: vi.fn(),
      mutate: vi.fn(),
      stopAgentRuns: vi.fn(async () => ['frontend']),
      reorderFollowup: vi.fn(),
      removeFollowup: vi.fn(),
      selectThread: vi.fn(),
    }

    render(<CommonspaceConversation store={store as never} />)

    const activity = screen.getByRole('status', { name: 'Live agent activity' })
    expect(activity.textContent).toContain('Frontend')
    expect(activity.textContent).toContain('Waiting for Codex activity…')
    expect(screen.queryByText('Frontend is responding…')).toBeNull()
    const stop = screen.getByRole('button', { name: 'Stop Frontend' })
    expect(screen.getByRole('button', { name: 'Frontend activity' }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(stop)
    expect(store.stopAgentRuns).toHaveBeenCalledWith('message-1', 'frontend')
    expect(screen.getByRole('region', { name: 'Queued follow-ups' }).textContent).toContain('Then check the narrow layout.')
    fireEvent.click(screen.getByRole('button', { name: 'Remove queued follow-up' }))
    expect(store.removeFollowup).toHaveBeenCalledWith('message-2')

    fireEvent.change(screen.getByRole('textbox', { name: 'Message Frontend' }), { target: { value: 'Use this direction instead.' } })
    expect(screen.queryByRole('button', { name: 'Choose Projects' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop and send' }))
    fireEvent.submit(screen.getByRole('textbox', { name: 'Message Frontend' }).closest('form')!)
    expect(store.send).toHaveBeenCalledWith('Use this direction instead.', undefined, [], 'stop-and-send')
  })

  it('starts a direct message from the Agents section with configuration beside each agent', () => {
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'openai/gpt-5.4', status: 'running' as const },
      { id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex' as const, model: 'gpt-5.4', status: 'unknown' as const },
    ]
    const selectConversation = vi.fn()
    const snapshot = {
      bootstrap: {
        agents,
        state: {
          version: 9,
          revision: 1,
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
      activeConversation: { kind: 'dm' as const, id: 'backend' },
      activeProjectId: null,
      activeThreadId: null,
    }
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined),
      mutate: vi.fn(async () => undefined),
      selectConversation,
      selectProject: vi.fn(),
    }

    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    expect(screen.queryByText('Direct Messages')).toBeNull()
    const backend = screen.getByRole('button', { name: 'Message agent Backend' })
    expect(backend.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Customize agent Backend' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Customize agent Review Bot' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Message agent Review Bot' }))

    expect(selectConversation).toHaveBeenCalledWith({ kind: 'dm', id: 'codex-review-bot' })
  })
})
