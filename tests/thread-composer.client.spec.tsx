// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../ui/src/CommonspaceConversation.tsx'

function renderChannelThread(threadStatus: 'complete' | 'queued' | 'running' = 'complete') {
  const send = vi.fn(async () => undefined)
  const snapshot = {
    bootstrap: {
      agents: [
        { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'unknown' },
        { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'test', status: 'unknown' },
      ],
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
    mutate: vi.fn(async () => undefined),
    selectThread: vi.fn(),
  }
  render(<CommonspaceConversation store={store as never} />)
  return { send }
}

afterEach(cleanup)
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn() })

describe('Commonspace reply-thread composer', () => {
  it('shows only the responding agents as animated icons on an active reply thread', () => {
    renderChannelThread('running')

    const activity = screen.getAllByLabelText('Frontend is responding')
    expect(activity).toHaveLength(2)
    expect(activity.every(icon => icon.classList.contains('csp-thread-agent-avatar--responding'))).toBe(true)
    expect(screen.queryByLabelText('Backend is responding')).toBeNull()
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
