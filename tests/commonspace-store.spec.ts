// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommonspaceBootstrap } from '../src/contracts.ts'
import { CommonspaceClientStore } from '../src/client/commonspace-store.ts'

function bootstrap(revision: number, projectName: string): CommonspaceBootstrap {
  return {
    agents: [],
    state: {
      version: 1,
      revision,
      projects: [{ id: `project-${revision}`, name: projectName, paths: ['/workspace'], createdAt: '2026-08-25T00:00:00.000Z' }],
      channels: [],
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

afterEach(() => { vi.unstubAllGlobals() })

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

    mutation.resolve(response({ state: bootstrap(2, 'Newest').state }))
    await mutating
    staleRefresh.resolve(response(bootstrap(1, 'Stale')))
    await refreshing

    expect(store.getSnapshot().bootstrap?.state.revision).toBe(2)
    expect(store.getSnapshot().bootstrap?.state.projects[0]?.name).toBe('Newest')
  })
})
