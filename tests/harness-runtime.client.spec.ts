// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createHarnessRuntime } from '../src/client/harness-runtime.ts'

function harnessContext(options: { existing?: boolean; workspaces?: boolean } = {}) {
  const sessionId = 'session-1'
  const rename = vi.fn(async () => ({ ok: true as const, value: { title: '#general · Apollo', seq: 1 } }))
  const prompt = vi.fn(async () => ({ ok: true as const, value: { accepted: true as const } }))
  const open = vi.fn()
  const create = vi.fn(async () => sessionId)
  const workspace = {
    workspaceId: 'workspace-1',
    path: '/workspace/apollo',
    title: 'Developer',
    sessionIds: [],
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
  }
  const ctx = {
    workspaces: {
      list: {
        getSnapshot: () => ({
          items: options.workspaces === false ? [] : [workspace],
          recentWorkspaceId: options.workspaces === false ? undefined : workspace.workspaceId,
        }),
      },
    },
    sessions: {
      create,
      list: {
        getSnapshot: () => ({
          byId: options.existing === true
            ? { [sessionId]: { id: sessionId, sessionId } }
            : {},
        }),
      },
      binding: vi.fn(() => ({ session: { rename, prompt } })),
      open,
    },
  }
  return { ctx, create, open, prompt, rename, sessionId }
}

describe('Harness-backed Commonspace runtime', () => {
  it('creates a clean workspace session, names it, and opens native chat', async () => {
    const fake = harnessContext()
    const runtime = createHarnessRuntime(fake.ctx as never)

    const result = await runtime.activate({
      kind: 'channel',
      label: 'general',
      project: { label: 'Apollo', workspaceId: 'workspace-1' },
    })

    expect(result).toEqual({ sessionId: fake.sessionId, workspaceId: 'workspace-1' })
    expect(fake.create).toHaveBeenCalledWith({ workspaceId: 'workspace-1' })
    expect(fake.rename).toHaveBeenCalledWith('#general · Apollo')
    expect(fake.open).toHaveBeenCalledWith(fake.sessionId)
    expect(fake.prompt).toHaveBeenCalledWith([
      { type: 'text', text: "[Commonspace] #general created for Apollo. This is the channel's Messages conversation." },
    ], 'queue')
  })

  it('reopens an existing mapped session without creating another chat', async () => {
    const fake = harnessContext({ existing: true })
    const runtime = createHarnessRuntime(fake.ctx as never)

    const result = await runtime.activate({
      kind: 'direct-message',
      label: 'Frontend',
      sessionId: fake.sessionId,
      project: { label: 'Apollo', workspaceId: 'workspace-1' },
    })

    expect(result.sessionId).toBe(fake.sessionId)
    expect(fake.open).toHaveBeenCalledWith(fake.sessionId)
    expect(fake.create).not.toHaveBeenCalled()
    expect(fake.rename).not.toHaveBeenCalled()
    expect(fake.prompt).not.toHaveBeenCalled()
  })

  it('rejects new conversations when no real Harness workspace is available', async () => {
    const fake = harnessContext({ workspaces: false })
    const runtime = createHarnessRuntime(fake.ctx as never)

    await expect(runtime.activate({ kind: 'channel', label: 'general' }))
      .rejects.toThrow('Add a Harness workspace')
    expect(fake.create).not.toHaveBeenCalled()
  })
})
