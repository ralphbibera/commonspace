// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommonspaceBootstrap } from '../packages/shared/src/contracts.ts'
import { CommonspaceClientStore } from '../ui/src/commonspace-store.ts'

function bootstrap(revision: number, projectName: string): CommonspaceBootstrap {
  return {
    agents: [],
    state: {
      version: 6,
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
    const managed = {
      id: 'codex-review-bot',
      displayName: 'Review Bot',
      adapter: 'codex' as const,
      model: 'gpt-5.4',
      status: 'unknown' as const,
    }
    const initial = bootstrap(1, 'Initial')
    const updated = bootstrap(2, 'Initial')
    updated.agents = [managed]
    updated.state.agents = [{
      id: managed.id,
      displayName: managed.displayName,
      adapter: managed.adapter,
      model: managed.model,
      createdAt: '2026-08-25T00:00:00.000Z',
    }]
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response(updated))
    vi.stubGlobal('fetch', fetch)

    const store = new CommonspaceClientStore()
    await store.refresh()
    await store.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-5.4' })

    expect(store.getSnapshot().bootstrap?.agents).toEqual([managed])
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
})
