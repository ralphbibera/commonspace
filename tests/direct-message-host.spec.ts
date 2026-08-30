import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CommonspaceTraceEntry } from '@commonspace/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService, type AgentRunInput } from '../server/src/service.ts'

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
  it('reports queued and running work before completing a DM reply', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-dm-status-'))
    roots.push(root)
    const result = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async () => result.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    const accepted = await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Review this' })
    expect(accepted.accepted.replyStatus).toBe('queued')
    await vi.waitFor(() => {
      expect(service.snapshot().messages['dm:codex-review-bot']?.[0]?.replyStatus).toBe('running')
    })

    result.resolve({ text: 'Reviewed', sessionId: '123e4567-e89b-42d3-a456-426614174000' })
    await service.whenIdle()
    expect(service.snapshot().messages['dm:codex-review-bot']?.[0]?.replyStatus).toBe('complete')
  })

  it('queues, reorders, and removes follow-ups while a native session is active', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-dm-followups-'))
    roots.push(root)
    const first = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async (input: AgentRunInput) => runAgent.mock.calls.length === 1
      ? first.promise
      : ({ text: `Reply to ${input.message}`, sessionId: '123e4567-e89b-42d3-a456-426614174000' }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'First' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })
    const second = await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Second', delivery: 'queue' })
    const third = await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Third', delivery: 'queue' })

    expect((await service.bootstrap()).queuedFollowups?.map(item => item.messageId)).toEqual([
      second.accepted.id,
      third.accepted.id,
    ])
    await service.reorderFollowup({ messageId: third.accepted.id, direction: 'up' })
    expect((await service.bootstrap()).queuedFollowups?.map(item => item.messageId)).toEqual([
      third.accepted.id,
      second.accepted.id,
    ])
    await service.removeFollowup({ messageId: second.accepted.id })

    first.resolve({ text: 'Reply to First', sessionId: '123e4567-e89b-42d3-a456-426614174000' })
    await service.whenIdle()
    expect(runAgent.mock.calls.map(([input]) => input.message)).toEqual(['First', 'Third'])
    expect(service.snapshot().messages['dm:codex-review-bot']?.find(message => message.id === second.accepted.id)).toMatchObject({
      replyStatus: 'cancelled',
      replyError: 'Removed from queue.',
    })
  })

  it('stop-and-send cancels the active turn and runs the replacement next', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-dm-stop-send-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => {
      if (runAgent.mock.calls.length === 1) {
        return await new Promise<never>((_resolve, reject) => {
          input.signal.addEventListener('abort', () => { reject(input.signal.reason) }, { once: true })
        })
      }
      return { text: 'Replacement complete', sessionId: '123e4567-e89b-42d3-a456-426614174000' }
    })
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    const first = await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Old direction' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'New direction', delivery: 'stop-and-send' })
    await service.whenIdle()

    expect(runAgent.mock.calls.map(([input]) => input.message)).toEqual(['Old direction', 'New direction'])
    expect(service.snapshot().messages['dm:codex-review-bot']?.find(message => message.id === first.accepted.id)).toMatchObject({
      replyStatus: 'cancelled',
      replyError: 'Stopped for a follow-up.',
    })
  })

  it('publishes provider activity while a DM is running and clears it after completion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-dm-activity-'))
    roots.push(root)
    const result = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async (input: AgentRunInput) => {
      const onTraceUpdate = (input as AgentRunInput & {
        onTraceUpdate?: (entries: readonly CommonspaceTraceEntry[]) => void
      }).onTraceUpdate
      onTraceUpdate?.([{
        type: 'reasoning',
        id: 'reasoning',
        text: 'Inspecting the request now.',
        createdAt: '2026-08-26T00:00:02.000Z',
        updatedAt: '2026-08-26T00:00:02.000Z',
      }])
      return result.promise
    })
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Review this' })
    await vi.waitFor(async () => {
      expect(runAgent).toHaveBeenCalledOnce()
      const activities = (await service.bootstrap() as {
        liveActivities?: Array<{ agentId: string; agentName: string; entries: CommonspaceTraceEntry[] }>
      }).liveActivities ?? []
      expect(activities).toHaveLength(1)
      expect(activities[0]).toMatchObject({
        agentId: 'codex-review-bot',
        agentName: 'Review Bot',
        entries: [{ type: 'reasoning', text: 'Inspecting the request now.' }],
      })
    })

    result.resolve({ text: 'Reviewed', sessionId: '123e4567-e89b-42d3-a456-426614174000' })
    await service.whenIdle()
    expect((await service.bootstrap() as { liveActivities?: unknown[] }).liveActivities).toEqual([])
  })

  it.each([
    ['What input should I use?', 'needs_input'],
    ['', 'silent'],
  ] as const)('classifies completed DM outcomes: %s', async (text, expectedStatus) => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-dm-outcome-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [],
      runAgent: async () => ({ text, sessionId: '123e4567-e89b-42d3-a456-426614174000' }),
    })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Continue' })
    await service.whenIdle()

    expect(service.snapshot().messages['dm:codex-review-bot']?.[0]?.replyStatus).toBe(expectedStatus)
  })

  it('stops only the agent work initiated by the selected message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-stop-message-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput & { signal: AbortSignal }) => new Promise<never>((_resolve, reject) => {
      input.signal.addEventListener('abort', () => { reject(input.signal.reason) }, { once: true })
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    const sent = await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Wrong agent request' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    const result = await service.stopAgentRuns({ messageId: sent.accepted.id })
    await service.whenIdle()

    expect(result).toEqual({ stoppedAgentIds: ['codex-review-bot'] })
    expect(runAgent.mock.calls[0]?.[0].signal.aborted).toBe(true)
    expect(service.liveActivities()).toEqual([])
    expect(service.snapshot().messages['dm:codex-review-bot']?.[0]).toMatchObject({
      replyStatus: 'error',
      replyError: 'Stopped by user.',
    })
  })

  it('can stop one wrong agent or every agent working from a channel message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-stop-channel-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => new Promise<never>((_resolve, reject) => {
      input.signal.addEventListener('abort', () => { reject(input.signal.reason) }, { once: true })
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Frontend', adapter: 'codex' })
    await service.mutate({ action: 'add-agent', displayName: 'Backend', adapter: 'codex' })
    const state = await service.mutate({
      action: 'create-channel',
      name: 'general',
      agentIds: ['codex-frontend', 'codex-backend'],
    })
    const channelId = state.channels[0]?.id
    expect(channelId).toBeDefined()

    const sent = await service.send({ conversation: { kind: 'channel', id: channelId! }, text: '@all investigate this' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(2) })

    expect(await service.stopAgentRuns({ messageId: sent.accepted.id, agentId: 'codex-frontend' }))
      .toEqual({ stoppedAgentIds: ['codex-frontend'] })
    expect(runAgent.mock.calls.find(([input]) => input.agent.id === 'codex-frontend')?.[0].signal.aborted).toBe(true)
    expect(runAgent.mock.calls.find(([input]) => input.agent.id === 'codex-backend')?.[0].signal.aborted).toBe(false)

    expect(await service.stopAgentRuns({ messageId: sent.accepted.id }))
      .toEqual({ stoppedAgentIds: ['codex-backend'] })
    await service.whenIdle()
  })

  it('runs the next DM in a fresh native session after reset', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-reset-dm-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => ({
      text: `Reply to ${input.message}`,
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
      'First',
      'Reply to First',
      'New session started',
      'Second',
      'Reply to Second',
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

    expect(service.snapshot().messages['dm:codex-review-bot']?.map(message => message.text)).toEqual([
      'Old request',
      'New session started',
    ])
    expect(service.snapshot().messages['dm:codex-review-bot']?.[0]).toMatchObject({
      replyStatus: 'error',
      replyError: 'Interrupted by /new.',
    })
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
    expect(service.snapshot().messages['dm:codex-review-bot']?.map(message => message.text)).toEqual(['New session started'])
  })
})
