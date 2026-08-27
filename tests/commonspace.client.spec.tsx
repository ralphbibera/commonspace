// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { COMMONSPACE_STATE_VERSION, type CommonspaceBootstrap, type CommonspaceState } from '@commonspace/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceSidebar } from '../ui/src/CommonspaceSidebar.tsx'
import { tagReferenceParts, tagSuggestions } from '../ui/src/tagging.ts'

afterEach(cleanup)

function state(overrides: Partial<CommonspaceState> = {}): CommonspaceState {
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: 0,
    defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
    agents: [],
    dmSessions: {},
    agentSessions: {},
    projects: [],
    channels: [],
    threads: [],
    messages: {},
    ...overrides,
  }
}

function sidebarStore(
  bootstrap: Partial<CommonspaceBootstrap> = {},
  additions: Record<string, unknown> = {},
) {
  const mutate = vi.fn(async () => undefined)
  const snapshot = {
    bootstrap: {
      agents: [],
      discoveredAgents: [],
      state: state(),
      ...bootstrap,
    },
    loading: false,
    sending: false,
    error: null,
    activeConversation: null,
    activeProjectId: null,
    activeThreadId: null,
  }
  return {
    mutate,
    store: {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined),
      mutate,
      selectConversation: vi.fn(),
      selectProject: vi.fn(),
      ...additions,
    },
  }
}

describe('Commonspace interface', () => {
  it('formats and suggests agent, project, and channel references', () => {
    expect(tagReferenceParts('Ask @backend about @@commonspace in #general')).toEqual([
      { text: 'Ask ', kind: 'text' },
      { text: '@backend', kind: 'agent' },
      { text: ' about ', kind: 'text' },
      { text: '@@commonspace', kind: 'project' },
      { text: ' in ', kind: 'text' },
      { text: '#general', kind: 'channel' },
    ])

    const bootstrap: CommonspaceBootstrap = {
      agents: [{ id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'x', status: 'running' }],
      discoveredAgents: [],
      state: state({
        projects: [{ id: 'project-1', name: 'Client Portal', paths: [], createdAt: '' }],
        channels: [{
          id: 'general',
          name: 'general',
          projectId: null,
          agentIds: [],
          instructions: '',
          memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
          settings: { model: null, reasoning: null },
          createdAt: '',
        }],
      }),
    }
    expect(tagSuggestions('Please ask @ba', bootstrap)).toEqual([
      { kind: 'agent', id: 'backend', label: 'Backend', token: '@backend' },
    ])
    expect(tagSuggestions('Please inspect @@client-p', bootstrap)).toEqual([
      { kind: 'project', id: 'project-1', label: 'Client Portal', token: '@@client-portal' },
    ])
  })

  it('searches channel history from a command dialog and opens the matching channel', () => {
    const { store } = sidebarStore({
      agents: [
        { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: null, status: 'running' },
        { id: 'backend', displayName: 'Backend', adapter: 'codex', model: null, status: 'unknown' },
      ],
      state: state({
        projects: [{ id: 'storefront', name: 'Storefront', paths: ['/work/storefront'], createdAt: '' }],
        channels: [{
          id: 'general',
          name: 'general',
          projectId: null,
          agentIds: ['frontend'],
          instructions: '',
          memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
          settings: { model: null, reasoning: null },
          createdAt: '',
        }],
        messages: {
          'channel:general': [{
            id: 'message-1',
            conversation: { kind: 'channel', id: 'general' },
            authorType: 'user',
            authorId: 'ralph',
            authorName: 'Ralph',
            text: 'The deployment plan is in the launch checklist.',
            createdAt: '2026-08-26T00:00:00.000Z',
          }],
        },
      }),
    })
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    expect(screen.getByRole('button', { name: 'Search Commonspace' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog', { name: 'Search everything' })).toBeTruthy()

    const search = screen.getByRole('searchbox', { name: 'Search all channels' })
    expect(document.activeElement).toBe(search)
    fireEvent.change(search, { target: { value: 'launch checklist' } })
    fireEvent.click(screen.getByRole('option', { name: /Open message in general/ }))

    expect(store.selectConversation).toHaveBeenCalledWith({ kind: 'channel', id: 'general' })
    expect(screen.queryByRole('dialog', { name: 'Search everything' })).toBeNull()
  })

  it('keeps the command palette result set bounded', () => {
    const channels = Array.from({ length: 30 }, (_, index) => ({
      id: `channel-${String(index)}`,
      name: `channel-${String(index)}`,
      projectId: null,
      agentIds: [],
      instructions: '',
      memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
      settings: { model: null, reasoning: null },
      createdAt: '',
    }))
    const { store } = sidebarStore({ state: state({ channels }) })
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(screen.getAllByRole('option')).toHaveLength(24)
  })

  it('contains modal focus and restores it to the control that opened the dialog', () => {
    const { store } = sidebarStore()
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)
    const trigger = screen.getByRole('button', { name: 'Add project' })
    trigger.focus()

    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Add a project' })
    const close = within(dialog).getByRole('button', { name: 'Close Add a project' })
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    expect(trigger.closest('[inert]')).not.toBeNull()

    cancel.focus()
    fireEvent.keyDown(cancel, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(cancel)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Add a project' })).toBeNull()
    expect(trigger.closest('[inert]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('creates a project from the local folder picker', async () => {
    const selectDirectory = vi.fn(async () => '/Users/example/Developer/storefront')
    const { store, mutate } = sidebarStore({}, { selectDirectory })
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose project folder' }))
    await waitFor(() => {
      expect((screen.getByLabelText('Project path') as HTMLInputElement).value)
        .toBe('/Users/example/Developer/storefront')
    })
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Storefront' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        action: 'create-project',
        name: 'Storefront',
        paths: ['/Users/example/Developer/storefront'],
      })
    })
  })

  it('creates an unbound channel', async () => {
    const { store, mutate } = sidebarStore()
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add channel' }))
    expect(screen.queryByLabelText('Channel project')).toBeNull()
    fireEvent.change(screen.getByLabelText('Channel name'), { target: { value: 'engineering' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'create-channel', name: 'engineering', agentIds: [] })
    })
  })

  it('manages Codex agents and explicitly selected Hermes profiles', async () => {
    const codexAgent = { id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex' as const, model: 'gpt-5.4', status: 'unknown' as const }
    const discoveredAgents = [
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: null, status: 'running' as const },
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: null, status: 'stopped' as const },
    ]
    const { store, mutate } = sidebarStore({
      agents: [codexAgent],
      discoveredAgents,
      state: state({
        agents: [{ ...codexAgent, createdAt: '2026-08-25T00:00:00.000Z' }],
      }),
    })
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add agent' }))
    fireEvent.change(screen.getByLabelText('Agent name'), { target: { value: 'Builder' } })
    fireEvent.change(screen.getByLabelText('Agent model'), { target: { value: 'gpt-5.4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'add-agent', displayName: 'Builder', adapter: 'codex', model: 'gpt-5.4' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add agent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add discovered agent Frontend' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove agent Review Bot' }))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'add-discovered-agent', agentId: 'frontend' })
      expect(mutate).toHaveBeenCalledWith({ action: 'remove-agent', agentId: 'codex-review-bot' })
    })
    expect(mutate).not.toHaveBeenCalledWith({ action: 'add-discovered-agent', agentId: 'backend' })
  })
})
