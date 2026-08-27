import { chmod, mkdtemp, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestIsLoopback, requestIsSameOrigin } from '../server/src/app.ts'
import { CommonspaceHostService, unsafeModeForAdapter, type AgentRunInput } from '../server/src/service.ts'

const roots: string[] = []
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

async function addDiscoveredAgents(service: CommonspaceHostService, ...agentIds: string[]): Promise<void> {
  for (const agentId of agentIds) {
    await service.mutate({ action: 'add-discovered-agent', agentId })
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Commonspace host authority', () => {
  it('tightens an existing Commonspace state directory to owner-only access', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-private-root-'))
    roots.push(root)
    await chmod(root, 0o755)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()

    expect((await stat(root)).mode & 0o777).toBe(0o700)
    expect((await stat(join(root, 'state.json'))).mode & 0o777).toBe(0o600)
  })

  it('requires loopback and strict browser same-origin metadata', () => {
    const request = (headers: Record<string, string>, remoteAddress = '127.0.0.1') => ({ headers, socket: { remoteAddress } }) as never
    expect(requestIsLoopback(request({ host: '127.0.0.1:3080' }))).toBe(true)
    expect(requestIsLoopback(request({ host: '127.0.0.1:3080' }, '192.168.1.20'))).toBe(false)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }))).toBe(true)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', origin: 'https://127.0.0.1:3080' }))).toBe(false)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(requestIsSameOrigin(request({ host: '127.0.0.1:3080' }))).toBe(false)
    expect(requestIsSameOrigin(request({
      host: '127.0.0.1:3100',
      'x-forwarded-host': '127.0.0.1:5173',
      referer: 'http://127.0.0.1:5173/',
    }))).toBe(true)
    expect(requestIsSameOrigin(request({
      host: '127.0.0.1:3100',
      'x-forwarded-host': '127.0.0.1:5173',
      origin: 'http://127.0.0.1:5173',
    }))).toBe(true)
    expect(requestIsSameOrigin(request({
      host: '127.0.0.1:3100',
      'x-forwarded-host': '127.0.0.1:5173',
      referer: 'http://127.0.0.1:9999/',
    }))).toBe(false)
  })

  it('keeps Hermes and Codex safety modes independent', () => {
    expect(unsafeModeForAdapter({ hermesYolo: true }, 'hermes')).toBe(true)
    expect(unsafeModeForAdapter({ hermesYolo: true }, 'codex')).toBe(false)
    expect(unsafeModeForAdapter({ externalAgentYolo: true }, 'codex')).toBe(true)
  })

  it('uses the configured default cwd for an unprojected direct message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-default-cwd-'))
    roots.push(root)
    const defaultCwd = join(root, 'workspace')
    await mkdir(defaultCwd)
    const runAgent = vi.fn(async (input: AgentRunInput) => {
      void input
      return { text: 'Done.' }
    })
    const service = new CommonspaceHostService({} as never, { root, defaultCwd }, {
      discoverAgents: async () => [],
      runAgent,
    })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Run.' })
    await service.whenIdle()

    expect(runAgent).toHaveBeenCalledOnce()
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({ cwd: defaultCwd, additionalCwds: [] })
  })

  it('redacts host paths from agent failures before publishing them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-private-error-'))
    roots.push(root)
    const workspace = join(root, 'private-workspace')
    await mkdir(workspace)
    const canonicalWorkspace = await realpath(workspace)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [],
      runAgent: async () => { throw new Error(`provider failed inside ${canonicalWorkspace}/secret.txt`) },
    })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    const project = (await service.mutate({ action: 'create-project', name: 'Private', paths: [workspace] })).projects[0]!
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, projectId: project.id, text: 'Run.' })
    await service.whenIdle()

    const failure = service.snapshot().messages['dm:codex-review-bot']?.at(-1)?.text ?? ''
    expect(failure).toContain('[host path]/secret.txt')
    expect(failure).not.toContain(canonicalWorkspace)
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

  it('sanitizes malformed legacy state, canonicalizes paths, and durably writes v9', async () => {
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
      version: 9,
      revision: 0,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 8, memoryThreads: 1 },
      projects: [{ id: 'project-1', paths: [canonicalWorkspace] }],
      channels: [{
        id: 'channel-1',
        projectId: 'project-1',
        agentIds: [],
        instructions: '',
        settings: { model: null, reasoning: null },
      }],
      threads: [],
      messages: {},
    })
    const persisted = JSON.parse(await readFile(join(root, 'state.json'), 'utf8')) as { version?: number; defaults?: { reasoning?: string } }
    expect(persisted).toMatchObject({ version: 9, defaults: { reasoning: 'max' } })
  })

  it('migrates v7 state to the Hermes and Codex roster', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-v7-roster-'))
    roots.push(root)
    const codexScope = 'Commonspace DM: 123e4567-e89b-42d3-a456-426614174000'
    const retiredScope = 'Commonspace DM: 223e4567-e89b-42d3-a456-426614174000'
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 7,
      revision: 5,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [
        { id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: null, createdAt: 'now' },
        { id: 'retired-agent-writer', displayName: 'Writer', adapter: 'retired-runtime', model: null, createdAt: 'now' },
      ],
      dmSessions: {
        'codex-review-bot': codexScope,
        'retired-agent-writer': retiredScope,
      },
      agentSessions: {
        'codex-review-bot': { [codexScope]: 'codex-native-session' },
        'retired-agent-writer': { [retiredScope]: 'retired-native-session' },
      },
      projects: [],
      channels: [{
        id: 'general',
        name: 'general',
        projectId: null,
        agentIds: ['codex-review-bot', 'retired-agent-writer'],
        instructions: '',
        memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
        settings: { model: null, reasoning: null },
        createdAt: 'now',
      }],
      threads: [],
      messages: {
        'dm:codex-review-bot': [],
        'dm:retired-agent-writer': [],
      },
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()

    expect(service.snapshot()).toMatchObject({
      version: 9,
      agents: [{ id: 'codex-review-bot', adapter: 'codex' }],
      dmSessions: { 'codex-review-bot': codexScope },
      agentSessions: { 'codex-review-bot': { [codexScope]: 'codex-native-session' } },
      channels: [{ id: 'general', agentIds: ['codex-review-bot'] }],
      messages: { 'dm:codex-review-bot': [] },
    })
    expect(service.snapshot().messages['dm:retired-agent-writer']).toBeUndefined()
  })

  it('redacts host-private details from loaded activity traces before repersisting them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-trace-redaction-'))
    roots.push(root)
    const nativeSessionId = 'codex:private-native-session'
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 9,
      revision: 2,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: null, createdAt: 'now' }],
      dmSessions: {},
      agentSessions: { 'codex-review-bot': { 'Bot Chat': nativeSessionId } },
      projects: [],
      channels: [],
      threads: [],
      messages: {
        'dm:codex-review-bot': [{
          id: 'message-1',
          conversation: { kind: 'dm', id: 'codex-review-bot' },
          authorType: 'agent',
          authorId: 'codex-review-bot',
          authorName: 'Review Bot',
          text: 'Done.',
          createdAt: '2026-08-26T00:00:02.000Z',
          trace: {
            adapter: 'codex',
            startedAt: '2026-08-26T00:00:00.000Z',
            completedAt: '2026-08-26T00:00:02.000Z',
            entries: [{
              type: 'tool',
              id: 'call-1',
              title: `Read ${root}/secret.txt`,
              status: 'completed',
              input: `{"path":"${root}/secret.txt"}`,
              output: `session=${nativeSessionId}`,
              createdAt: '2026-08-26T00:00:00.500Z',
              updatedAt: '2026-08-26T00:00:01.500Z',
            }],
          },
        }],
      },
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })

    await service.initialize()

    const trace = service.snapshot().messages['dm:codex-review-bot']?.[0]?.trace
    expect(JSON.stringify(trace)).toContain('[host path]/secret.txt')
    expect(JSON.stringify(trace)).toContain('[native session]')
    expect(JSON.stringify(trace)).not.toContain(root)
    expect(JSON.stringify(trace)).not.toContain(nativeSessionId)
    const persisted = JSON.parse(await readFile(join(root, 'state.json'), 'utf8'))
    expect(JSON.stringify(persisted.messages['dm:codex-review-bot'][0].trace)).toEqual(JSON.stringify(trace))
  })

  it('marks work left running by a previous host process as interrupted', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-interrupted-recovery-'))
    roots.push(root)
    await writeFile(join(root, 'state.json'), JSON.stringify({
      version: 8,
      revision: 4,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: null, createdAt: 'now' }],
      dmSessions: {},
      agentSessions: {},
      projects: [],
      channels: [],
      threads: [],
      messages: {
        'dm:codex-review-bot': [{
          id: 'message-1',
          conversation: { kind: 'dm', id: 'codex-review-bot' },
          authorType: 'user',
          authorId: 'user',
          authorName: 'Ralph',
          text: 'Interrupted work.',
          createdAt: 'now',
          replyStatus: 'running',
        }],
      },
    }))
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()

    expect(service.snapshot().messages['dm:codex-review-bot']?.[0]).toMatchObject({
      replyStatus: 'error',
      replyError: 'The previous Commonspace process ended before the agent completed.',
    })
  })

  it('drains active agent work before closing for a development restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-development-restart-'))
    roots.push(root)
    const firstResult = deferred<{ text: string; sessionId: string }>()
    const secondResult = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async (input: AgentRunInput) => input.agent.id === 'codex-review-bot'
      ? firstResult.promise
      : secondResult.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [], runAgent })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await service.mutate({ action: 'add-agent', displayName: 'Second Bot', adapter: 'codex' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Keep working through reload.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    const drain = service.drainAndClose()
    await expect(Promise.race([
      drain.then(() => 'closed'),
      new Promise(resolve => setTimeout(() => resolve('still-running'), 25)),
    ])).resolves.toBe('still-running')
    await service.send({ conversation: { kind: 'dm', id: 'codex-second-bot' }, text: 'Join before the swap.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(2) })

    firstResult.resolve({ text: 'Finished safely.', sessionId: 'codex:thread/reload-safe' })
    await expect(Promise.race([
      drain.then(() => 'closed'),
      new Promise(resolve => setTimeout(() => resolve('still-running'), 25)),
    ])).resolves.toBe('still-running')
    secondResult.resolve({ text: 'Also finished safely.', sessionId: 'codex:thread/second-reload-safe' })
    await drain

    expect(service.snapshot().messages['dm:codex-review-bot']).toEqual([
      expect.objectContaining({
        authorType: 'user',
        replyStatus: 'complete',
        text: 'Keep working through reload.',
      }),
      expect.objectContaining({ authorType: 'agent', text: 'Finished safely.' }),
    ])
    expect(service.snapshot().agentSessions['codex-review-bot']?.['Bot Chat']).toBe('codex:thread/reload-safe')
    expect(service.snapshot().messages['dm:codex-second-bot']?.at(-1)?.text).toBe('Also finished safely.')

    const restarted = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await restarted.initialize()
    expect(restarted.snapshot().messages['dm:codex-review-bot']?.[0]?.replyError).toBeUndefined()
    await restarted.close()
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

  it('does not block independent room deliveries on overlapping workspace paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-workspace-lock-'))
    roots.push(root)
    const firstWorkspace = join(root, 'first-workspace')
    const secondWorkspace = join(firstWorkspace, 'nested-workspace')
    await mkdir(firstWorkspace)
    await mkdir(secondWorkspace)
    const first = deferred<string>()
    const second = deferred<string>()
    const runAgent = vi.fn(async (input: AgentRunInput) => input.sessionName.includes(firstChannelId)
      ? first.promise
      : second.promise)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [{ id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'stopped' }],
      runAgent,
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'frontend')
    const firstProject = (await service.mutate({ action: 'create-project', name: 'First', paths: [firstWorkspace] })).projects.at(-1)!
    const secondProject = (await service.mutate({ action: 'create-project', name: 'Second', paths: [secondWorkspace] })).projects.at(-1)!
    const firstChannel = (await service.mutate({ action: 'create-channel', name: 'first', projectId: firstProject.id, agentIds: ['frontend'] })).channels.at(-1)!
    const secondChannel = (await service.mutate({ action: 'create-channel', name: 'second', projectId: secondProject.id, agentIds: ['frontend'] })).channels.at(-1)!
    const firstChannelId = firstChannel.id

    await service.send({ conversation: { kind: 'channel', id: firstChannel.id }, text: 'First task.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })
    await service.send({ conversation: { kind: 'channel', id: secondChannel.id }, text: 'Second task.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(2) })

    first.resolve('First response.')
    second.resolve('Second response.')
    await service.whenIdle()
    expect(runAgent).toHaveBeenCalledTimes(2)
  })

  it('delivers an agent-authored mention once as only the new handoff delta', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-a2a-room-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    const runAgent = vi.fn(async (input: AgentRunInput) => input.agent.id === 'backend'
      ? 'API is ready. @frontend connect the configuration view.'
      : '@backend UI connected and verified.')
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const },
    ]
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent,
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'backend', 'frontend')
    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace] })).projects[0]!
    const channel = (await service.mutate({ action: 'create-channel', name: 'engineering', projectId: project.id, agentIds: ['backend', 'frontend'] })).channels[0]!

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: '@backend expose the provider configuration.' })
    await service.whenIdle()

    expect(runAgent.mock.calls.map(call => call[0].agent.id)).toEqual(['backend', 'frontend'])
    expect(runAgent.mock.calls[1]?.[0].message).toBe('API is ready. @frontend connect the configuration view.')
    const messages = service.snapshot().messages[`channel:${channel.id}`] ?? []
    expect(messages.filter(message => message.authorType === 'agent').map(message => message.authorId)).toEqual(['backend', 'frontend'])
  })

  it('continues room delivery when one agent invocation fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-room-failure-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    const runAgent = vi.fn(async (input: AgentRunInput) => {
      if (input.agent.id === 'backend') throw new Error('backend unavailable')
      return 'Frontend still replied.'
    })
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [
        { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'test', status: 'stopped' },
        { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'stopped' },
      ],
      runAgent,
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'backend', 'frontend')
    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace] })).projects[0]!
    const channel = (await service.mutate({ action: 'create-channel', name: 'engineering', projectId: project.id, agentIds: ['backend', 'frontend'] })).channels[0]!

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Share your current findings.' })
    await service.whenIdle()

    expect(runAgent).toHaveBeenCalledTimes(2)
    const messages = service.snapshot().messages[`channel:${channel.id}`] ?? []
    expect(messages.some(message => message.authorType === 'system' && message.text.includes('@backend'))).toBe(true)
    expect(messages.some(message => message.authorType === 'agent' && message.authorId === 'frontend')).toBe(true)
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
    await addDiscoveredAgents(service, 'frontend')
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

  it('merges Hermes and Codex agents and resumes the exact native session for thread replies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-agents-'))
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
    await addDiscoveredAgents(service, 'frontend')
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
