// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceSidebar } from '../src/client/CommonspaceSidebar.tsx'

afterEach(cleanup)

describe('Commonspace direct messages', () => {
  it('starts a direct message from a searchable agent picker', () => {
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'openai/gpt-5.4', status: 'running' as const },
      { id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex' as const, model: 'gpt-5.4', status: 'unknown' as const },
    ]
    const selectConversation = vi.fn()
    const snapshot = {
      bootstrap: {
        agents,
        state: {
          version: 6,
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

    expect(screen.getByRole('button', { name: 'Open direct message with Backend' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add direct message' }))
    const search = screen.getByLabelText('Find an agent to message')
    const listbox = screen.getByRole('listbox', { name: 'Agents available for direct messages' })
    expect(listbox.id).not.toBe('')
    expect(search.getAttribute('aria-controls')).toBe(listbox.id)
    fireEvent.change(search, { target: { value: 'review' } })
    expect(screen.queryByRole('button', { name: 'Start direct message with Backend' })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'Start direct message with Review Bot' }))

    expect(selectConversation).toHaveBeenCalledWith({ kind: 'dm', id: 'codex-review-bot' })
    expect(screen.queryByLabelText('Find an agent to message')).toBeNull()
  })
})
