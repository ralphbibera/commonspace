// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceApp } from '../ui/src/CommonspaceApp.tsx'
import { mountCommonspace } from '../ui/src/main.tsx'

const emptySnapshot = {
  bootstrap: {
    agents: [],
    state: {
      version: 9,
      revision: 0,
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
  activeConversation: null,
  activeProjectId: null,
  activeThreadId: null,
} as const

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('standalone Commonspace application', () => {
  it('mounts navigation and conversations without host slots', () => {
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => emptySnapshot,
      refresh: vi.fn(async () => undefined),
      connectEvents: vi.fn(),
      disconnectEvents: vi.fn(),
      messages: () => [],
      mutate: vi.fn(async () => undefined),
      selectConversation: vi.fn(),
      selectProject: vi.fn(),
      selectThread: vi.fn(),
      send: vi.fn(async () => undefined),
    }

    const view = render(<CommonspaceApp store={store as never} />)

    expect(screen.getByLabelText('Commonspace application')).toBeTruthy()
    expect(screen.getByLabelText('Commonspace browser')).toBeTruthy()
    expect(screen.getByLabelText('Commonspace conversation')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull()
    expect(store.connectEvents).toHaveBeenCalledOnce()

    const navigation = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(navigation)
    expect(navigation.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByLabelText('Commonspace application').classList.contains('csp-app--nav-open')).toBe(true)

    view.unmount()
    expect(store.disconnectEvents).toHaveBeenCalledOnce()
  })

  it('shows application errors once as a toast', () => {
    const snapshot = { ...emptySnapshot, error: 'project name is required' }
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined),
      connectEvents: vi.fn(),
      disconnectEvents: vi.fn(),
      messages: () => [],
      mutate: vi.fn(async () => undefined),
      selectConversation: vi.fn(),
      selectProject: vi.fn(),
      selectThread: vi.fn(),
      send: vi.fn(async () => undefined),
    }

    render(<CommonspaceApp store={store as never} />)

    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toBe('project name is required')
    expect(alerts[0]?.classList.contains('csp-app-toast')).toBe(true)
  })

  it('configures one AI routing model for the whole Commonspace', async () => {
    const snapshot = {
      ...emptySnapshot,
      bootstrap: {
        ...emptySnapshot.bootstrap,
        agents: [{ id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'profile-model', status: 'stopped' as const }],
        routing: {
          provider: 'openai-compatible' as const,
          model: 'gpt-router',
          harnessAgentId: null,
          baseUrl: 'https://api.openai.com/v1',
          apiKeyConfigured: true,
        },
      },
    }
    const updateRoutingConfiguration = vi.fn(async () => undefined)
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined), connectEvents: vi.fn(), disconnectEvents: vi.fn(),
      messages: () => [], mutate: vi.fn(async () => undefined), updateRoutingConfiguration,
      selectConversation: vi.fn(), selectProject: vi.fn(), selectThread: vi.fn(), send: vi.fn(async () => undefined),
    }
    render(<CommonspaceApp store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Commonspace settings' }))
    expect(screen.getByRole('button', { name: 'Use OpenAI-compatible inference for routing' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Routing API key').getAttribute('placeholder')).toContain('Saved')
    fireEvent.change(screen.getByLabelText('Routing model'), { target: { value: 'gpt-4.1-mini' } })
    fireEvent.change(screen.getByLabelText('Routing API key'), { target: { value: 'new-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }))

    await waitFor(() => {
      expect(updateRoutingConfiguration).toHaveBeenCalledWith({
        provider: 'openai-compatible',
        model: 'gpt-4.1-mini',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'new-secret',
      })
    })
  })
  it('requires an inference-backed routing engine', async () => {
    const snapshot = {
      ...emptySnapshot,
      bootstrap: {
        ...emptySnapshot.bootstrap,
        agents: [{ id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'profile-model', status: 'stopped' as const }],
        routing: {
          provider: 'openai-compatible' as const,
          model: 'gpt-router',
          harnessAgentId: null,
          baseUrl: 'https://api.openai.com/v1',
          apiKeyConfigured: true,
        },
      },
    }
    const updateRoutingConfiguration = vi.fn(async () => undefined)
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined), connectEvents: vi.fn(), disconnectEvents: vi.fn(),
      messages: () => [], mutate: vi.fn(async () => undefined), updateRoutingConfiguration,
      selectConversation: vi.fn(), selectProject: vi.fn(), selectThread: vi.fn(), send: vi.fn(async () => undefined),
    }
    render(<CommonspaceApp store={store as never} />)

    fireEvent.click(screen.getByRole('button', { name: 'Commonspace settings' }))
    expect(screen.queryByRole('button', { name: 'Use local routing' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Agent run defaults' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use Backend agent for routing' }))
    expect(screen.queryByLabelText('Routing model')).toBeNull()
    expect(screen.queryByLabelText('Routing API key')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }))
    await waitFor(() => {
      expect(updateRoutingConfiguration).toHaveBeenLastCalledWith({ provider: 'harness', harnessAgentId: 'backend' })
    })
  })

  it('opens a search result at its channel root message instead of its thread', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const snapshot = {
      ...emptySnapshot,
      activeConversation: { kind: 'channel', id: 'general' } as const,
      bootstrap: {
        ...emptySnapshot.bootstrap,
        state: {
          ...emptySnapshot.bootstrap.state,
          channels: [{
            id: 'general', name: 'general', projectId: null, agentIds: [], instructions: '',
            memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
            settings: { model: null, reasoning: null }, createdAt: '',
          }],
          threads: [{
            id: 'thread-1', channelId: 'general', projectId: null, rootMessageId: 'root-1',
            agentIds: [], status: 'complete', createdAt: '', updatedAt: '',
          }],
          messages: {
            'channel:general': [
              {
                id: 'root-1', conversation: { kind: 'channel', id: 'general' }, authorType: 'user',
                authorId: 'user', authorName: 'Ralph', text: 'Main channel message', createdAt: '2026-08-26T00:00:00.000Z',
              },
              {
                id: 'reply-1', conversation: { kind: 'channel', id: 'general' }, authorType: 'agent',
                authorId: 'default', authorName: 'AgentOps', text: 'Unique searchable reply',
                threadId: 'thread-1', parentMessageId: 'root-1', createdAt: '2026-08-26T00:01:00.000Z',
              },
            ],
          },
        },
      },
    }
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined), connectEvents: vi.fn(), disconnectEvents: vi.fn(),
      messages: () => snapshot.bootstrap.state.messages['channel:general'], mutate: vi.fn(async () => undefined),
      selectConversation: vi.fn(), selectProject: vi.fn(), selectThread: vi.fn(), send: vi.fn(async () => undefined),
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      query: 'Unique searchable reply',
      results: [{
        id: 'message:reply-1', kind: 'message', title: 'AgentOps', detail: 'Unique searchable reply',
        receipt: '#general · AgentOps · 2026-08-26T00:01:00.000Z', highlights: [],
        target: { kind: 'conversation', conversation: { kind: 'channel', id: 'general' }, threadId: 'thread-1', messageId: 'root-1' },
      }],
      appliedFilters: { kinds: [], projectId: null }, truncated: false,
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    render(<CommonspaceApp store={store as never} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search Commonspace' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Commonspace' }), { target: { value: 'Unique searchable reply' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Open Message: AgentOps' }))

    await waitFor(() => { expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' }) })
    expect(store.selectConversation).toHaveBeenCalledWith({ kind: 'channel', id: 'general' })
    expect(document.getElementById('csp-message-root-1')?.classList.contains('csp-thread-root--focused')).toBe(true)
    expect(screen.queryByLabelText('Thread replies')).toBeNull()
  })

  it('boots into a normal DOM root with standalone styles', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const mounted = mountCommonspace(root)

    expect(document.querySelector('style[data-commonspace="standalone"]')).toBeTruthy()
    expect(root.querySelector('[aria-label="Commonspace application"]')).toBeTruthy()

    mounted.unmount()
    expect(document.querySelector('style[data-commonspace="standalone"]')).toBeNull()
  })

  it('follows the system dark color scheme with a complete dark palette', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const mounted = mountCommonspace(root)
    const styles = document.querySelector('style[data-commonspace="standalone"]')?.textContent ?? ''

    expect(styles).toContain('@media (prefers-color-scheme: dark)')
    expect(styles).toMatch(/color-scheme:\s*dark/)
    expect(styles).toMatch(/--csp-shell-bg:\s*#[0-9a-f]{6}/i)
    expect(styles).toMatch(/--dsw-alias-label-primary:\s*#[0-9a-f]{6}/i)
    expect(styles).toMatch(/--dsw-alias-bg-base:\s*#[0-9a-f]{6}/i)
    expect(styles).toMatch(/--dsw-alias-border-l2:\s*#[0-9a-f]{6}/i)

    mounted.unmount()
  })
})
