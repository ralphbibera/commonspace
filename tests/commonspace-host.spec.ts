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
})
