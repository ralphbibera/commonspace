import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService, requestIsLoopback, requestIsSameOrigin } from '../src/host/service.ts'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Commonspace host authority', () => {
  it('requires loopback and strict browser same-origin metadata', () => {
    const request = (headers: Record<string, string>, remoteAddress = '127.0.0.1') => ({ headers, socket: { remoteAddress } }) as never
    expect(requestIsLoopback(request({ host: '127.0.0.1:3080' }))).toBe(true)
    expect(requestIsLoopback(request({ host: '127.0.0.1:3080' }, '192.168.1.20'))).toBe(false)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }))).toBe(true)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', origin: 'https://127.0.0.1:3080' }))).toBe(false)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080' }))).toBe(false)
  })

  it('rejects unknown conversations and project overrides before appending messages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-host-'))
    roots.push(root)
    const projectAPath = join(root, 'a')
    const projectBPath = join(root, 'b')
    await mkdir(projectAPath)
    await mkdir(projectBPath)
    const runAgent = vi.fn(async () => 'ok')
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [{ id: 'frontend', displayName: 'Frontend', model: 'test', status: 'stopped' }],
      runAgent,
    })
    await service.initialize()

    await expect(service.send({ conversation: { kind: 'channel', id: 'missing' }, text: 'hello' }))
      .rejects.toThrow('unknown channel')
    await expect(service.send({ conversation: { kind: 'dm', id: 'missing' }, text: 'hello' }))
      .rejects.toThrow('unknown Hermes profile')
    expect((await service.bootstrap()).state.messages).toEqual({})

    const first = await service.mutate({ action: 'create-project', name: 'A', paths: [projectAPath] })
    const second = await service.mutate({ action: 'create-project', name: 'B', paths: [projectBPath] })
    const projectA = first.projects.find(project => project.name === 'A')!
    const projectB = second.projects.find(project => project.name === 'B')!
    const channelState = await service.mutate({ action: 'create-channel', name: 'general', projectId: projectA.id, agentIds: ['frontend'] })
    const channel = channelState.channels[0]!

    await expect(service.send({
      conversation: { kind: 'channel', id: channel.id },
      projectId: projectB.id,
      text: 'wrong project',
    })).rejects.toThrow('channel project cannot be overridden')
    expect((await service.bootstrap()).state.messages).toEqual({})
    expect(runAgent).not.toHaveBeenCalled()
  })

  it('accepts a channel root immediately and appends agent replies inside its thread', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-thread-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    let release: ((value: string) => void) | undefined
    const runAgent = vi.fn((input: { profile: string; cwd: string; sessionName: string; prompt: string }) => {
      void input
      return new Promise<string>((resolve) => { release = resolve })
    })
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [{ id: 'frontend', displayName: 'Frontend', model: 'test', status: 'stopped' }],
      runAgent,
    })
    await service.initialize()
    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace] })).projects[0]!
    const channel = (await service.mutate({ action: 'create-channel', name: 'general', projectId: project.id, agentIds: ['frontend'] })).channels[0]!

    const accepted = await service.send({ conversation: { kind: 'channel', id: channel.id }, projectId: project.id, text: 'Investigate checkout.' })
    expect(accepted.thread?.status).toBe('queued')
    expect(accepted.accepted.parentMessageId).toBeUndefined()
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    release?.('Found the issue.')
    await vi.waitFor(async () => {
      const state = (await service.bootstrap()).state
      expect(state.threads.find(thread => thread.id === accepted.thread?.id)?.status).toBe('complete')
      const messages = state.messages[`channel:${channel.id}`] ?? []
      expect(messages.some(message => message.text === 'Found the issue.' && message.parentMessageId === accepted.accepted.id)).toBe(true)
    })
    expect(runAgent.mock.calls[0]?.[0]?.sessionName).toBe(`Commonspace Thread: ${accepted.thread?.id ?? ''}`)
  })
})
