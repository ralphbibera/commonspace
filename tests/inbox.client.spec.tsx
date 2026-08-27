// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  COMMONSPACE_STATE_VERSION,
  type CommonspaceBootstrap,
  type CommonspaceMutation,
  type CommonspaceState,
  type ConversationRef,
} from '@commonspace/shared'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CommonspaceApp } from '../ui/src/CommonspaceApp.tsx'

afterEach(cleanup)
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

function state(overrides: Partial<CommonspaceState> = {}): CommonspaceState {
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: 4,
    inboxReadAt: null,
    defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
    agents: [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: null, createdAt: '2026-08-27T08:00:00.000Z' },
      { id: 'reviewer', displayName: 'Reviewer', adapter: 'codex', model: null, createdAt: '2026-08-27T08:00:00.000Z' },
    ],
    dmSessions: {},
    agentSessions: {},
    projects: [],
    channels: [{
      id: 'general',
      name: 'general',
      projectId: null,
      agentIds: ['backend'],
      instructions: '',
      memory: { summary: '', decisions: [], openQuestions: [], threadIds: ['thread-1'], updatedAt: null },
      settings: { model: null, reasoning: null },
      createdAt: '2026-08-27T08:00:00.000Z',
    }],
    threads: [{
      id: 'thread-1',
      channelId: 'general',
      projectId: null,
      rootMessageId: 'root-1',
      agentIds: ['backend'],
      status: 'complete',
      createdAt: '2026-08-27T09:59:00.000Z',
      updatedAt: '2026-08-27T10:02:00.000Z',
    }],
    messages: {
      'channel:general': [{
        id: 'reply-thread',
        conversation: { kind: 'channel', id: 'general' },
        authorType: 'agent',
        authorId: 'backend',
        authorName: 'Backend',
        text: 'Thread result.',
        createdAt: '2026-08-27T10:01:00.000Z',
        threadId: 'thread-1',
        parentMessageId: 'root-1',
      }],
      'dm:reviewer': [{
        id: 'reply-dm',
        conversation: { kind: 'dm', id: 'reviewer' },
        authorType: 'agent',
        authorId: 'reviewer',
        authorName: 'Reviewer',
        text: 'Review complete.',
        createdAt: '2026-08-27T10:00:00.000Z',
      }],
    },
    ...overrides,
  }
}

function appStore(initialState: CommonspaceState, includeLiveActivity = true) {
  const listeners = new Set<() => void>()
  let snapshot = {
    bootstrap: {
      agents: initialState.agents.map(agent => ({ ...agent, status: 'unknown' as const })),
      discoveredAgents: [],
      state: initialState,
      liveActivities: includeLiveActivity ? [{
        id: 'run-live',
        agentId: 'backend',
        agentName: 'Backend',
        adapter: 'hermes' as const,
        conversation: { kind: 'channel' as const, id: 'general' },
        threadId: 'thread-1',
        startedAt: '2026-08-27T10:03:00.000Z',
        entries: [{
          type: 'tool' as const,
          id: 'tool-live',
          title: 'Run focused tests',
          status: 'in_progress' as const,
          createdAt: '2026-08-27T10:03:00.000Z',
          updatedAt: '2026-08-27T10:03:01.000Z',
        }],
      }] : [],
    } satisfies CommonspaceBootstrap,
    loading: false,
    sending: false,
    error: null,
    activeConversation: null as ConversationRef | null,
    activeProjectId: null as string | null,
    activeThreadId: null as string | null,
  }
  const emit = () => { for (const listener of listeners) listener() }
  const mutate = vi.fn(async (mutation: CommonspaceMutation) => {
    if (mutation.action !== 'mark-inbox-read') return
    snapshot = {
      ...snapshot,
      bootstrap: {
        ...snapshot.bootstrap,
        state: {
          ...snapshot.bootstrap.state,
          revision: snapshot.bootstrap.state.revision + 1,
          inboxReadAt: '2026-08-27T11:00:00.000Z',
        },
      },
    }
    emit()
  })
  const selectConversation = vi.fn((conversation: ConversationRef) => {
    snapshot = { ...snapshot, activeConversation: conversation, activeThreadId: null }
    emit()
  })
  const selectThread = vi.fn((threadId: string | null) => {
    snapshot = { ...snapshot, activeThreadId: threadId }
    emit()
  })
  return {
    mutate,
    selectConversation,
    selectThread,
    store: {
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined),
      connectEvents: vi.fn(),
      disconnectEvents: vi.fn(),
      discoverAgents: vi.fn(async () => undefined),
      mutate,
      selectConversation,
      selectThread,
      selectProject: vi.fn(),
      selectDirectory: vi.fn(async () => null),
      messages: vi.fn(() => []),
      send: vi.fn(async () => undefined),
    },
  }
}

describe('Commonspace Inbox', () => {
  it('marks Inbox activity read when an unread reply is opened', async () => {
    const { store, mutate } = appStore(state())
    render(<CommonspaceApp store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Inbox, 2 unread' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open thread reply from Backend in #general, unread' }))

    await waitFor(() => { expect(mutate).toHaveBeenCalledWith({ action: 'mark-inbox-read' }) })
  })

  it('opens from navigation, filters unread replies, marks them read, and opens a thread', async () => {
    const { store, mutate, selectConversation, selectThread } = appStore(state())
    render(<CommonspaceApp store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Inbox, 2 unread' }))

    const inbox = screen.getByRole('main', { name: 'Inbox' })
    expect(within(inbox).getByRole('heading', { name: 'Inbox' })).toBeTruthy()
    expect(within(inbox).queryByText('Run focused tests')).toBeNull()
    fireEvent.click(within(inbox).getByRole('button', { name: /^Unread/ }))
    expect(within(inbox).getAllByRole('listitem')).toHaveLength(2)

    fireEvent.click(within(inbox).getByRole('button', { name: 'Mark all read' }))
    await waitFor(() => { expect(mutate).toHaveBeenCalledWith({ action: 'mark-inbox-read' }) })
    expect(await within(inbox).findByText('You’re all caught up.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Inbox' })).toBeTruthy()

    fireEvent.click(within(inbox).getByRole('button', { name: 'All' }))
    fireEvent.click(within(inbox).getByRole('button', { name: 'Open thread reply from Backend in #general' }))

    expect(selectConversation).toHaveBeenCalledWith({ kind: 'channel', id: 'general' })
    expect(selectThread).toHaveBeenCalledWith('thread-1')
    expect(screen.queryByRole('main', { name: 'Inbox' })).toBeNull()
  })

  it('shows a meaningful empty state', () => {
    const { store } = appStore(state({ channels: [], threads: [], messages: {}, agents: [] }), false)
    render(<CommonspaceApp store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Inbox' }))

    expect(screen.getByText('No agent activity yet.')).toBeTruthy()
    expect(screen.getByText('Agent replies will appear here.')).toBeTruthy()
  })
})
