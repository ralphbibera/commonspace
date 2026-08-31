import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService, type AgentRunInput } from '../server/src/service.ts'
import { addTestHarness, discoverTestHarnesses } from './test-harnesses.ts'

const roots: string[] = []
const services: CommonspaceHostService[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

afterEach(async () => {
  await Promise.all(services.splice(0).map(service => service.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'commonspace-multi-project-'))
  roots.push(root)
  const stateRoot = join(root, 'state')
  const firstRoot = join(root, 'first')
  const secondRoot = join(root, 'second')
  await Promise.all([mkdir(firstRoot), mkdir(secondRoot)])
  const runAgent = vi.fn(async (): Promise<{ text: string }> => ({ text: 'Done.' }))
  const service = new CommonspaceHostService({} as never, { root: stateRoot }, {
    discoverAgents: discoverTestHarnesses,
    runAgent,
  })
  services.push(service)
  await service.initialize()
  await addTestHarness(service, 'codex', 'Review Bot')
  const first = (await service.mutate({ action: 'create-project', name: 'First App', paths: [firstRoot] })).projects[0]!
  const second = (await service.mutate({ action: 'create-project', name: 'Second API', paths: [secondRoot] })).projects[1]!
  return { service, runAgent, first, second, firstRoot: await realpath(firstRoot), secondRoot: await realpath(secondRoot), stateRoot }
}

describe('multi-project conversation context', () => {
  it('runs projectless Channel work from a dedicated neutral workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-projectless-'))
    roots.push(root)
    const runAgent = vi.fn(async (): Promise<{ text: string }> => ({ text: 'Done.' }))
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent,
    })
    services.push(service)
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const channel = (await service.mutate({ action: 'create-channel', name: 'projectless', agentIds: ['codex'] })).channels[0]!

    await service.send({
      conversation: { kind: 'channel', id: channel.id },
      projectIds: [],
      text: '@review-bot work without Project access.',
    })
    await service.whenIdle()

    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      cwd: await realpath(join(root, 'workspace')),
      additionalCwds: [],
      commonspaceScope: { projectIds: [] },
    })
  })

  it('delivers every tagged Project to a direct-message agent', async () => {
    const { service, runAgent, first, second, firstRoot, secondRoot } = await fixture()

    const sent = await service.send({
      conversation: { kind: 'dm', id: 'codex' },
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

  it('rejects a deprecated singular Project that conflicts with authoritative Project refs', async () => {
    const { service, runAgent, first, second } = await fixture()

    await expect(service.send({
      conversation: { kind: 'dm', id: 'codex' },
      projectIds: [first.id],
      projectId: second.id,
      text: 'Do not expand the selected Project set.',
    })).rejects.toThrow('project id must match the first project ids entry')
    expect(runAgent).not.toHaveBeenCalled()
  })

  it('changes Thread Project references only for the new turn and future defaults', async () => {
    const { service, runAgent, first, second, firstRoot } = await fixture()
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: ['codex'],
    })).channels[0]!

    const root = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: '@review-bot coordinate @@first-app and @@second-api.',
    })
    await service.whenIdle()

    expect(root.thread?.projectIds).toEqual([first.id, second.id])
    const compatibilityReply = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: root.thread!.id,
      targetAgentId: 'codex',
      projectId: first.id,
      text: 'Continue from the current UI Project selection.',
    })
    await service.whenIdle()
    expect(compatibilityReply.accepted.projectIds).toEqual([first.id, second.id])

    const changed = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: root.thread!.id,
      targetAgentId: 'codex',
      projectIds: [first.id],
      text: 'Continue with only First App.',
    })
    await service.whenIdle()
    expect(changed.accepted.projectIds).toEqual([first.id])
    expect(service.snapshot().threads.find(thread => thread.id === root.thread?.id)?.projectIds).toEqual([first.id])
    expect(runAgent.mock.calls.at(-1)?.[0]).toMatchObject({
      cwd: firstRoot,
      additionalCwds: [],
      commonspaceScope: { projectIds: [first.id] },
    })
    expect(service.snapshot().messages[`channel:${channel.id}`]
      ?.find(message => message.id === root.accepted.id)?.projectIds).toEqual([first.id, second.id])

    const inherited = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: root.thread!.id,
      targetAgentId: 'codex',
      text: 'Continue with the new default.',
    })
    await service.whenIdle()
    expect(inherited.accepted.projectIds).toEqual([first.id])

    const projectless = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: root.thread!.id,
      targetAgentId: 'codex',
      projectIds: [],
      text: 'Explicitly remove every Project.',
    })
    await service.whenIdle()
    expect(projectless.accepted.projectIds).toBeUndefined()
    expect(service.snapshot().threads.find(thread => thread.id === root.thread?.id)?.projectIds).toEqual([])
    expect(runAgent.mock.calls.at(-1)?.[0]).toMatchObject({
      additionalCwds: [],
      commonspaceScope: { projectIds: [] },
    })
  })

  it('keeps an active turn scoped to Projects delivered before future Thread defaults change', async () => {
    const { service, runAgent, first, second } = await fixture()
    const firstRun = deferred<{ text: string }>()
    let firstScope: AgentRunInput['commonspaceScope']
    runAgent.mockImplementationOnce(async (input: AgentRunInput) => {
      firstScope = input.commonspaceScope
      return firstRun.promise
    }).mockResolvedValue({ text: 'Later work completed.' })
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'scope-evolution',
      agentIds: ['codex'],
    })).channels[0]!
    const root = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      projectIds: [first.id, second.id],
      text: '@review-bot inspect both Projects.',
    })
    await vi.waitFor(() => { expect(firstScope).toBeDefined() })

    await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: root.thread!.id,
      targetAgentId: 'codex',
      projectIds: [first.id],
      text: 'Use only First App next.',
    })

    const reading = service.readContext(firstScope!)
    firstRun.resolve({ text: 'Initial work completed.' })
    await service.whenIdle()
    await expect(reading).resolves.toMatchObject({
      projects: [{ id: first.id }, { id: second.id }],
    })
  })

  it('removes only the deleted Project from multi-project references', async () => {
    const { service, first, second } = await fixture()
    await service.send({
      conversation: { kind: 'dm', id: 'codex' },
      projectIds: [first.id, second.id],
      text: 'Review both.',
    })
    await service.whenIdle()
    expect(service.snapshot().messages['dm:codex']?.some(message =>
      message.projectIds?.includes(first.id) === true && message.projectIds.includes(second.id))).toBe(true)
    const beforeRemoval = service.snapshot().messages['dm:codex']
      ?.find(message => message.authorType === 'agent')
    expect(beforeRemoval?.runAttribution?.roots.map(root => root.projectId)).toEqual([first.id, second.id])

    const state = await service.mutate({ action: 'remove-project', projectId: first.id })
    const messages = state.messages['dm:codex'] ?? []
    expect(messages.every(message => message.projectIds?.includes(first.id) !== true)).toBe(true)
    expect(messages.filter(message => message.projectIds !== undefined).every(message => message.projectId === second.id)).toBe(true)
    const afterRemoval = messages.find(message => message.authorType === 'agent')
    expect(afterRemoval?.runAttribution?.roots.map(root => root.projectId)).toEqual([second.id])
  })

  it('does not launch queued work with stale Project authority', async () => {
    const { service, runAgent, first, second } = await fixture()
    const firstRun = deferred<{ text: string }>()
    runAgent.mockImplementationOnce(async () => firstRun.promise)
      .mockResolvedValue({ text: 'Queued work ran.' })

    await service.send({
      conversation: { kind: 'dm', id: 'codex' },
      projectIds: [first.id, second.id],
      text: 'Start the first run.',
    })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })
    await service.send({
      conversation: { kind: 'dm', id: 'codex' },
      projectIds: [first.id, second.id],
      text: 'Queue another run.',
      delivery: 'queue',
    })

    await service.mutate({ action: 'remove-project', projectId: first.id })
    firstRun.resolve({ text: 'First work finished late.' })
    await service.whenIdle()

    expect(runAgent).toHaveBeenCalledOnce()
    const messages = service.snapshot().messages['dm:codex'] ?? []
    expect(messages.every(message => message.projectIds?.includes(first.id) !== true)).toBe(true)
    expect(messages.some(message => message.authorType === 'agent')).toBe(false)
  })

  it('removes attribution roots for Projects whose paths disappear before startup', async () => {
    const { service, first, second, firstRoot, stateRoot } = await fixture()
    await service.send({
      conversation: { kind: 'dm', id: 'codex' },
      projectIds: [first.id, second.id],
      text: 'Review both before restart.',
    })
    await service.whenIdle()
    await service.close()
    await rm(firstRoot, { recursive: true, force: true })

    const restarted = new CommonspaceHostService({} as never, { root: stateRoot }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'Done.' }),
    })
    services.push(restarted)
    await restarted.initialize()

    expect(restarted.snapshot().projects.map(project => project.id)).toEqual([second.id])
    const reply = restarted.snapshot().messages['dm:codex']
      ?.find(message => message.authorType === 'agent')
    expect(reply?.projectIds).toEqual([second.id])
    expect(reply?.runAttribution?.roots.map(root => root.projectId)).toEqual([second.id])
  })
})
