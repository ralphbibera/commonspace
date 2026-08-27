// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../ui/src/CommonspaceConversation.tsx'

function renderChannelThread(
  threadStatus: 'complete' | 'queued' | 'running' = 'complete',
  includeBackendActivity = false,
) {
  const send = vi.fn(async () => undefined)
  const sendDirectReply = vi.fn(async () => undefined)
  const liveActivities = [{
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
  const snapshot = {
    bootstrap: {
      agents: [
        { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'unknown' },
        { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'test', status: 'unknown' },
      ],
      liveActivities,
      state: {
        version: 9,
        revision: 1,
        defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
        agents: [],
        dmSessions: {},
        agentSessions: {},
        projects: [{ id: 'project-1', name: 'Commonspace', paths: [], createdAt: '2026-08-26T00:00:00.000Z' }],
        channels: [{
          id: 'general',
          name: 'general',
          projectId: null,
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
          status: threadStatus,
          createdAt: '2026-08-26T00:00:00.000Z',
          updatedAt: '2026-08-26T00:01:00.000Z',
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
    activeThreadId: 'thread-1',
  } as const
  const store = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    messages: () => snapshot.bootstrap.state.messages['channel:general'],
    send,
    sendDirectReply,
    mutate: vi.fn(async () => undefined),
    selectThread: vi.fn(),
  }
  render(<CommonspaceConversation store={store as never} />)
  return { send, sendDirectReply }
}

afterEach(cleanup)
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn() })

describe('Commonspace reply-thread composer', () => {
  it('shows every agent who replied beside the thread reply count', () => {
    renderChannelThread()

    const threadSummary = screen.getByRole('button', { name: /3 replies/i })
    expect(threadSummary.querySelector('[aria-label="Frontend replied"]')).toBeTruthy()
    expect(threadSummary.querySelector('[aria-label="Backend replied"]')).toBeTruthy()
    expect(threadSummary.querySelectorAll('.csp-thread-agent-avatar')).toHaveLength(2)
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

  it('shows one live agent trace at a time and switches focus between agents', () => {
    renderChannelThread('running', true)

    const frontend = screen.getByRole('button', { name: 'Frontend activity' })
    const backend = screen.getByRole('button', { name: 'Backend activity' })
    expect(frontend.getAttribute('aria-expanded')).toBe('true')
    expect(backend.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('region', { name: 'Frontend live activity' }).textContent).toContain('Tracing the request through the UI.')
    expect(screen.queryByRole('region', { name: 'Backend live activity' })).toBeNull()

    fireEvent.click(backend)

    expect(frontend.getAttribute('aria-expanded')).toBe('false')
    expect(backend.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('region', { name: 'Frontend live activity' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Backend live activity' }).textContent).toContain('Checking the API lifecycle.')
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

  it('replies directly to the agent selected from a channel message', async () => {
    const { send, sendDirectReply } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })

    fireEvent.click(screen.getByRole('button', { name: 'Reply directly to Frontend' }))

    expect(document.activeElement).toBe(composer)
    expect(screen.getByText('Replying to Frontend')).toBeTruthy()
    fireEvent.change(composer, { target: { value: 'Check that boundary again.' } })
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => {
      expect(sendDirectReply).toHaveBeenCalledWith('Check that boundary again.', 'thread-1', 'frontend')
    })
    expect(send).not.toHaveBeenCalled()
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
