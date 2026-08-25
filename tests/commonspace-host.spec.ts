import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService, readBoundedTextFile, requestIsLoopback, requestIsSameOrigin, unsafeModeForAdapter, type AgentRunInput } from '../src/host/service.ts'

const roots: string[] = []
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Commonspace host authority', () => {
  it('rejects an adapter output file before reading beyond the configured bound', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-bounded-read-'))
    roots.push(root)
    const path = join(root, 'output.txt')
    await writeFile(path, '12345')

    await expect(readBoundedTextFile(path, 4)).rejects.toThrow('output limit')
  })

  it('requires loopback and strict browser same-origin metadata', () => {
    const request = (headers: Record<string, string>, remoteAddress = '127.0.0.1') => ({ headers, socket: { remoteAddress } }) as never
    expect(requestIsLoopback(request({ host: '127.0.0.1:3080' }))).toBe(true)
    expect(requestIsLoopback(request({ host: '127.0.0.1:3080' }, '192.168.1.20'))).toBe(false)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }))).toBe(true)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', origin: 'https://127.0.0.1:3080' }))).toBe(false)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080' }))).toBe(false)
  })

  it('keeps legacy Hermes yolo isolated from external adapters', () => {
    expect(unsafeModeForAdapter({ yolo: true }, 'hermes')).toBe(true)
    expect(unsafeModeForAdapter({ yolo: true }, 'codex')).toBe(false)
    expect(unsafeModeForAdapter({ yolo: true }, 'claude-code')).toBe(false)
    expect(unsafeModeForAdapter({ externalAgentYolo: true }, 'codex')).toBe(true)
    expect(unsafeModeForAdapter({ externalAgentYolo: true }, 'claude-code')).toBe(true)
  })

  it('loads only valid native sessions owned by managed agents and known scopes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-sanitize-'))
    roots.push(root)
    const sessionId = '123e4567-e89b-42d3-a456-426614174000'
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 5,
      revision: 1,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: null, createdAt: 'now' }],
      agentSessions: {
        'codex-review-bot': { 'Bot Chat': sessionId, Other: sessionId, 'Commonspace Thread: invalid': sessionId },
        rogue: { 'Bot Chat': sessionId },
      },
      projects: [],
      channels: [],
      threads: [],
      messages: {},
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()

    expect(service.snapshot().agentSessions).toEqual({
      'codex-review-bot': { 'Bot Chat': sessionId },
    })
  })

  it('sanitizes malformed legacy state, canonicalizes paths, and durably writes v6', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-migration-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    const canonicalWorkspace = await realpath(workspace)
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 4,
      revision: -10,
      defaults: { model: 42, reasoning: 'high"; malicious=true', maxAgentsPerTurn: 99, memoryThreads: 0 },
      projects: [
        { id: 'project-1', name: 'Project', paths: [workspace, join(root, 'missing')], createdAt: 'now' },
        { broken: true },
      ],
      channels: [{
        id: 'channel-1',
        name: 'general',
        projectId: 'project-1',
        agentIds: ['frontend', 42],
        instructions: 42,
        memory: { summary: 42 },
        settings: { model: 42, reasoning: 'invalid' },
        createdAt: 'now',
      }],
      threads: [{ broken: true }],
      messages: { 'channel:channel-1': 'not-an-array' },
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()

    const state = service.snapshot()
    expect(state).toMatchObject({
      version: 6,
      revision: 0,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 8, memoryThreads: 1 },
      projects: [{ id: 'project-1', paths: [canonicalWorkspace] }],
      channels: [{
        id: 'channel-1',
        projectId: 'project-1',
        agentIds: ['frontend'],
        instructions: '',
        settings: { model: null, reasoning: null },
      }],
      threads: [],
      messages: {},
    })
    const persisted = JSON.parse(await readFile(join(root, 'state.json'), 'utf8')) as { version?: number; defaults?: { reasoning?: string } }
    expect(persisted).toMatchObject({ version: 6, defaults: { reasoning: 'max' } })
  })

  it('clears a stale native session and starts one bounded replacement session', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-stale-session-'))
    roots.push(root)
    const staleSessionId = '123e4567-e89b-42d3-a456-426614174000'
    const replacementSessionId = '223e4567-e89b-42d3-a456-426614174000'
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 5,
      revision: 1,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: null, createdAt: 'now' }],
      agentSessions: { 'codex-review-bot': { 'Bot Chat': staleSessionId } },
      projects: [],
      channels: [],
      threads: [],
      messages: {},
    }))
    const runAgent = vi.fn(async (input: AgentRunInput) => {
      if (input.sessionId !== undefined) throw new Error('thread/resume failed: no rollout found for thread id')
      return { text: 'Recovered.', sessionId: replacementSessionId }
    })
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Continue.' })

    await vi.waitFor(async () => {
      expect((await service.bootstrap()).state.messages['dm:codex-review-bot']?.some(message => message.text === 'Recovered.')).toBe(true)
    })
    expect(runAgent).toHaveBeenCalledTimes(2)
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({ sessionId: staleSessionId })
    expect(runAgent.mock.calls[1]?.[0].sessionId).toBeUndefined()
    expect(service.snapshot().agentSessions['codex-review-bot']?.['Bot Chat']).toBe(replacementSessionId)
  })

  it('discards an in-flight reply when a managed agent is removed and recreated', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-remove-race-'))
    roots.push(root)
    const result = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async () => result.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Review this.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    await service.mutate({ action: 'remove-agent', agentId: 'codex-review-bot' })
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    result.resolve({ text: 'Stale response.', sessionId: '123e4567-e89b-42d3-a456-426614174000' })
    await service.whenIdle()

    expect(service.snapshot().agents).toHaveLength(1)
    expect(service.snapshot().agentSessions['codex-review-bot']).toBeUndefined()
    expect(service.snapshot().messages['dm:codex-review-bot']).toBeUndefined()
  })

  it('does not replace a stale session after its managed agent was removed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-stale-remove-race-'))
    roots.push(root)
    const staleSessionId = '123e4567-e89b-42d3-a456-426614174000'
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 5,
      revision: 1,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: null, createdAt: 'now' }],
      agentSessions: { 'codex-review-bot': { 'Bot Chat': staleSessionId } },
      projects: [],
      channels: [],
      threads: [],
      messages: {},
    }))
    const stale = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async (input: AgentRunInput) => input.sessionId === undefined
      ? { text: 'Replacement must not run.', sessionId: '223e4567-e89b-42d3-a456-426614174000' }
      : stale.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Continue.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    await service.mutate({ action: 'remove-agent', agentId: 'codex-review-bot' })
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    stale.reject(new Error('thread/resume failed: no rollout found for thread id'))
    await service.whenIdle()

    expect(runAgent).toHaveBeenCalledOnce()
    expect(service.snapshot().agentSessions['codex-review-bot']).toBeUndefined()
    expect(service.snapshot().messages['dm:codex-review-bot']).toBeUndefined()
  })

  it('does not resurrect a channel, thread, or native session after deletion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-channel-delete-race-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    const result = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async () => result.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace] })).projects[0]!
    const channel = (await service.mutate({ action: 'create-channel', name: 'review', projectId: project.id, agentIds: ['codex-review-bot'] })).channels[0]!
    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Review.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    await service.mutate({ action: 'remove-channel', channelId: channel.id })
    result.resolve({ text: 'Stale response.', sessionId: '123e4567-e89b-42d3-a456-426614174000' })
    await service.whenIdle()

    const state = service.snapshot()
    expect(state.channels).toEqual([])
    expect(state.threads).toEqual([])
    expect(state.messages[`channel:${channel.id}`]).toBeUndefined()
    expect(state.agentSessions['codex-review-bot']).toBeUndefined()
  })

  it('serializes agent runs that can write to an overlapping workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-workspace-lock-'))
    roots.push(root)
    const firstWorkspace = join(root, 'first-workspace')
    const secondWorkspace = join(firstWorkspace, 'nested-workspace')
    await mkdir(firstWorkspace)
    await mkdir(secondWorkspace)
    const first = deferred<string>()
    let invocation = 0
    const runAgent = vi.fn(async () => {
      invocation += 1
      return invocation === 1 ? first.promise : 'Second response.'
    })
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [{ id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'stopped' }],
      runAgent,
    })
    await service.initialize()
    const firstProject = (await service.mutate({ action: 'create-project', name: 'First', paths: [firstWorkspace] })).projects.at(-1)!
    const secondProject = (await service.mutate({ action: 'create-project', name: 'Second', paths: [secondWorkspace] })).projects.at(-1)!
    const firstChannel = (await service.mutate({ action: 'create-channel', name: 'first', projectId: firstProject.id, agentIds: ['frontend'] })).channels.at(-1)!
    const secondChannel = (await service.mutate({ action: 'create-channel', name: 'second', projectId: secondProject.id, agentIds: ['frontend'] })).channels.at(-1)!

    await service.send({ conversation: { kind: 'channel', id: firstChannel.id }, text: 'First task.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })
    await service.send({ conversation: { kind: 'channel', id: secondChannel.id }, text: 'Second task.' })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(runAgent).toHaveBeenCalledOnce()

    first.resolve('First response.')
    await service.whenIdle()
    expect(runAgent).toHaveBeenCalledTimes(2)
  })

  it('rejects managed agent IDs that collide with discovered Hermes profiles', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-agent-collision-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [{ id: 'codex-review-bot', displayName: 'Collision', adapter: 'hermes', model: 'test', status: 'stopped' }],
    })
    await service.initialize()

    await expect(service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' }))
      .rejects.toThrow('conflicts with a Hermes profile')
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
      discoverAgents: async () => [{ id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'stopped' }],
      runAgent,
    })
    await service.initialize()

    await expect(service.send({ conversation: { kind: 'channel', id: 'missing' }, text: 'hello' }))
      .rejects.toThrow('unknown channel')
    await expect(service.send({ conversation: { kind: 'dm', id: 'missing' }, text: 'hello' }))
      .rejects.toThrow('unknown agent')
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
    const runAgent = vi.fn((input: AgentRunInput) => {
      void input
      return new Promise<string>((resolve) => { release = resolve })
    })
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [{ id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'stopped' }],
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

  it('merges managed CLI agents and resumes the exact native session for thread replies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-adapters-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    const sibling = join(root, 'sibling')
    await mkdir(workspace)
    await mkdir(sibling)
    const resolvedWorkspace = await realpath(workspace)
    const resolvedSibling = await realpath(sibling)
    const sessionId = '123e4567-e89b-42d3-a456-426614174000'
    const runAgent = vi.fn(async (input: AgentRunInput) => {
      void input
      return { text: 'Codex response.', sessionId }
    })
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [{ id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'stopped' }],
      runAgent,
    })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-5.4' })

    expect((await service.bootstrap()).agents).toEqual([
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'stopped' },
      { id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-5.4', status: 'unknown' },
    ])

    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace, sibling] })).projects[0]!
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'review',
      projectId: project.id,
      agentIds: ['codex-review-bot'],
    })).channels[0]!
    const accepted = await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Review this.' })
    const thread = accepted.thread
    if (thread === undefined) throw new Error('expected a channel thread')

    await vi.waitFor(async () => {
      expect((await service.bootstrap()).state.threads.find(candidate => candidate.id === thread.id)?.status).toBe('complete')
    })
    const sessionName = `Commonspace Thread: ${thread.id}`
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      agent: { id: 'codex-review-bot', adapter: 'codex' },
      cwd: resolvedWorkspace,
      additionalCwds: [resolvedSibling],
      sessionName,
      model: 'gpt-5.4',
    })
    expect(service.snapshot().agentSessions['codex-review-bot']?.[sessionName]).toBe(sessionId)
    expect((await service.bootstrap()).state.agentSessions).toEqual({})

    await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: thread.id,
      text: 'Continue the review.',
    })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(2) })
    expect(runAgent.mock.calls[1]?.[0]).toMatchObject({ sessionName, sessionId })

    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, projectId: project.id, text: 'Start a DM.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(3) })
    expect(runAgent.mock.calls[2]?.[0]).toMatchObject({ sessionName: 'Bot Chat' })
    expect(runAgent.mock.calls[2]?.[0]?.sessionId).toBeUndefined()

    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, projectId: project.id, text: 'Continue the DM.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(4) })
    expect(runAgent.mock.calls[3]?.[0]).toMatchObject({ sessionName: 'Bot Chat', sessionId })
  })
})
