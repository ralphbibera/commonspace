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

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

function state(overrides: Partial<CommonspaceState> = {}): CommonspaceState {
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: 4,
    inboxReadAt: null,
    inboxReadMessageIds: [],
    inboxSavedItemIds: [],
    followedSessionIds: [],
    mutedSessionIds: [],
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
      createdAt: '2026-08-27T09:59:00.000Z',
    }],
    messages: {
      'channel:general': [{
        id: 'root-1',
        conversation: { kind: 'channel', id: 'general' },
        authorType: 'user',
        authorId: 'user',
        authorName: 'Ralph',
        text: 'Please investigate this.',
        createdAt: '2026-08-27T09:59:00.000Z',
      }, {
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
        sourceMessageId: 'root-1',
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
    const current = snapshot.bootstrap.state
    let preferenceUpdate: Partial<CommonspaceState> = {}
    if (mutation.action === 'set-inbox-item-saved') {
      preferenceUpdate = { inboxSavedItemIds: mutation.saved ? [...current.inboxSavedItemIds, mutation.messageId] : current.inboxSavedItemIds.filter(id => id !== mutation.messageId) }
    } else if (mutation.action === 'set-session-followed') {
      preferenceUpdate = {
        followedSessionIds: mutation.followed ? [...current.followedSessionIds, mutation.sessionId] : current.followedSessionIds.filter(id => id !== mutation.sessionId),
        mutedSessionIds: mutation.followed ? current.mutedSessionIds.filter(id => id !== mutation.sessionId) : current.mutedSessionIds,
      }
    } else if (mutation.action === 'set-session-muted') {
      preferenceUpdate = {
        mutedSessionIds: mutation.muted ? [...current.mutedSessionIds, mutation.sessionId] : current.mutedSessionIds.filter(id => id !== mutation.sessionId),
        followedSessionIds: mutation.muted ? current.followedSessionIds.filter(id => id !== mutation.sessionId) : current.followedSessionIds,
      }
    } else if (mutation.action !== 'mark-inbox-read' && mutation.action !== 'mark-inbox-item-read') return
    snapshot = {
      ...snapshot,
      bootstrap: {
        ...snapshot.bootstrap,
        state: {
          ...snapshot.bootstrap.state,
          revision: snapshot.bootstrap.state.revision + 1,
          ...(mutation.action === 'mark-inbox-read'
            ? { inboxReadAt: '2026-08-27T11:00:00.000Z', inboxReadMessageIds: [] }
            : mutation.action === 'mark-inbox-item-read'
              ? { inboxReadMessageIds: [...snapshot.bootstrap.state.inboxReadMessageIds, mutation.messageId] }
              : preferenceUpdate),
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
      messages: vi.fn(() => snapshot.activeConversation === null
        ? []
        : snapshot.bootstrap.state.messages[`${snapshot.activeConversation.kind}:${snapshot.activeConversation.id}`] ?? []),
      send: vi.fn(async () => undefined),
    },
  }
}

describe('Commonspace Inbox', () => {
  it('opens an exact notification deep link on first load', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    window.history.replaceState(null, '', '/?conversation=channel&conversationId=general&threadId=thread-1&messageId=reply-thread')
    const { store, selectConversation, selectThread } = appStore(state(), false)

    render(<CommonspaceApp store={store as never} />)

    await waitFor(() => {
      expect(selectConversation).toHaveBeenCalledWith({ kind: 'channel', id: 'general' })
      expect(selectThread).toHaveBeenCalledWith('thread-1')
    })
    expect(await screen.findByText('Thread result.')).toBeTruthy()
    await waitFor(() => {
      expect(document.getElementById('csp-message-reply-thread')).not.toBeNull()
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    })
  })

  it('shows the unread Inbox count on its channel', () => {
    const { store } = appStore(state())
    render(<CommonspaceApp store={store as never} />)

    const channel = screen.getByRole('button', { name: 'Open channel general, 1 unread' })
    expect(within(channel).getByText('1')).toBeTruthy()
  })

  it('marks only the opened Inbox reply read', async () => {
    const { store, mutate } = appStore(state())
    render(<CommonspaceApp store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Inbox, 2 unread' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open completed from Backend in #general, unread' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'mark-inbox-item-read', messageId: 'reply-thread' })
      expect(mutate).not.toHaveBeenCalledWith({ action: 'mark-inbox-read' })
    })
    expect(screen.getByRole('button', { name: 'Open Inbox, 1 unread' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open Inbox, 1 unread' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unread 1' }))
    expect(screen.getByRole('button', { name: 'Open completed from Reviewer in Reviewer, unread' })).toBeTruthy()
    expect(screen.queryByText('Thread result.')).toBeNull()
  })

  it('opens from navigation, filters unread replies, marks them read, and opens a thread', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
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
    fireEvent.click(within(inbox).getByRole('button', { name: 'Open completed from Backend in #general' }))

    expect(selectConversation).toHaveBeenCalledWith({ kind: 'channel', id: 'general' })
    expect(selectThread).toHaveBeenCalledWith('thread-1')
    expect(screen.queryByRole('main', { name: 'Inbox' })).toBeNull()
    await waitFor(() => { expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' }) })
    expect(document.getElementById('csp-message-root-1')?.classList.contains('csp-thread-root--focused')).toBe(true)
  })

  it('shows a meaningful empty state', () => {
    const { store } = appStore(state({ channels: [], threads: [], messages: {}, agents: [] }), false)
    render(<CommonspaceApp store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Inbox' }))

    expect(screen.getByText('You’re all caught up.')).toBeTruthy()
    expect(screen.getByText('New agent activity will appear here.')).toBeTruthy()
  })

  it('saves attention items and supervises running, attention, and completed sessions', async () => {
    const failed = {
      id: 'failed-request',
      conversation: { kind: 'dm' as const, id: 'reviewer' },
      authorType: 'user' as const,
      authorId: 'user',
      authorName: 'Ralph',
      text: 'Run checks.',
      createdAt: '2026-08-27T10:02:00.000Z',
      replyStatus: 'error' as const,
      replyError: 'Provider timed out.',
    }
    const initial = state({ messages: { ...state().messages, 'dm:reviewer': [...state().messages['dm:reviewer']!, failed] } })
    const { store, mutate } = appStore(initial)
    render(<CommonspaceApp store={store as never} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Inbox, 3 unread' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Save for later' })[0]!)
    await waitFor(() => { expect(mutate).toHaveBeenCalledWith({ action: 'set-inbox-item-saved', messageId: 'failed-request', saved: true }) })
    fireEvent.click(screen.getByRole('button', { name: 'Saved' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /^Sessions/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Running' }))
    expect(screen.getByText('Run focused tests')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))
    await waitFor(() => { expect(mutate).toHaveBeenCalledWith({ action: 'set-session-followed', sessionId: 'root-1:backend', followed: true }) })

    fireEvent.click(screen.getByRole('button', { name: 'Needs attention' }))
    expect(screen.getByText('Provider timed out.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }))
    expect(screen.getByText('Review complete.')).toBeTruthy()
  })
})
