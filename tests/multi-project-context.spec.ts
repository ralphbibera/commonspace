import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'

const roots: string[] = []
const services: CommonspaceHostService[] = []

afterEach(async () => {
  await Promise.all(services.splice(0).map(service => service.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'commonspace-multi-project-'))
  roots.push(root)
  const firstRoot = join(root, 'first')
  const secondRoot = join(root, 'second')
  await Promise.all([mkdir(firstRoot), mkdir(secondRoot)])
  const runAgent = vi.fn(async (): Promise<{ text: string }> => ({ text: 'Done.' }))
  const service = new CommonspaceHostService({} as never, { root: join(root, 'state') }, {
    discoverAgents: async () => [],
    runAgent,
  })
  services.push(service)
  await service.initialize()
  await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
  const first = (await service.mutate({ action: 'create-project', name: 'First App', paths: [firstRoot] })).projects[0]!
  const second = (await service.mutate({ action: 'create-project', name: 'Second API', paths: [secondRoot] })).projects[1]!
  return { service, runAgent, first, second, firstRoot: await realpath(firstRoot), secondRoot: await realpath(secondRoot) }
}

describe('multi-project conversation context', () => {
  it('delivers every tagged Project to a direct-message agent', async () => {
    const { service, runAgent, first, second, firstRoot, secondRoot } = await fixture()

    const sent = await service.send({
      conversation: { kind: 'dm', id: 'codex-review-bot' },
      text: 'Compare @@first-app with @@second-api.',
    })
    await service.whenIdle()

    expect(sent.accepted.projectIds).toEqual([first.id, second.id])
    expect(sent.accepted.projectId).toBe(first.id)
    expect(runAgent).toHaveBeenCalledOnce()
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      cwd: firstRoot,
      additionalCwds: [secondRoot],
      commonspaceScope: { projectIds: [first.id, second.id] },
    })
  })

  it('binds a Channel thread to an exact set of Project references', async () => {
    const { service, first, second } = await fixture()
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: ['codex-review-bot'],
    })).channels[0]!

    const root = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: '@review-bot coordinate @@first-app and @@second-api.',
    })
    await service.whenIdle()

    expect(root.thread?.projectIds).toEqual([first.id, second.id])
    const reply = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: root.thread!.id,
      targetAgentId: 'codex-review-bot',
      text: 'Continue with both.',
    })
    await service.whenIdle()
    expect(reply.accepted.projectIds).toEqual([first.id, second.id])

    await expect(service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: root.thread!.id,
      targetAgentId: 'codex-review-bot',
      projectIds: [first.id],
      text: 'Silently change the context.',
    })).rejects.toThrow('thread projects cannot be changed')
  })

  it('removes only the deleted Project from multi-project references', async () => {
    const { service, first, second } = await fixture()
    await service.send({
      conversation: { kind: 'dm', id: 'codex-review-bot' },
      projectIds: [first.id, second.id],
      text: 'Review both.',
    })
    await service.whenIdle()
    expect(service.snapshot().messages['dm:codex-review-bot']?.some(message =>
      message.projectIds?.includes(first.id) === true && message.projectIds.includes(second.id))).toBe(true)

    const state = await service.mutate({ action: 'remove-project', projectId: first.id })
    const messages = state.messages['dm:codex-review-bot'] ?? []
    expect(messages.every(message => message.projectIds?.includes(first.id) !== true)).toBe(true)
    expect(messages.filter(message => message.projectIds !== undefined).every(message => message.projectId === second.id)).toBe(true)
  })
})
