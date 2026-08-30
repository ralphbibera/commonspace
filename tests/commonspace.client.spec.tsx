// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { COMMONSPACE_STATE_VERSION, type CommonspaceBootstrap, type CommonspaceState } from '@commonspace/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceSidebar } from '../ui/src/CommonspaceSidebar.tsx'
import { commonspacePolish } from '../ui/src/polish.ts'
import { tagReferenceParts, tagSuggestions } from '../ui/src/tagging.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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
      discoverAgents: vi.fn(async () => undefined),
      mutate,
      selectConversation: vi.fn(),
      selectThread: vi.fn(),
      selectProject: vi.fn(),
      ...additions,
    },
  }
}

describe('Commonspace interface', () => {
  it('keeps each agent runtime status visible in the sidebar', () => {
    const style = document.createElement('style')
    style.textContent = commonspacePolish
    document.head.append(style)
    const agents = [
      { id: 'agentops', displayName: 'AgentOps', adapter: 'hermes' as const, model: 'gpt-test', status: 'unknown' as const },
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'gpt-test', status: 'stopped' as const },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'gpt-test', status: 'unknown' as const },
    ]
    const { store } = sidebarStore({
      agents,
      liveActivities: [{
        id: 'run-agentops',
        sourceMessageId: 'message-1',
        agentId: 'agentops',
        agentName: 'AgentOps',
        adapter: 'hermes',
        conversation: { kind: 'dm', id: 'agentops' },
        startedAt: '2026-08-28T00:00:00.000Z',
        entries: [],
      }],
    })

    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    expect(screen.getByText('online').getAttribute('data-status')).toBe('running')
    expect(screen.getByText('available').getAttribute('data-status')).toBe('stopped')
    expect(screen.getByText('configured').getAttribute('data-status')).toBe('unknown')
    expect(getComputedStyle(screen.getByText('online')).display).not.toBe('none')
    style.remove()
  })

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
      agents: [
        { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'x', status: 'running' },
        { id: 'default', displayName: 'AgentOps', adapter: 'hermes', model: 'x', status: 'running' },
        { id: 'codex-default', displayName: 'default (Codex)', adapter: 'codex', nativeProfile: 'default', model: 'x', status: 'unknown' },
      ],
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
    expect(tagReferenceParts('@anything', bootstrap)).toEqual([
      { text: '@anything', kind: 'text' },
    ])
    expect(tagReferenceParts('@backend @@client-portal #general', bootstrap)).toEqual([
      { text: '@backend', kind: 'agent' },
      { text: ' ', kind: 'text' },
      { text: '@@client-portal', kind: 'project' },
      { text: ' ', kind: 'text' },
      { text: '#general', kind: 'channel' },
    ])
    expect(tagSuggestions('Please ask @ba', bootstrap)).toEqual([
      { kind: 'agent', id: 'backend', label: 'Backend', token: '@backend' },
    ])
    expect(tagSuggestions('Please ask @ag', bootstrap)).toEqual([
      { kind: 'agent', id: 'default', label: 'AgentOps', token: '@agentops' },
    ])
    expect(tagSuggestions('Please ask @def', bootstrap)).toEqual([
      { kind: 'agent', id: 'codex-default', label: 'default (Codex)', token: '@default-codex' },
    ])
    expect(tagSuggestions('Please ask @all', bootstrap)).toEqual([
      { kind: 'agent', id: 'all', label: 'All agents', token: '@all' },
    ])
    expect(tagSuggestions('Please inspect @@client-p', bootstrap)).toEqual([
      { kind: 'project', id: 'project-1', label: 'Client Portal', token: '@@client-portal' },
    ])
  })

  it('searches unified history, highlights receipts, and opens the matching thread', async () => {
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
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      query: 'launch checklist',
      results: [{
        id: 'message:message-1',
        kind: 'message',
        title: 'Ralph',
        detail: 'The deployment plan is in the launch checklist.',
        receipt: '#general · Ralph · 2026-08-26T00:00:00.000Z',
        highlights: [{ field: 'detail', start: 30, end: 36 }, { field: 'detail', start: 37, end: 46 }],
        target: { kind: 'conversation', conversation: { kind: 'channel', id: 'general' }, threadId: 'thread-1', messageId: 'message-1' },
      }],
      appliedFilters: { kinds: [], projectId: null },
      truncated: false,
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    expect(screen.getByRole('button', { name: 'Search Commonspace' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog', { name: 'Search everything' })).toBeTruthy()

    const search = screen.getByRole('searchbox', { name: 'Search Commonspace' })
    expect(document.activeElement).toBe(search)
    fireEvent.change(search, { target: { value: 'launch checklist' } })
    const result = await screen.findByRole('option', { name: 'Open Message: Ralph' })
    expect(within(result).getAllByText(/launch|checklist/u, { selector: 'mark' })).toHaveLength(2)
    expect(within(result).getByText(/#general · Ralph/u)).toBeTruthy()
    fireEvent.click(result)

    expect(store.selectConversation).toHaveBeenCalledWith({ kind: 'channel', id: 'general' })
    expect(store.selectThread).toHaveBeenCalledWith('thread-1')
    expect(screen.queryByRole('dialog', { name: 'Search everything' })).toBeNull()
  })

  it('keeps the command palette result set bounded', async () => {
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
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      query: '',
      results: channels.slice(0, 24).map(channel => ({
        id: `channel:${channel.id}`,
        kind: 'channel',
        title: `#${channel.name}`,
        detail: 'Channel',
        receipt: `Channel · #${channel.name}`,
        highlights: [],
        target: { kind: 'conversation', conversation: { kind: 'channel', id: channel.id } },
      })),
      appliedFilters: { kinds: [], projectId: null },
      truncated: true,
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(await within(screen.getByRole('listbox', { name: 'Commonspace search results' })).findAllByRole('option')).toHaveLength(24)
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
    expect((screen.getByLabelText('Project name') as HTMLInputElement).value).toBe('storefront')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        action: 'create-project',
        name: 'storefront',
        paths: ['/Users/example/Developer/storefront'],
      })
    })
  })

  it('keeps a failed project form open without duplicating the application toast', async () => {
    const mutate = vi.fn(async () => { throw new Error('project name is required') })
    const { store } = sidebarStore({}, { mutate })
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    const dialog = screen.getByRole('dialog', { name: 'Add a project' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() => { expect(mutate).toHaveBeenCalledOnce() })
    expect(screen.getByRole('dialog', { name: 'Add a project' })).toBe(dialog)
    expect(within(dialog).queryByRole('alert')).toBeNull()
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

  it('manages discovered Codex agents and explicitly selected Hermes profiles', async () => {
    const codexAgent = { id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex' as const, model: 'gpt-5.4', status: 'unknown' as const }
    const discoveredAgents = [
      { id: 'codex-worker', displayName: 'worker', adapter: 'codex' as const, nativeProfile: 'worker', model: null, status: 'unknown' as const },
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
    fireEvent.change(screen.getByLabelText('Agent harness'), { target: { value: 'codex' } })
    await waitFor(() => {
      expect(store.discoverAgents).toHaveBeenCalledWith('codex')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add discovered agent worker' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add agent' }))
    fireEvent.change(screen.getByLabelText('Agent harness'), { target: { value: 'hermes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add discovered agent Frontend' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove agent Review Bot' }))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'add-discovered-agent', agentId: 'codex-worker' })
      expect(mutate).toHaveBeenCalledWith({ action: 'add-discovered-agent', agentId: 'frontend' })
      expect(mutate).toHaveBeenCalledWith({ action: 'remove-agent', agentId: 'codex-review-bot' })
    })
    expect(mutate).not.toHaveBeenCalledWith({ action: 'add-discovered-agent', agentId: 'backend' })
  })

  it('edits an agent workspace name and appearance without exposing its native profile as editable', async () => {
    const agent = { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'gpt-test', status: 'running' as const }
    const { store, mutate } = sidebarStore({
      agents: [agent],
      state: state({ agents: [{ ...agent, createdAt: '2026-08-25T00:00:00.000Z' }] }),
    })
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Customize agent Frontend' }))
    const dialog = screen.getByRole('dialog', { name: 'Customize Frontend' })
    expect(within(dialog).queryByLabelText(/native profile/i)).toBeNull()
    fireEvent.change(within(dialog).getByLabelText('Workspace name'), { target: { value: 'Atlas' } })
    fireEvent.change(within(dialog).getByLabelText('Avatar emoji'), { target: { value: '🧭' } })
    fireEvent.change(within(dialog).getByLabelText('Accent color'), { target: { value: '#7c3aed' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save appearance' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        action: 'update-agent-profile',
        agentId: 'frontend',
        displayName: 'Atlas',
        avatarEmoji: '🧭',
        accentColor: '#7c3aed',
      })
    })
  })

  it('edits fast mode when the native harness exposes it', async () => {
    const agent = { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'gpt-test', status: 'running' as const }
    const configuration = {
      agentId: agent.id,
      adapter: agent.adapter,
      model: 'gpt-test',
      reasoning: 'max' as const,
      fastMode: false,
      editable: true,
      instructions: 'Native instructions',
      memoryPolicy: { enabled: true, userProfileEnabled: true, writeApproval: 'ask' },
      permissions: { approvalMode: 'smart', secretRedaction: true },
      sessionHealth: { status: 'healthy' as const, activeSessions: 0, knownSessions: 1, lastRunAt: null },
      lastRuns: [],
      cost: { amount: 0, currency: null },
      capabilities: { tools: [], mcp: [], skills: [], services: [] },
      refreshedAt: '2026-08-28T00:00:00.000Z',
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => init?.method === 'PUT' ? { ...configuration, fastMode: true } : configuration,
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { store } = sidebarStore({
      agents: [agent],
      state: state({ agents: [{ ...agent, createdAt: '2026-08-25T00:00:00.000Z' }] }),
    })
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Customize agent Frontend' }))
    const fastMode = await screen.findByLabelText('Native fast mode')
    expect((fastMode as HTMLInputElement).checked).toBe(false)
    fireEvent.click(fastMode)
    fireEvent.click(screen.getByRole('button', { name: 'Save native configuration' }))

    await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(2) })
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      model: 'gpt-test',
      reasoning: 'max',
      fastMode: true,
      instructions: 'Native instructions',
      memoryPolicy: { enabled: true, userProfileEnabled: true, writeApproval: 'ask' },
      permissions: { approvalMode: 'smart', secretRedaction: true },
      toolStates: {},
    })
  })

  it('starts Hermes discovery only after selecting Hermes in the agent form', async () => {
    const discoverAgents = vi.fn(async () => undefined)
    const { store } = sidebarStore({}, { discoverAgents })
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add agent' }))
    expect(discoverAgents).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Agent harness'), { target: { value: 'hermes' } })

    await waitFor(() => {
      expect(discoverAgents).toHaveBeenCalledWith('hermes')
    })
    expect(screen.queryByRole('button', { name: 'Create agent' })).toBeNull()
  })
})
