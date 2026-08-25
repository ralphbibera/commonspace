import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService, type AgentRunInput } from '../src/host/service.ts'

const roots: string[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Commonspace direct-message host sessions', () => {
  it('runs the next DM in a fresh native session after reset', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-reset-dm-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => ({
      text: `Reply to ${input.prompt.at(-1) ?? ''}`,
      sessionId: runAgent.mock.calls.length === 1
        ? '123e4567-e89b-42d3-a456-426614174000'
        : '223e4567-e89b-42d3-a456-426614174000',
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'First' })
    await service.whenIdle()
    await service.mutate({ action: 'reset-dm', agentId: 'codex-review-bot' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Second' })
    await service.whenIdle()

    expect(runAgent).toHaveBeenCalledTimes(2)
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({ sessionName: 'Bot Chat' })
    expect(runAgent.mock.calls[1]?.[0].sessionName).toMatch(/^Commonspace DM: [0-9a-f-]{36}$/)
    expect(runAgent.mock.calls[1]?.[0].sessionId).toBeUndefined()
    const freshScope = runAgent.mock.calls[1]?.[0].sessionName
    expect(Object.keys(service.snapshot().agentSessions['codex-review-bot'] ?? {})).toEqual([freshScope])
    expect(service.snapshot().messages['dm:codex-review-bot']?.map(message => message.text)).toEqual([
      'Second',
      'Reply to d',
    ])
    expect((await service.bootstrap()).state.dmSessions).toEqual({})

    const resumedRun = vi.fn(async () => ({ text: 'Resumed', sessionId: '223e4567-e89b-42d3-a456-426614174000' }))
    const restarted = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent: resumedRun })
    await restarted.initialize()
    await restarted.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Third' })
    await restarted.whenIdle()
    expect(resumedRun).toHaveBeenCalledWith(expect.objectContaining({
      sessionName: freshScope,
      sessionId: '223e4567-e89b-42d3-a456-426614174000',
    }))
  })

  it('drops an in-flight reply when that DM is reset', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-reset-dm-race-'))
    roots.push(root)
    const result = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async () => result.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Old request' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })
    await service.mutate({ action: 'reset-dm', agentId: 'codex-review-bot' })
    result.resolve({ text: 'Stale reply', sessionId: '123e4567-e89b-42d3-a456-426614174000' })
    await service.whenIdle()

    expect(service.snapshot().messages['dm:codex-review-bot']).toBeUndefined()
    expect(service.snapshot().agentSessions['codex-review-bot']).toBeUndefined()
  })

  it('rejects a user message when the DM resets between preparation and acceptance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-reset-dm-accept-race-'))
    roots.push(root)
    const gate = deferred<void>()
    const beforeAcceptSend = vi.fn(async () => gate.promise)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [],
      runAgent: async () => 'unused',
      beforeAcceptSend,
    })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    const sending = service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Old generation' })
    await vi.waitFor(() => { expect(beforeAcceptSend).toHaveBeenCalledOnce() })
    await service.mutate({ action: 'reset-dm', agentId: 'codex-review-bot' })
    gate.resolve()

    await expect(sending).rejects.toThrow('conversation changed before message acceptance')
    expect(service.snapshot().messages['dm:codex-review-bot']).toBeUndefined()
  })
})
