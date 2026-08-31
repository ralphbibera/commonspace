import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'
import { addTestCodexAgents } from './test-codex-agents.ts'

const roots: string[] = []
const services: CommonspaceHostService[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function inferenceResponse(summary: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ summary, decisions: [], openQuestions: [] }) } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(services.splice(0).map(service => service.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'commonspace-channel-context-'))
  roots.push(root)
  const service = new CommonspaceHostService({} as never, { root }, {
    discoverAgents: async () => [],
    runAgent: async () => ({ text: 'Decision: ship the verified implementation.' }),
  })
  services.push(service)
  await service.initialize()
  await addTestCodexAgents(service, 'codex-review-bot')
  const channel = (await service.mutate({
    action: 'create-channel',
    name: 'engineering',
    agentIds: ['codex-review-bot'],
  })).channels[0]!
  await service.send({
    conversation: { kind: 'channel', id: channel.id },
    text: '@review-bot verify the implementation.',
  })
  await service.whenIdle()
  return { service, channel }
}

describe('editable shared Channel context', () => {
  it('preserves a user edit and marks it stale when newer source messages arrive', async () => {
    const { service, channel } = await fixture()
    await service.mutate({
      action: 'set-channel-memory',
      channelId: channel.id,
      summary: 'Canonical user-edited summary.',
      decisions: ['Use the local service.'],
      openQuestions: ['How should export work?'],
    })

    expect(service.snapshot().channels[0]?.memory).toMatchObject({
      summary: 'Canonical user-edited summary.',
      origin: 'user',
      status: 'current',
    })

    await service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: '@review-bot verify another change.',
    })
    await service.whenIdle()

    expect(service.snapshot().channels[0]?.memory).toMatchObject({
      summary: 'Canonical user-edited summary.',
      origin: 'user',
      status: 'stale',
      sourceMessageCount: 4,
    })
  })

  it('uses configured Commonspace inference for manual compaction', async () => {
    const { service, channel } = await fixture()
    const request = vi.fn(async (_resource: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> }
      expect(body.messages.find(message => message.role === 'user')?.content).toContain('verify the implementation')
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          summary: 'The implementation was verified and approved.',
          decisions: ['Ship the verified implementation.'],
          openQuestions: [],
        }) } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', request)

    const memory = await service.compactChannelContext(channel.id)

    expect(memory).toMatchObject({
      summary: 'The implementation was verified and approved.',
      decisions: ['Ship the verified implementation.'],
      origin: 'inference',
      status: 'current',
      sourceMessageCount: 2,
    })
    expect(memory.compactedThroughMessageId).toBeTruthy()
    expect(request).toHaveBeenCalledOnce()
  })

  it('marks a manual compaction stale when a message arrives during inference', async () => {
    const { service, channel } = await fixture()
    const completion = deferred<Response>()
    const request = vi.fn(async () => completion.promise)
    vi.stubGlobal('fetch', request)

    const compacting = service.compactChannelContext(channel.id)
    await vi.waitFor(() => { expect(request).toHaveBeenCalledOnce() })
    await service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: '@review-bot add newer context.',
    })
    completion.resolve(inferenceResponse('Compacted before the newer message.'))

    const memory = await compacting
    await service.whenIdle()

    expect(memory).toMatchObject({
      summary: 'Compacted before the newer message.',
      origin: 'inference',
      status: 'stale',
    })
    expect(memory.sourceMessageCount).toBeGreaterThanOrEqual(3)
    expect(service.snapshot().channels[0]?.memory.status).toBe('stale')
  })

  it('refreshes edited context as soon as a newly accepted message starts routing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-context-acceptance-'))
    roots.push(root)
    const routing = deferred<{ agentIds: string[]; confidence: number; reason: string }>()
    const service = new CommonspaceHostService({ warn: () => undefined } as never, { root }, {
      discoverAgents: async () => [],
      runAgent: async () => ({ text: 'Initial reply.' }),
      routeAgents: async () => routing.promise,
    })
    services.push(service)
    await service.initialize()
    await addTestCodexAgents(service, 'codex-review-bot')
    const channel = (await service.mutate({ action: 'create-channel', name: 'routing', agentIds: ['codex-review-bot'] })).channels[0]!
    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: '@review-bot establish context.' })
    await service.whenIdle()
    await service.updateChannelContext(channel.id, { summary: 'Human-owned context.' })

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'This routing attempt will fail.' })
    const memoryWhileRouting = service.snapshot().channels[0]?.memory
    routing.reject(new Error('router unavailable'))
    await service.whenIdle()

    expect(memoryWhileRouting).toMatchObject({
      summary: 'Human-owned context.',
      origin: 'user',
      status: 'stale',
      sourceMessageCount: 3,
    })
    expect(service.snapshot().channels[0]?.memory.status).toBe('stale')
  })

  it('does not automatically overwrite user-authored context under token pressure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-user-context-pressure-'))
    roots.push(root)
    let reply = 'Initial reply.'
    const request = vi.fn(async () => inferenceResponse('Inferred replacement.'))
    vi.stubGlobal('fetch', request)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [],
      runAgent: async () => ({ text: reply }),
    })
    services.push(service)
    await service.initialize()
    await addTestCodexAgents(service, 'codex-review-bot')
    const channel = (await service.mutate({ action: 'create-channel', name: 'user-pressure', agentIds: ['codex-review-bot'] })).channels[0]!
    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: '@review-bot establish context.' })
    await service.whenIdle()
    await service.updateChannelContext(channel.id, { summary: 'Canonical human summary.', decisions: ['Keep human ownership.'] })
    reply = `Large result ${'y'.repeat(63_000)}`

    for (let index = 0; index < 2; index += 1) {
      await service.send({
        conversation: { kind: 'channel', id: channel.id },
        text: `@review-bot process pass ${String(index)} ${'x'.repeat(49_000)}`,
      })
      await service.whenIdle()
    }

    expect(request).not.toHaveBeenCalled()
    expect(service.snapshot().channels[0]?.memory).toMatchObject({
      summary: 'Canonical human summary.',
      decisions: ['Keep human ownership.'],
      origin: 'user',
      status: 'stale',
    })
  })

  it('serializes automatic compactions and keeps the newest completed projection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-context-race-'))
    roots.push(root)
    const completions = [deferred<Response>(), deferred<Response>()]
    const request = vi.fn(async () => completions[request.mock.calls.length - 1]!.promise)
    vi.stubGlobal('fetch', request)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [],
      runAgent: async () => ({ text: `Large result ${'y'.repeat(63_000)}` }),
    })
    services.push(service)
    await service.initialize()
    await addTestCodexAgents(service, 'codex-review-bot')
    const channel = (await service.mutate({ action: 'create-channel', name: 'race', agentIds: ['codex-review-bot'] })).channels[0]!

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: `@review-bot establish pressure ${'s'.repeat(49_000)}` })
    await service.whenIdle()
    expect(request).not.toHaveBeenCalled()
    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: `@review-bot first compaction ${'a'.repeat(49_000)}` })
    await vi.waitFor(() => { expect(request).toHaveBeenCalledOnce() })
    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: `@review-bot second compaction ${'b'.repeat(49_000)}` })
    await vi.waitFor(() => {
      const replies = service.snapshot().messages[`channel:${channel.id}`]?.filter(message => message.authorType === 'agent') ?? []
      expect(replies).toHaveLength(3)
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(request).toHaveBeenCalledOnce()
    completions[0]!.resolve(inferenceResponse('Older compacted context.'))
    await vi.waitFor(() => { expect(request).toHaveBeenCalledTimes(2) })
    completions[1]!.resolve(inferenceResponse('Newest compacted context.'))
    await service.whenIdle()

    expect(service.snapshot().channels[0]?.memory).toMatchObject({
      summary: 'Newest compacted context.',
      origin: 'inference',
      status: 'current',
      sourceMessageCount: 6,
    })
  })

  it('automatically compacts when shared context crosses token pressure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-context-pressure-'))
    roots.push(root)
    const request = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        summary: 'Pressure-compacted shared context.',
        decisions: ['Keep the verified result.'],
        openQuestions: [],
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', request)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [],
      runAgent: async () => ({ text: `Decision: ${'y'.repeat(63_900)}` }),
    })
    services.push(service)
    await service.initialize()
    await addTestCodexAgents(service, 'codex-review-bot')
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'large-context',
      agentIds: ['codex-review-bot'],
    })).channels[0]!

    for (let index = 0; index < 2; index += 1) {
      await service.send({
        conversation: { kind: 'channel', id: channel.id },
        text: `@review-bot pass ${String(index)} ${'x'.repeat(15_900)}`,
      })
      await service.whenIdle()
    }

    expect(service.snapshot().channels[0]?.memory).toMatchObject({
      summary: 'Pressure-compacted shared context.',
      origin: 'inference',
      status: 'current',
      sourceMessageCount: 4,
    })
    expect(request).toHaveBeenCalledOnce()
  })
})
