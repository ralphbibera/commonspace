// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMMONSPACE_STATE_VERSION, type CommonspaceBootstrap, type CommonspaceLiveAgentActivity } from '../packages/shared/src/contracts.ts'
import { CommonspaceClientStore } from '../ui/src/commonspace-store.ts'

function bootstrap(revision: number, projectName: string): CommonspaceBootstrap {
  return {
    agents: [],
    discoveredAgents: [],
    state: {
      version: COMMONSPACE_STATE_VERSION,
      revision,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [],
      dmSessions: {},
      agentSessions: {},
      projects: [{ id: `project-${revision}`, name: projectName, paths: ['/workspace'], createdAt: '2026-08-25T00:00:00.000Z' }],
      channels: [],
      threads: [],
      messages: {},
    },
  }
}

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

class FakeEventSource {
  static readonly instances: FakeEventSource[] = []
  private readonly listeners = new Map<string, (event: MessageEvent<string>) => void>()
  readonly close = vi.fn()
  onerror: ((event: Event) => void) | null = null
  onopen: ((event: Event) => void) | null = null

  constructor() {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener as (event: MessageEvent<string>) => void)
  }

  emit(type: string, data: string): void {
    this.listeners.get(type)?.({ data } as MessageEvent<string>)
  }
}

afterEach(() => {
  FakeEventSource.instances.length = 0
  vi.unstubAllGlobals()
})

describe('Commonspace client revision ordering', () => {
  it('clears a transient live-update error when SSE reconnects without a new revision', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(bootstrap(1, 'Initial'))))
    vi.stubGlobal('EventSource', FakeEventSource)

    const store = new CommonspaceClientStore()
    await store.refresh()
    store.connectEvents()
    const events = FakeEventSource.instances[0]!
    events.onerror?.(new Event('error'))
    expect(store.getSnapshot().error).toContain('disconnected')

    events.onopen?.(new Event('open'))
    expect(store.getSnapshot().error).toBeNull()
  })

  it('keeps live provider activity delivered before bootstrap refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(bootstrap(1, 'Initial'))))
    vi.stubGlobal('EventSource', FakeEventSource)

    const activity: CommonspaceLiveAgentActivity = {
      id: 'run-1',
      agentId: 'backend',
      agentName: 'Backend',
      adapter: 'codex',
      conversation: { kind: 'dm', id: 'backend' },
      startedAt: '2026-08-25T00:00:00.000Z',
      entries: [],
    }
    const store = new CommonspaceClientStore()
    store.connectEvents()
    FakeEventSource.instances[0]!.emit('activity', JSON.stringify({ activities: [activity] }))
    await store.refresh()

    expect(store.getSnapshot().bootstrap?.liveActivities).toEqual([activity])
  })

  it('ignores a stale refresh that resolves after a newer mutation', async () => {
    const staleRefresh = deferred<Response>()
    const mutation = deferred<Response>()
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(bootstrap(1, 'Initial')))
      .mockImplementationOnce(() => staleRefresh.promise)
      .mockImplementationOnce(() => mutation.promise)
    vi.stubGlobal('fetch', fetch)

    const store = new CommonspaceClientStore()
    await store.refresh()
    const refreshing = store.refresh()
    const mutating = store.mutate({ action: 'remove-project', projectId: 'missing' })

    mutation.resolve(response(bootstrap(2, 'Newest')))
    await mutating
    staleRefresh.resolve(response(bootstrap(1, 'Stale')))
    await refreshing

    expect(store.getSnapshot().bootstrap?.state.revision).toBe(2)
    expect(store.getSnapshot().bootstrap?.state.projects[0]?.name).toBe('Newest')
  })

  it('replaces the agent roster directly from a mutation response', async () => {
    const discovered = {
      id: 'codex',
      displayName: 'Codex',
      adapter: 'codex' as const,
      model: null,
      status: 'stopped' as const,
    }
    const initial = bootstrap(1, 'Initial')
    const updated = bootstrap(2, 'Initial')
    updated.agents = [discovered]
    updated.state.agents = [{
      id: discovered.id,
      displayName: discovered.displayName,
      adapter: discovered.adapter,
      model: discovered.model,
      createdAt: '2026-08-25T00:00:00.000Z',
    }]
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response(updated))
    vi.stubGlobal('fetch', fetch)

    const store = new CommonspaceClientStore()
    await store.refresh()
    await store.mutate({ action: 'add-discovered-agent', agentId: discovered.id })

    expect(store.getSnapshot().bootstrap?.agents).toEqual([discovered])
  })

  it('requests discovery for the selected harness and merges its candidates', async () => {
    const initial = bootstrap(1, 'Initial')
    const discovered = bootstrap(1, 'Initial')
    discovered.discoveredAgents = [{
      id: 'backend',
      displayName: 'Backend',
      adapter: 'hermes',
      model: 'gpt-test',
      status: 'stopped',
    }]
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response(discovered))
    vi.stubGlobal('fetch', fetch)

    const store = new CommonspaceClientStore()
    await store.refresh()
    await store.discoverAgents('hermes')

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/discover-agents', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ adapter: 'hermes' }),
    }))
    expect(store.getSnapshot().bootstrap?.discoveredAgents).toEqual(discovered.discoveredAgents)
  })

  it('includes the selected agent and inherits thread Projects when sending a direct channel reply', async () => {
    const initial = bootstrap(1, 'Initial')
    initial.state.channels = [{
      id: 'general',
      name: 'general',
      projectId: initial.state.projects[0]!.id,
      agentIds: ['frontend', 'backend'],
      instructions: '',
      memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
      settings: { model: null, reasoning: null },
      createdAt: '2026-08-25T00:00:00.000Z',
    }]
    const accepted = {
      id: 'reply-2',
      conversation: { kind: 'channel' as const, id: 'general' },
      authorType: 'user' as const,
      authorId: 'user',
      authorName: 'Ralph',
      text: 'Check that boundary again.',
      createdAt: '2026-08-25T00:01:00.000Z',
      threadId: 'thread-1',
      parentMessageId: 'root-1',
    }
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response({ accepted, state: initial.state }))
    vi.stubGlobal('fetch', fetch)

    const store = new CommonspaceClientStore()
    await store.refresh()
    store.selectConversation({ kind: 'channel', id: 'general' })
    await store.sendDirectReply('Check that boundary again.', 'thread-1', 'frontend')

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/send', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        conversation: { kind: 'channel', id: 'general' },
        text: 'Check that boundary again.',
        threadId: 'thread-1',
        targetAgentId: 'frontend',
      }),
    }))
  })

  it('posts a routing correction and merges the accepted state revision', async () => {
    const initial = bootstrap(1, 'Initial')
    const updated = bootstrap(2, 'Initial')
    const request = {
      sourceMessageId: 'root-1',
      assignmentId: 'assignment-1',
      agentId: 'reviewer',
      subRequest: 'Review only the UI boundary.',
      projectIds: ['project-1'],
    }
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response({
        sourceMessageId: request.sourceMessageId,
        assignment: { id: 'assignment-2', agentId: request.agentId, subRequest: request.subRequest, projectIds: request.projectIds },
        correction: {
          id: 'correction-1',
          fromAssignmentId: request.assignmentId,
          toAssignmentId: 'assignment-2',
          createdAt: '2026-08-30T00:00:00.000Z',
        },
        state: updated.state,
      }))
    vi.stubGlobal('fetch', fetch)
    const store = new CommonspaceClientStore()
    await store.refresh()

    const reroute = (store as unknown as { rerouteAssignment(value: typeof request): Promise<void> }).rerouteAssignment
    await reroute.call(store, request)

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/reroute', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(request),
    }))
    expect(store.getSnapshot().bootstrap?.state.revision).toBe(2)
  })

  it('refreshes again when an SSE revision arrives during an in-flight refresh', async () => {
    const firstRefresh = deferred<Response>()
    const followUpRefresh = deferred<Response>()
    const latest = bootstrap(2, 'Initial')
    latest.state.messages['dm:backend'] = [{
      id: 'reply-1',
      conversation: { kind: 'dm', id: 'backend' },
      authorType: 'agent',
      authorId: 'backend',
      authorName: 'Backend',
      text: 'Reply arrived',
      createdAt: '2026-08-25T00:00:00.000Z',
    }]
    const fetch = vi.fn()
      .mockImplementationOnce(() => firstRefresh.promise)
      .mockImplementationOnce(() => followUpRefresh.promise)
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('EventSource', FakeEventSource)

    const store = new CommonspaceClientStore()
    store.connectEvents()
    const refreshing = store.refresh()
    FakeEventSource.instances[0]!.emit('revision', JSON.stringify({ revision: 2 }))
    firstRefresh.resolve(response(bootstrap(1, 'Initial')))
    await refreshing

    await vi.waitFor(() => { expect(fetch).toHaveBeenCalledTimes(2) })
    followUpRefresh.resolve(response(latest))
    await vi.waitFor(() => {
      expect(store.getSnapshot().bootstrap?.state.messages['dm:backend']?.[0]?.text).toBe('Reply arrived')
    })
  })

  it('includes pasted image payloads in the send request', async () => {
    const initial = bootstrap(1, 'Initial')
    const accepted = bootstrap(2, 'Initial')
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response({
        accepted: {
          id: 'message-1',
          conversation: { kind: 'dm', id: 'backend' },
          authorType: 'user',
          authorId: 'user',
          authorName: 'Ralph',
          text: 'Inspect this',
          createdAt: '2026-08-27T00:00:00.000Z',
        },
        state: accepted.state,
      }))
    vi.stubGlobal('fetch', fetch)

    const store = new CommonspaceClientStore()
    await store.refresh()
    store.selectConversation({ kind: 'dm', id: 'backend' })
    await store.send('Inspect this', undefined, [{
      name: 'clipboard.png',
      mimeType: 'image/png',
      data: 'iVBORw==',
    }])

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/send', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        conversation: { kind: 'dm', id: 'backend' },
        text: 'Inspect this',
        projectId: 'project-1',
        attachments: [{ name: 'clipboard.png', mimeType: 'image/png', data: 'iVBORw==' }],
      }),
    }))
  })
})
