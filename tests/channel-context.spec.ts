import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'

const roots: string[] = []
const services: CommonspaceHostService[] = []

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
  await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
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
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
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
