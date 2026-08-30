// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../ui/src/CommonspaceConversation.tsx'

function renderDirectMessage() {
  const send = vi.fn(async () => undefined)
  const mutate = vi.fn(async () => undefined)
  const stopAgentRuns = vi.fn(async () => ['codex-review-bot'])
  const snapshot = {
    bootstrap: {
      agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-5.4', status: 'unknown' }],
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
        messages: {
          'dm:codex-review-bot': [{
            id: 'message-1',
            conversation: { kind: 'dm', id: 'codex-review-bot' },
            authorType: 'user',
            authorId: 'user',
            authorName: 'Ralph',
            text: 'Please review this',
            createdAt: '2026-08-25T00:00:00.000Z',
          }],
        },
      },
    },
    loading: false,
    sending: false,
    error: null,
    activeConversation: { kind: 'dm', id: 'codex-review-bot' },
    activeProjectId: null,
    activeThreadId: null,
  } as const
  const store = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    messages: () => snapshot.bootstrap.state.messages['dm:codex-review-bot'],
    send,
    mutate,
    stopAgentRuns,
    selectThread: vi.fn(),
  }
  render(<CommonspaceConversation store={store as never} />)
  return { mutate, send, stopAgentRuns }
}

afterEach(cleanup)
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn() })

describe('Commonspace composer commands', () => {
  it('opens a command menu from slash and shows local status without messaging the agent', () => {
    const { send } = renderDirectMessage()
    const composer = screen.getByLabelText('Message Review Bot')

    fireEvent.change(composer, { target: { value: '/' } })
    const listbox = screen.getByRole('listbox', { name: 'Slash commands' })
    expect(listbox.id).not.toBe('')
    expect(composer.getAttribute('aria-controls')).toBe(listbox.id)
    expect(composer.getAttribute('aria-activedescendant')).toContain(`${listbox.id}-option-`)
    expect(screen.getByRole('option', { name: /\/help/i })).toBeTruthy()
    expect(screen.getByRole('option', { name: /\/new/i })).toBeTruthy()

    fireEvent.change(composer, { target: { value: '/sta' } })
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect((composer as HTMLTextAreaElement).value).toBe('/status')
    expect(send).not.toHaveBeenCalled()
    fireEvent.keyDown(composer, { key: 'Enter' })

    expect(screen.getByRole('status', { name: 'Command result' }).textContent).toContain('Review Bot')
    expect(screen.getByRole('status', { name: 'Command result' }).textContent).toContain('Codex')
    expect(send).not.toHaveBeenCalled()
  })

  it('retries the latest user turn without sending the slash command', async () => {
    const { send } = renderDirectMessage()
    const composer = screen.getByLabelText('Message Review Bot')

    fireEvent.change(composer, { target: { value: '/retry' } })
    fireEvent.submit(composer.closest('form')!)

    await waitFor(() => { expect(send).toHaveBeenCalledWith('Please review this') })
    expect(send).not.toHaveBeenCalledWith('/retry')
  })

  it('stops the work associated with the latest message', async () => {
    const { stopAgentRuns, send } = renderDirectMessage()
    const composer = screen.getByLabelText('Message Review Bot')

    fireEvent.change(composer, { target: { value: '/stop' } })
    fireEvent.submit(composer.closest('form')!)

    await waitFor(() => { expect(stopAgentRuns).toHaveBeenCalledWith('message-1') })
    expect(send).not.toHaveBeenCalledWith('/stop')
  })

  it('confirms before starting a fresh direct-message session', async () => {
    const { mutate } = renderDirectMessage()
    const composer = screen.getByLabelText('Message Review Bot')

    fireEvent.change(composer, { target: { value: '/new' } })
    fireEvent.submit(composer.closest('form')!)

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('status', { name: 'Command result' }).textContent).toContain('keeps earlier messages visible')
    fireEvent.click(screen.getByRole('button', { name: 'Start new chat' }))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'reset-dm', agentId: 'codex-review-bot' })
    })
  })

  it('does not forward an unknown slash command to the agent', () => {
    const { send } = renderDirectMessage()
    const composer = screen.getByRole('textbox', { name: 'Message Review Bot' })
    fireEvent.change(composer, { target: { value: '/does-not-exist' } })
    fireEvent.submit(composer.closest('form')!)

    expect(screen.getByRole('alert', { name: 'Command result' }).textContent).toContain('Unknown command')
    expect(send).not.toHaveBeenCalled()
  })
})
