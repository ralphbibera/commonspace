// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../ui/src/CommonspaceConversation.tsx'
import { commonspacePolish } from '../ui/src/polish.ts'
import { commonspaceStyles } from '../ui/src/styles.ts'

function renderChannelThread(
  threadStatus: 'complete' | 'queued' | 'running' = 'complete',
  includeBackendActivity = false,
  threadOpen = true,
  routingPending = false,
  routingResolved = false,
) {
  const listeners = new Set<() => void>()
  const initialThreadId: string | null = threadOpen ? 'thread-1' : null
  const send = vi.fn(async () => undefined)
  const sendDirectReply = vi.fn(async () => undefined)
  const mutate = vi.fn(async () => undefined)
  const selectThread = vi.fn((threadId: string | null) => {
    snapshot = { ...snapshot, activeThreadId: threadId }
    for (const listener of listeners) listener()
  })
  const liveActivities = threadStatus === 'complete' ? [] : [{
    id: 'run-1',
    agentId: 'frontend',
    agentName: 'Frontend',
    adapter: 'hermes' as const,
    conversation: { kind: 'channel' as const, id: 'general' },
    threadId: 'thread-1',
    startedAt: '2026-08-26T00:00:01.000Z',
    entries: [{
      type: 'reasoning' as const,
      id: 'reasoning-1',
      text: 'Tracing the request through the UI.',
      createdAt: '2026-08-26T00:00:01.000Z',
      updatedAt: '2026-08-26T00:00:01.000Z',
    }, {
      type: 'tool' as const,
      id: 'tool-1',
      title: 'Inspecting repository',
      toolName: 'rg',
      status: 'in_progress' as const,
      createdAt: '2026-08-26T00:00:02.000Z',
      updatedAt: '2026-08-26T00:00:02.000Z',
    }],
  }, ...(includeBackendActivity ? [{
    id: 'run-2',
    agentId: 'backend',
    agentName: 'Backend',
    adapter: 'codex' as const,
    conversation: { kind: 'channel' as const, id: 'general' },
    threadId: 'thread-1',
    startedAt: '2026-08-26T00:00:03.000Z',
    entries: [{
      type: 'reasoning' as const,
      id: 'reasoning-2',
      text: 'Checking the API lifecycle.',
      createdAt: '2026-08-26T00:00:04.000Z',
      updatedAt: '2026-08-26T00:00:04.000Z',
    }],
  }] : [])]
  let snapshot = {
    bootstrap: {
      agents: [
        { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'unknown' },
        { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'test', status: 'unknown' },
        { id: 'reviewer', displayName: 'Reviewer', adapter: 'hermes', model: 'test', status: 'unknown' },
      ],
      liveActivities,
      state: {
        version: 9,
        revision: 1,
        inboxReadAt: null,
        inboxReadMessageIds: [],
        defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
        agents: [],
        dmSessions: {},
        agentSessions: {},
        projects: [{ id: 'project-1', name: 'Commonspace', paths: [], createdAt: '2026-08-26T00:00:00.000Z' }],
        channels: [{
          id: 'general',
          name: 'general',
          agentIds: ['frontend', 'backend'],
          instructions: '',
          memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
          settings: { model: null, reasoning: null },
          createdAt: '2026-08-26T00:00:00.000Z',
        }],
        threads: [{
          id: 'thread-1',
          channelId: 'general',
          projectId: null,
          rootMessageId: 'root-1',
          agentIds: ['frontend'],
          createdAt: '2026-08-26T00:00:00.000Z',
        }],
        messages: {
          'channel:general': [
            {
              id: 'root-1',
              conversation: { kind: 'channel', id: 'general' },
              authorType: 'user',
              authorId: 'user',
              authorName: 'Ralph',
              text: 'Start the investigation',
              createdAt: '2026-08-26T00:00:00.000Z',
              threadId: 'thread-1',
              ...(routingPending
                ? { routing: { source: 'ai' as const, status: 'pending' as const, agentIds: [], assignments: [], reason: 'Routing with inference.' } }
                : routingResolved
                  ? {
                      routing: {
                        source: 'ai' as const,
                        status: 'resolved' as const,
                        agentIds: ['frontend'],
                        assignments: [{
                          id: 'assignment-1',
                          agentId: 'frontend',
                          subRequest: 'Fix the UI boundary only.',
                          projectIds: ['project-1'],
                        }],
                        inferredProjectIds: ['project-1'],
                        reason: 'Frontend owns this boundary.',
                      },
                    }
                  : {}),
            },
            {
              id: 'reply-1',
              conversation: { kind: 'channel', id: 'general' },
              authorType: 'user',
              authorId: 'user',
              authorName: 'Ralph',
              text: 'Please investigate',
              createdAt: '2026-08-26T00:01:00.000Z',
              threadId: 'thread-1',
              parentMessageId: 'root-1',
            },
            {
              id: 'reply-2',
              conversation: { kind: 'channel', id: 'general' },
              authorType: 'agent',
              authorId: 'frontend',
              authorName: 'Frontend',
              text: 'I found the failing boundary.',
              createdAt: '2026-08-26T00:02:00.000Z',
              threadId: 'thread-1',
              parentMessageId: 'root-1',
            },
            {
              id: 'reply-3',
              conversation: { kind: 'channel', id: 'general' },
              authorType: 'agent',
              authorId: 'backend',
              authorName: 'Backend',
              text: 'The API path has the same boundary.',
              createdAt: '2026-08-26T00:03:00.000Z',
              threadId: 'thread-1',
              parentMessageId: 'root-1',
            },
          ],
        },
      },
    },
    loading: false,
    sending: false,
    error: null,
    activeConversation: { kind: 'channel', id: 'general' },
    activeProjectId: null,
    activeThreadId: initialThreadId,
  } as const
  const store = {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => snapshot,
    messages: () => snapshot.bootstrap.state.messages['channel:general'],
    send,
    sendDirectReply,
    mutate,
    selectThread,
  }
  render(<CommonspaceConversation store={store as never} />)
  return { mutate, selectThread, send, sendDirectReply }
}

afterEach(cleanup)
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLElement.prototype.scrollTo = vi.fn()
})

describe('Commonspace reply-thread composer', () => {

  it('shows routing state while an accepted message awaits inference', () => {
    renderChannelThread('complete', false, true, true)

    expect(screen.getAllByRole('status', { name: 'Routing message' }).map(element => element.textContent)).toEqual(['Routing…', 'Routing…'])
    expect(screen.getAllByText('Start the investigation')).toHaveLength(2)
  })

  it('shows inspectable routing assignments with scoped Projects', () => {
    renderChannelThread('complete', false, true, false, true)

    expect(screen.getAllByText('Fix the UI boundary only.')).toHaveLength(2)
    expect(screen.getAllByText('@Frontend · Commonspace · inferred')).toHaveLength(2)
  })

  it('opens at an equal split and lets the thread be widened by dragging', () => {
    const style = document.createElement('style')
    style.textContent = `${commonspaceStyles}\n${commonspacePolish}`
    document.head.append(style)
    renderChannelThread()

    const separator = screen.getByRole('separator', { name: 'Resize thread' })
    const layout = separator.parentElement as HTMLElement
    expect(layout.style.getPropertyValue('--csp-channel-width')).toBe('50fr')
    expect(layout.style.getPropertyValue('--csp-thread-width')).toBe('50fr')
    expect(getComputedStyle(layout).gridTemplateColumns)
      .toBe('minmax(0, var(--csp-channel-width, 50fr)) 6px minmax(0, var(--csp-thread-width, 50fr))')
    layout.getBoundingClientRect = vi.fn(() => ({
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }))

    fireEvent.pointerDown(separator, { clientX: 500, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 400, pointerId: 1 })
    fireEvent.pointerUp(window, { pointerId: 1 })

    expect(layout.style.getPropertyValue('--csp-channel-width')).toBe('40fr')
    expect(layout.style.getPropertyValue('--csp-thread-width')).toBe('60fr')
  })

  it('highlights the channel message for the thread currently in focus', () => {
    renderChannelThread()

    const root = document.getElementById('csp-message-root-1')
    expect(root?.classList.contains('csp-thread-root--focused')).toBe(true)
    expect(root?.getAttribute('aria-current')).toBe('true')
  })

  it('shows every agent who replied beside the thread reply count', () => {
    renderChannelThread()

    const threadSummary = screen.getByRole('button', { name: /3 replies/i })
    expect(threadSummary.querySelector('[aria-label="Frontend replied"]')).toBeTruthy()
    expect(threadSummary.querySelector('[aria-label="Backend replied"]')).toBeTruthy()
    expect(threadSummary.querySelectorAll('.csp-thread-agent-avatar')).toHaveLength(2)
  })

  it('shows a notification dot for unseen agent replies and marks them read when the thread opens', () => {
    const { mutate, selectThread } = renderChannelThread('complete', false, false)
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo)
    const scrollCallsBeforeOpen = scrollTo.mock.calls.length

    const threadSummary = screen.getByRole('button', { name: '3 replies, 2 unread' })
    expect(threadSummary.classList.contains('csp-thread-open--unread')).toBe(true)
    expect(within(threadSummary).getByText('2 new replies')).toBeTruthy()
    expect(threadSummary.querySelector('.csp-thread-unread-indicator')).toBeTruthy()

    fireEvent.click(threadSummary)

    expect(selectThread).toHaveBeenCalledWith('thread-1')
    expect(screen.getByRole('complementary', { name: 'Thread replies' })).toBeTruthy()
    expect(scrollTo).toHaveBeenCalledTimes(scrollCallsBeforeOpen + 1)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
    expect(mutate).toHaveBeenCalledWith({ action: 'mark-inbox-item-read', messageId: 'reply-2' })
    expect(mutate).toHaveBeenCalledWith({ action: 'mark-inbox-item-read', messageId: 'reply-3' })
    expect(mutate).not.toHaveBeenCalledWith({ action: 'mark-inbox-item-read', messageId: 'reply-1' })
  })

  it('shows only the responding agents as animated icons on an active reply thread', () => {
    renderChannelThread('running')

    const activity = screen.getAllByLabelText('Frontend is responding')
    expect(activity).toHaveLength(2)
    expect(activity.every(icon => icon.classList.contains('csp-thread-agent-avatar--responding'))).toBe(true)
    expect(screen.queryByLabelText('Backend is responding')).toBeNull()
    const liveActivity = screen.getByRole('status', { name: 'Live agent activity' })
    expect(liveActivity.textContent).toContain('Frontend')
    expect(liveActivity.textContent).toContain('Inspecting repository')
    expect(screen.queryByText('Agents are responding…')).toBeNull()
  })

  it('collapses live agent traces by default and shows one at a time when opened', () => {
    renderChannelThread('running', true)

    const frontend = screen.getByRole('button', { name: 'Frontend activity' })
    const backend = screen.getByRole('button', { name: 'Backend activity' })
    expect(frontend.getAttribute('aria-expanded')).toBe('false')
    expect(backend.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: 'Frontend live activity' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Backend live activity' })).toBeNull()

    fireEvent.click(frontend)

    expect(frontend.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('region', { name: 'Frontend live activity' }).textContent).toContain('Tracing the request through the UI.')

    fireEvent.click(backend)

    expect(frontend.getAttribute('aria-expanded')).toBe('false')
    expect(backend.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('region', { name: 'Frontend live activity' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Backend live activity' }).textContent).toContain('Checking the API lifecycle.')
  })

  it('allows the expanded live activity to close', () => {
    renderChannelThread('running')

    const frontend = screen.getByRole('button', { name: 'Frontend activity' })
    expect(frontend.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(frontend)

    expect(frontend.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(frontend)

    expect(frontend.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: 'Frontend live activity' })).toBeNull()
  })

  it('offers tag autocomplete and sends the selected tag in the active thread', async () => {
    const { send } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })

    fireEvent.change(composer, { target: { value: '@ba' } })
    const listbox = screen.getByRole('listbox', { name: 'Tag suggestions' })
    expect(composer.getAttribute('aria-controls')).toBe(listbox.id)
    expect(screen.getByRole('option', { name: /@backend/i })).toBeTruthy()

    fireEvent.keyDown(composer, { key: 'Enter' })
    expect((composer as HTMLTextAreaElement).value).toBe('@backend ')
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => { expect(send).toHaveBeenCalledWith('@backend', 'thread-1') })
  })

  it('separates agents outside the channel and explains that tagging adds them', () => {
    renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })

    fireEvent.change(composer, { target: { value: '@' } })

    expect(screen.getByText('In this channel')).toBeTruthy()
    expect(screen.getByText('Not in this channel · tagging adds them')).toBeTruthy()
    expect(screen.getByRole('option', { name: /@reviewer.*will be added/i })).toBeTruthy()
  })

  it('replies directly to the agent selected from a channel message', async () => {
    const { send, sendDirectReply } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo)
    const scrollCallsBeforeReply = scrollTo.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Reply directly to Frontend' }))

    expect(document.activeElement).toBe(composer)
    expect(scrollTo).toHaveBeenCalledTimes(scrollCallsBeforeReply + 1)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
    expect(screen.getByText('Replying to Frontend')).toBeTruthy()
    fireEvent.change(composer, { target: { value: 'Check that boundary again.' } })
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => {
      expect(sendDirectReply).toHaveBeenCalledWith('Check that boundary again.', 'thread-1', 'frontend')
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('scrolls the thread to the bottom when the Reply button sends a message', async () => {
    const { send } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })
    const messagesViewport = document.querySelector<HTMLElement>('.csp-thread-messages')!
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo)
    const scrollCallsBeforeReply = scrollTo.mock.calls.length
    Object.defineProperty(messagesViewport, 'scrollHeight', { configurable: true, value: 500 })
    messagesViewport.scrollTop = 0

    fireEvent.change(composer, { target: { value: 'A new thread reply.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))

    expect(messagesViewport.scrollTop).toBe(500)
    expect(scrollTo).toHaveBeenCalledTimes(scrollCallsBeforeReply + 1)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 500, behavior: 'auto' })
    await waitFor(() => { expect(send).toHaveBeenCalledWith('A new thread reply.', 'thread-1') })
  })

  it('offers slash commands and executes them in the active thread', async () => {
    const { send } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })

    fireEvent.change(composer, { target: { value: '/' } })
    expect(screen.getByRole('listbox', { name: 'Slash commands' })).toBeTruthy()
    expect(screen.getByRole('option', { name: /\/retry/i })).toBeTruthy()

    fireEvent.change(composer, { target: { value: '/ret' } })
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect((composer as HTMLTextAreaElement).value).toBe('/retry')
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => { expect(send).toHaveBeenCalledWith('Please investigate', 'thread-1') })
    expect(send).not.toHaveBeenCalledWith('/retry', 'thread-1')
  })
})
