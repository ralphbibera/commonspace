import { chmod, mkdtemp, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMMONSPACE_STATE_VERSION } from '@commonspace/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestIsLoopback, requestIsSameOrigin } from '../server/src/app.ts'
import { CommonspaceHostService, unsafeModeForAdapter, type AgentRunInput } from '../server/src/service.ts'
import { addTestHarness, discoverTestHarnesses } from './test-harnesses.ts'

const roots: string[] = []

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (_resource: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> }
    const prompt = body.messages.find(message => message.role === 'user')?.content ?? ''
    const candidatesJson = /Candidates: (\[[^\n]+\])/u.exec(prompt)?.[1] ?? '[]'
    const candidates = JSON.parse(candidatesJson) as Array<{ id: string; routingScore: number }>
    const projectsJson = /Available Projects: (\[[^\n]+\])/u.exec(prompt)?.[1] ?? '[]'
    const projects = JSON.parse(projectsJson) as Array<{ id: string }>
    const subRequest = /Newest user message: ([\s\S]*)$/u.exec(prompt)?.[1]?.trim() ?? ''
    const selected = candidates.toSorted((left, right) => right.routingScore - left.routingScore)[0]
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        assignments: selected === undefined ? [] : [{
          agentId: selected.id,
          subRequest,
          projectIds: projects.map(project => project.id),
        }],
        confidence: 0.9,
        reason: 'Test inference selected the strongest candidate.',
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
})

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
  vi.unstubAllGlobals()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Commonspace host authority', () => {
  it('refuses to overwrite unreadable persisted state during startup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-invalid-state-'))
    roots.push(root)
    const statePath = join(root, 'state.json')
    const invalidState = '{"version":'
    await writeFile(statePath, invalidState)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })

    await expect(service.initialize()).rejects.toThrow()
    expect(await readFile(statePath, 'utf8')).toBe(invalidState)
  })

  it('keeps the previous persisted state as a rollback backup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-state-backup-'))
    roots.push(root)
    const statePath = join(root, 'state.json')
    const original = JSON.stringify({
      version: COMMONSPACE_STATE_VERSION,
      revision: 7,
      inboxReadAt: null,
      inboxReadMessageIds: [],
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [],
      dmSessions: {},
      agentSessions: {},
      projects: [],
      channels: [],
      threads: [],
      messages: {},
    })
    await writeFile(statePath, original)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })

    await service.initialize()

    expect(await readFile(join(root, 'state.backup.json'), 'utf8')).toBe(original)
  })

  it('recovers an unreadable primary state from a valid rollback backup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-state-recovery-'))
    roots.push(root)
    const recovered = JSON.stringify({
      version: COMMONSPACE_STATE_VERSION,
      revision: 9,
      inboxReadAt: null,
      inboxReadMessageIds: [],
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [],
      dmSessions: {},
      agentSessions: {},
      projects: [],
      channels: [],
      threads: [],
      messages: {},
    })
    await writeFile(join(root, 'state.json'), '{"version":')
    await writeFile(join(root, 'state.backup.json'), recovered)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })

    await service.initialize()

    expect(service.snapshot().revision).toBe(9)
    expect(JSON.parse(await readFile(join(root, 'state.json'), 'utf8'))).toMatchObject({ revision: 9 })
    expect(await readFile(join(root, 'state.corrupt.json'), 'utf8')).toBe('{"version":')
  })

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
      discoverAgents: discoverTestHarnesses,
      runAgent,
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')

    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Run.' })
    await service.whenIdle()

    expect(runAgent).toHaveBeenCalledOnce()
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({ cwd: defaultCwd, additionalCwds: [] })
  })

  it('uses an explicit project tag as the message project context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-tagged-project-'))
    roots.push(root)
    const fallback = join(root, 'fallback')
    const workspace = join(root, 'workspace')
    await Promise.all([mkdir(fallback), mkdir(workspace)])
    const runAgent = vi.fn(async (input: AgentRunInput) => { void input; return { text: 'Done.' } })
    const service = new CommonspaceHostService({} as never, { root, defaultCwd: fallback }, { discoverAgents: discoverTestHarnesses, runAgent })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const project = (await service.mutate({ action: 'create-project', name: 'Tagged Workspace', paths: [workspace] })).projects[0]!

    const sent = await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Review @@tagged-workspace.' })
    await service.whenIdle()

    expect(sent.accepted.projectId).toBe(project.id)
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({ cwd: await realpath(workspace), additionalCwds: [] })
  })

  it('redacts host paths from agent failures before publishing them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-private-error-'))
    roots.push(root)
    const workspace = join(root, 'private-workspace')
    await mkdir(workspace)
    const canonicalWorkspace = await realpath(workspace)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => { throw new Error(`provider failed inside ${canonicalWorkspace}/secret.txt`) },
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const project = (await service.mutate({ action: 'create-project', name: 'Private', paths: [workspace] })).projects[0]!
    await service.send({ conversation: { kind: 'dm', id: 'codex' }, projectId: project.id, text: 'Run.' })
    await service.whenIdle()

    const failure = service.snapshot().messages['dm:codex']?.at(-1)?.text ?? ''
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

  it('sanitizes malformed legacy state, canonicalizes paths, and durably writes the current version', async () => {
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
      version: COMMONSPACE_STATE_VERSION,
      revision: 0,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 8, memoryThreads: 1 },
      projects: [{ id: 'project-1', paths: [canonicalWorkspace] }],
      channels: [{
        id: 'channel-1',
        agentIds: [],
        instructions: '',
        settings: { model: null, reasoning: null },
      }],
      threads: [],
      messages: {},
    })
    const persisted = JSON.parse(await readFile(join(root, 'state.json'), 'utf8')) as { version?: number; defaults?: { reasoning?: string } }
    expect(persisted).toMatchObject({ version: COMMONSPACE_STATE_VERSION, defaults: { reasoning: 'max' } })
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
      version: COMMONSPACE_STATE_VERSION,
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
    const runAgent = vi.fn(async (input: AgentRunInput) => input.agent.id === 'codex'
      ? firstResult.promise
      : secondResult.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: discoverTestHarnesses, runAgent })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    await addTestHarness(service, 'hermes', 'Second Bot')
    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Keep working through reload.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    const drain = service.drainAndClose()
    await expect(Promise.race([
      drain.then(() => 'closed'),
      new Promise(resolve => setTimeout(() => resolve('still-running'), 25)),
    ])).resolves.toBe('still-running')
    await service.send({ conversation: { kind: 'dm', id: 'hermes' }, text: 'Join before the swap.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(2) })

    firstResult.resolve({ text: 'Finished safely.', sessionId: 'codex:thread/reload-safe' })
    await expect(Promise.race([
      drain.then(() => 'closed'),
      new Promise(resolve => setTimeout(() => resolve('still-running'), 25)),
    ])).resolves.toBe('still-running')
    secondResult.resolve({ text: 'Also finished safely.', sessionId: 'codex:thread/second-reload-safe' })
    await drain

    expect(service.snapshot().messages['dm:codex']).toEqual([
      expect.objectContaining({
        authorType: 'user',
        replyStatus: 'complete',
        text: 'Keep working through reload.',
      }),
      expect.objectContaining({ authorType: 'agent', text: 'Finished safely.' }),
    ])
    expect(service.snapshot().agentSessions.codex?.['Bot Chat']).toBe('codex:thread/reload-safe')
    expect(service.snapshot().messages['dm:hermes']?.at(-1)?.text).toBe('Also finished safely.')

    const restarted = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await restarted.initialize()
    expect(restarted.snapshot().messages['dm:codex']?.[0]?.replyError).toBeUndefined()
    await restarted.close()
  })

  it('discards an in-flight reply when a harness is removed and re-added', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-remove-race-'))
    roots.push(root)
    const result = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async () => result.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: discoverTestHarnesses, runAgent })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Review this.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    await service.mutate({ action: 'remove-agent', agentId: 'codex' })
    await addTestHarness(service, 'codex', 'Review Bot')
    result.resolve({ text: 'Stale response.', sessionId: '123e4567-e89b-42d3-a456-426614174000' })
    await service.whenIdle()

    expect(service.snapshot().agents).toHaveLength(1)
    expect(service.snapshot().agentSessions.codex).toBeUndefined()
    expect(service.snapshot().messages['dm:codex']).toBeUndefined()
  })

  it('does not resurrect a channel, thread, or native session after deletion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-channel-delete-race-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    const result = deferred<{ text: string; sessionId: string }>()
    const runAgent = vi.fn(async () => result.promise)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: discoverTestHarnesses, runAgent })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace] })).projects[0]!
    const channel = (await service.mutate({ action: 'create-channel', name: 'review', projectId: project.id, agentIds: ['codex'] })).channels[0]!
    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Review.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    await service.mutate({ action: 'remove-channel', channelId: channel.id })
    result.resolve({ text: 'Stale response.', sessionId: '123e4567-e89b-42d3-a456-426614174000' })
    await service.whenIdle()

    const state = service.snapshot()
    expect(state.channels).toEqual([])
    expect(state.threads).toEqual([])
    expect(state.messages[`channel:${channel.id}`]).toBeUndefined()
    expect(state.agentSessions.codex).toBeUndefined()
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
      discoverAgents: discoverTestHarnesses,
      runAgent,
    })
    await service.initialize()
    await addTestHarness(service, 'hermes', 'Frontend')
    const firstProject = (await service.mutate({ action: 'create-project', name: 'First', paths: [firstWorkspace] })).projects.at(-1)!
    const secondProject = (await service.mutate({ action: 'create-project', name: 'Second', paths: [secondWorkspace] })).projects.at(-1)!
    const firstChannel = (await service.mutate({ action: 'create-channel', name: 'first', projectId: firstProject.id, agentIds: ['hermes'] })).channels.at(-1)!
    const secondChannel = (await service.mutate({ action: 'create-channel', name: 'second', projectId: secondProject.id, agentIds: ['hermes'] })).channels.at(-1)!
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

  it('exposes peer responsibilities and handoff guidance in channel context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-agent-directory-'))
    roots.push(root)
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns APIs, persistence, and migrations.' },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns React UI and browser interactions.' },
    ]
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent: async () => 'Done.',
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'backend', 'frontend')
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: agents.map(agent => agent.id),
    })).channels[0]!
    const accepted = await service.send({ conversation: { kind: 'channel', id: channel.id }, text: '@backend start.' })
    await service.whenIdle()

    const context = await service.readContext({
      agentId: 'backend',
      conversation: { kind: 'channel', id: channel.id },
      threadId: accepted.thread!.id,
      sessionName: `Commonspace Thread: ${accepted.thread!.id}`,
    })

    expect(context.participants).toEqual([
      { id: 'backend', displayName: 'Backend', adapter: 'hermes', description: 'Owns APIs, persistence, and migrations.' },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', description: 'Owns React UI and browser interactions.' },
    ])
    expect(context.collaboration).toMatchObject({
      handoff: expect.stringContaining('final reply'),
      limits: expect.stringContaining('one peer'),
    })
  })

  it('rehydrates persisted agent responsibilities before routing after restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-restart-'))
    roots.push(root)
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns persistence, validation, APIs, and services.' },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns React UI, styling, and browser interactions.' },
    ]
    const first = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent: async () => 'Done.',
    })
    await first.initialize()
    await addDiscoveredAgents(first, 'backend', 'frontend')
    const channel = (await first.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: agents.map(agent => agent.id),
    })).channels[0]!
    await first.close()

    const runAgent = vi.fn(async (input: AgentRunInput) => {
      void input
      return 'Done.'
    })
    const restarted = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent,
    })
    await restarted.initialize()
    await restarted.send({
      conversation: { kind: 'channel', id: channel.id },
      text: 'Please fix persisted message validation.',
    })
    await restarted.whenIdle()

    expect(runAgent.mock.calls.map(call => call[0].agent.id)).toEqual(['backend'])
    await restarted.close()
  })

  it('uses the configured Commonspace router for an unmentioned channel message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-ai-routing-'))
    roots.push(root)
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns APIs and persistence.' },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns browser UI, React, and CSS.' },
      { id: 'security', displayName: 'Security', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns threat modeling and security review.' },
    ]
    const runAgent = vi.fn(async (input: AgentRunInput) => `${input.agent.displayName} handled it.`)
    const routeAgents = vi.fn(async (input: { projects: Array<{ id: string }> }) => ({
      assignments: [{
        agentId: 'frontend',
        subRequest: 'Fix only the login screen CSS.',
        projectIds: input.projects.map(project => project.id),
      }],
      confidence: 0.97,
      reason: 'The request is browser UI work.',
    }))
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent,
      routeAgents,
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'backend', 'frontend', 'security')
    const projectRoot = join(root, 'billing-api')
    await mkdir(projectRoot)
    const project = (await service.mutate({ action: 'create-project', name: 'Billing API', paths: [projectRoot] })).projects[0]!
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: agents.map(agent => agent.id),
    })).channels[0]!
    await service.updateRoutingConfiguration({
      provider: 'harness',
      harnessAgentId: 'backend',
    })

    const sent = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      projectId: project.id,
      text: 'Fix the login screen CSS.',
    })
    await service.whenIdle()

    expect(routeAgents).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Fix the login screen CSS.',
      candidates: [
        expect.objectContaining({ id: 'frontend', routingScore: 1, matchedTerms: ['css'] }),
        expect.objectContaining({ id: 'backend', routingScore: 0, matchedTerms: [] }),
        expect.objectContaining({ id: 'security', routingScore: 0, matchedTerms: [] }),
      ],
      context: expect.arrayContaining(['Referenced Project: Billing API']),
      projects: [{ id: project.id, name: 'Billing API' }],
      inferProjects: false,
      maxAgents: 3,
    }))
    expect(runAgent.mock.calls.map(call => call[0].agent.id)).toEqual(['frontend'])
    expect(runAgent.mock.calls[0]?.[0]?.message).toBe('Fix only the login screen CSS.')
    expect((await service.bootstrap()).state.messages[`channel:${channel.id}`]
      ?.find(message => message.id === sent.accepted.id)?.routing).toMatchObject({
      source: 'ai',
      status: 'resolved',
      agentIds: ['frontend'],
      assignments: [{
        id: expect.any(String),
        agentId: 'frontend',
        subRequest: 'Fix only the login screen CSS.',
        projectIds: [project.id],
      }],
      confidence: 0.97,
      reason: 'The request is browser UI work.',
    })
  })

  it('uses the visible workspace fan-out limit without a hidden host cap', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-fanout-'))
    roots.push(root)
    const agents = Array.from({ length: 7 }, (_, index) => ({
      id: `harness-${String(index + 1)}`,
      displayName: `Harness ${String(index + 1)}`,
      adapter: 'hermes' as const,
      model: null,
      status: 'stopped' as const,
    }))
    const routeAgents = vi.fn(async (input: { candidates: Array<{ id: string }> }) => ({
      assignments: [{ agentId: input.candidates[0]!.id, subRequest: 'Handle it.', projectIds: [] }],
      reason: 'One harness is sufficient.',
    }))
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: async () => agents,
      runAgent: async () => 'Done.',
      routeAgents,
    })
    await service.initialize()
    await addDiscoveredAgents(service, ...agents.map(agent => agent.id))
    await service.mutate({ action: 'set-defaults', maxAgentsPerTurn: 8 })
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'fanout',
      agentIds: agents.map(agent => agent.id),
    })).channels[0]!

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Handle this.' })
    await service.whenIdle()

    expect(routeAgents).toHaveBeenCalledWith(expect.objectContaining({ maxAgents: 7 }))
  })

  it('infers Project references for an unreferenced new Channel thread', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-project-inference-'))
    roots.push(root)
    const firstRoot = join(root, 'first')
    const secondRoot = join(root, 'second')
    await Promise.all([mkdir(firstRoot), mkdir(secondRoot)])
    const agent = { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: null, status: 'stopped' as const }
    const runAgent = vi.fn(async () => 'Done.')
    const routeAgents = vi.fn(async (input: { projects: Array<{ id: string; name: string }> }) => {
      const project = input.projects.find(candidate => candidate.name === 'Second')!
      return {
        assignments: [{ agentId: agent.id, subRequest: 'Work only in Second.', projectIds: [project.id] }],
        confidence: 0.88,
        reason: 'The request concerns Second.',
      }
    })
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: async () => [agent],
      runAgent,
      routeAgents,
    })
    await service.initialize()
    await addDiscoveredAgents(service, agent.id)
    await service.mutate({ action: 'create-project', name: 'First', paths: [firstRoot] })
    const second = (await service.mutate({ action: 'create-project', name: 'Second', paths: [secondRoot] })).projects.at(-1)!
    const channel = (await service.mutate({ action: 'create-channel', name: 'routing', agentIds: [agent.id] })).channels[0]!

    const sent = await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Handle the second workspace.' })
    await service.whenIdle()

    expect(routeAgents).toHaveBeenCalledWith(expect.objectContaining({
      inferProjects: true,
      projects: expect.arrayContaining([
        expect.objectContaining({ name: 'First' }),
        expect.objectContaining({ id: second.id, name: 'Second' }),
      ]),
    }))
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      message: 'Work only in Second.',
      cwd: await realpath(secondRoot),
      additionalCwds: [],
    })
    const state = service.snapshot()
    expect(state.messages[`channel:${channel.id}`]?.find(message => message.id === sent.accepted.id)).toMatchObject({
      projectIds: [second.id],
      projectId: second.id,
      routing: {
        inferredProjectIds: [second.id],
        assignments: [{ projectIds: [second.id] }],
      },
    })
    expect(state.threads.find(thread => thread.id === sent.thread?.id)).toMatchObject({
      projectIds: [second.id],
      projectId: second.id,
    })
  })

  it('persists the global OpenAI-compatible router without exposing its API key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-secret-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()

    await expect(service.updateRoutingConfiguration({
      provider: 'openai-compatible',
      model: 'gpt-4.1-mini',
      baseUrl: 'https://api.openai.com/v1/',
      apiKey: 'private-router-key',
    })).resolves.toEqual({
      provider: 'openai-compatible',
      model: 'gpt-4.1-mini',
      harnessAgentId: null,
      baseUrl: 'https://api.openai.com/v1',
      apiKeyConfigured: true,
    })
    expect(JSON.stringify(await service.bootstrap())).not.toContain('private-router-key')
    expect((await stat(join(root, 'routing.json'))).mode & 0o777).toBe(0o600)
    await service.close()

    const restarted = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await restarted.initialize()
    expect(restarted.routing()).toMatchObject({
      provider: 'openai-compatible',
      model: 'gpt-4.1-mini',
      apiKeyConfigured: true,
    })
  })

  it('clears a saved routing credential when the provider origin changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-origin-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()
    await service.updateRoutingConfiguration({
      provider: 'openai-compatible',
      model: 'router-a',
      baseUrl: 'https://router-a.example/v1',
      apiKey: 'router-a-key',
    })

    await expect(service.updateRoutingConfiguration({
      provider: 'openai-compatible',
      model: 'router-b',
      baseUrl: 'https://router-b.example/v1',
    })).resolves.toMatchObject({
      baseUrl: 'https://router-b.example/v1',
      apiKeyConfigured: false,
    })
  })

  it('does not offer OPENAI_API_KEY to a custom routing origin', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'openai-environment-key')
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-env-origin-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()

    await service.updateRoutingConfiguration({
      provider: 'openai-compatible',
      model: 'local-router',
      baseUrl: 'http://127.0.0.1:11434/v1',
    })

    expect(service.routing().apiKeyConfigured).toBe(false)
  })

  it('rejects routing configurations that do not use inference', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-required-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => [] })
    await service.initialize()

    await expect(service.updateRoutingConfiguration({ provider: 'deterministic' } as never))
      .rejects.toThrow('unsupported routing provider')
  })

  it('can use a configured agent harness as the shared Commonspace inference layer', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-harness-router-'))
    roots.push(root)
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns APIs.' },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const, description: 'Owns UI and CSS.' },
    ]
    const runAgent = vi.fn(async (input: AgentRunInput) => input.sessionName.startsWith('Commonspace Inference: ')
      ? '{"assignments":[{"agentId":"frontend","subRequest":"Fix the CSS layout.","projectIds":[]}],"confidence":0.93,"reason":"CSS work"}'
      : 'Handled.')
    const service = new CommonspaceHostService({} as never, { root }, { discoverAgents: async () => agents, runAgent })
    await service.initialize()
    await addDiscoveredAgents(service, 'backend', 'frontend')
    const channel = (await service.mutate({ action: 'create-channel', name: 'engineering', agentIds: ['backend', 'frontend'] })).channels[0]!
    await service.updateRoutingConfiguration({ provider: 'harness', harnessAgentId: 'backend' })

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Fix the CSS layout.' })
    await service.whenIdle()

    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      agent: expect.objectContaining({ id: 'backend' }),
      sessionName: expect.stringMatching(/^Commonspace Inference: /u),
      reasoning: 'minimal',
    })
    expect(runAgent.mock.calls[0]?.[0].model).toBeUndefined()
    expect(runAgent.mock.calls[1]?.[0].agent.id).toBe('frontend')
  })

  it('marks an accepted channel message failed when inference routing fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-fallback-'))
    roots.push(root)
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const },
    ]
    const runAgent = vi.fn(async (input: AgentRunInput) => `${input.agent.displayName} handled it.`)
    const service = new CommonspaceHostService({ warn: () => undefined } as never, { root }, {
      discoverAgents: async () => agents,
      runAgent,
      routeAgents: async () => { throw new Error('router unavailable') },
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'backend', 'frontend')
    const channel = (await service.mutate({ action: 'create-channel', name: 'engineering', agentIds: ['backend', 'frontend'] })).channels[0]!
    await service.updateRoutingConfiguration({ provider: 'harness', harnessAgentId: 'backend' })

    const sent = await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Please take a look.' })
    await service.whenIdle()

    expect(runAgent).not.toHaveBeenCalled()
    expect((await service.bootstrap()).state.messages[`channel:${channel.id}`]
      ?.find(message => message.id === sent.accepted.id)?.routing).toEqual({
      source: 'ai',
      status: 'failed',
      agentIds: [],
      assignments: [],
      inferredProjectIds: [],
      reason: 'inference routing failed',
    })
  })

  it('persists an unaddressed message as routing before inference resolves', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-pending-'))
    roots.push(root)
    const route = deferred<{ agentIds: string[]; confidence: number; reason: string }>()
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const },
    ]
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent: async input => `${input.agent.displayName} handled it.`,
      routeAgents: async () => route.promise,
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'backend', 'frontend')
    const channel = (await service.mutate({ action: 'create-channel', name: 'engineering', agentIds: ['backend', 'frontend'] })).channels[0]!

    const sending = service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Fix the API.' })
    const immediate = await Promise.race([
      sending.then(response => ({ status: 'accepted' as const, response })),
      new Promise<{ status: 'blocked' }>(resolve => { setTimeout(() => { resolve({ status: 'blocked' }) }, 50) }),
    ])
    route.resolve({ agentIds: ['backend'], confidence: 0.95, reason: 'API work belongs to Backend.' })

    expect(immediate.status).toBe('accepted')
    if (immediate.status !== 'accepted') return
    expect(immediate.response.accepted.routing).toEqual({
      source: 'ai',
      status: 'pending',
      agentIds: [],
      assignments: [],
      inferredProjectIds: [],
      reason: 'Routing with inference.',
    })
    expect(immediate.response.state.messages[`channel:${channel.id}`]?.at(-1)?.text).toBe('Fix the API.')
    await service.whenIdle()
    expect((await service.bootstrap()).state.messages[`channel:${channel.id}`]
      ?.find(message => message.id === immediate.response.accepted.id)?.routing).toMatchObject({
      source: 'ai',
      status: 'resolved',
      agentIds: ['backend'],
      assignments: [{
        id: expect.any(String),
        agentId: 'backend',
        subRequest: 'Fix the API.',
        projectIds: [],
      }],
      confidence: 0.95,
      reason: 'API work belongs to Backend.',
    })
  })

  it('adds an explicitly tagged outside agent to the channel and active thread', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-tag-join-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => `${input.agent.displayName} joined.`)
    const agents = [
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const },
      { id: 'reviewer', displayName: 'Reviewer', adapter: 'hermes' as const, model: 'test', status: 'stopped' as const },
    ]
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent,
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'frontend', 'reviewer')
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: ['frontend'],
    })).channels[0]!
    const accepted = await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Start.' })
    await service.whenIdle()
    runAgent.mockClear()

    await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: accepted.thread!.id,
      text: '@reviewer please join this review.',
    })
    await service.whenIdle()

    expect(runAgent.mock.calls.map(call => call[0].agent.id)).toEqual(['reviewer'])
    expect(service.snapshot().channels.find(candidate => candidate.id === channel.id)?.agentIds)
      .toEqual(['frontend', 'reviewer'])
    expect(service.snapshot().threads.find(candidate => candidate.id === accepted.thread!.id)?.agentIds)
      .toEqual(['frontend', 'reviewer'])
  })

  it('delivers @all to every channel agent even when the normal turn limit is lower', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-tag-all-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => `${input.agent.displayName} replied.`)
    const agents = ['frontend', 'backend', 'reviewer'].map(id => ({
      id,
      displayName: id.slice(0, 1).toLocaleUpperCase() + id.slice(1),
      adapter: 'hermes' as const,
      model: 'test',
      status: 'stopped' as const,
    }))
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent,
    })
    await service.initialize()
    await addDiscoveredAgents(service, ...agents.map(agent => agent.id))
    await service.mutate({ action: 'set-defaults', maxAgentsPerTurn: 2 })
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: agents.map(agent => agent.id),
    })).channels[0]!

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: '@all please check.' })
    await service.whenIdle()

    expect(runAgent.mock.calls.map(call => call[0].agent.id)).toEqual(['frontend', 'backend', 'reviewer'])
  })

  it('keeps a channel tag as context without onboarding or routing its agents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-tag-channel-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => `${input.agent.displayName} replied.`)
    const agents = ['facilitator', 'frontend', 'backend', 'reviewer'].map(id => ({
      id,
      displayName: id.slice(0, 1).toLocaleUpperCase() + id.slice(1),
      adapter: 'hermes' as const,
      model: 'test',
      status: 'stopped' as const,
    }))
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => agents,
      runAgent,
    })
    await service.initialize()
    await addDiscoveredAgents(service, ...agents.map(agent => agent.id))
    await service.mutate({ action: 'set-defaults', maxAgentsPerTurn: 2 })
    const general = (await service.mutate({
      action: 'create-channel',
      name: 'general',
      agentIds: ['facilitator'],
    })).channels.find(channel => channel.name === 'general')!
    await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: ['frontend', 'backend', 'reviewer'],
    })

    const accepted = await service.send({
      conversation: { kind: 'channel', id: general.id },
      text: '#engineering please check.',
    })
    await service.whenIdle()

    expect(runAgent.mock.calls.map(call => call[0].agent.id)).toEqual(['facilitator'])
    expect(runAgent.mock.calls[0]?.[0].message).toBe('#engineering please check.')
    expect(service.snapshot().channels.find(channel => channel.id === general.id)?.agentIds)
      .toEqual(['facilitator'])
    expect(service.snapshot().threads.find(thread => thread.id === accepted.thread?.id)?.agentIds)
      .toEqual(['facilitator'])
  })

  it('delivers a direct channel reply only to the selected agent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-direct-reply-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    const runAgent = vi.fn(async (input: AgentRunInput) => `${input.agent.displayName} replied.`)
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
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      projectId: project.id,
      agentIds: ['backend', 'frontend'],
    })).channels[0]!
    const accepted = await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Share findings.' })
    await service.whenIdle()
    runAgent.mockClear()

    await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: accepted.thread!.id,
      targetAgentId: 'frontend',
      text: 'Check the boundary again.',
    })
    await service.whenIdle()

    expect(runAgent.mock.calls.map(call => call[0].agent.id)).toEqual(['frontend'])
  })

  it('rejects invalid direct channel reply targets before appending a message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-direct-reply-validation-'))
    roots.push(root)
    const runAgent = vi.fn(async () => 'Done.')
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [
        { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'stopped' },
        { id: 'outside', displayName: 'Outside', adapter: 'hermes', model: 'test', status: 'stopped' },
      ],
      runAgent,
    })
    await service.initialize()
    await addDiscoveredAgents(service, 'frontend', 'outside')
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: ['frontend'],
    })).channels[0]!
    const accepted = await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Start.' })
    await service.whenIdle()
    const messageCount = service.snapshot().messages[`channel:${channel.id}`]!.length

    await expect(service.send({
      conversation: { kind: 'channel', id: channel.id },
      targetAgentId: 'frontend',
      text: 'No thread.',
    })).rejects.toThrow('direct channel replies require a thread')
    await expect(service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: accepted.thread!.id,
      targetAgentId: 'outside',
      text: 'Wrong agent.',
    })).rejects.toThrow('direct reply target is not a channel member')
    await expect(service.send({
      conversation: { kind: 'dm', id: 'frontend' },
      targetAgentId: 'outside',
      text: 'Wrong conversation kind.',
    })).rejects.toThrow('direct messages do not accept a reply target')

    expect(service.snapshot().messages[`channel:${channel.id}`]).toHaveLength(messageCount)
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

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: '@all share your current findings.' })
    await service.whenIdle()

    expect(runAgent).toHaveBeenCalledTimes(2)
    const messages = service.snapshot().messages[`channel:${channel.id}`] ?? []
    expect(messages.some(message => message.authorType === 'system' && message.text.includes('@backend'))).toBe(true)
    expect(messages.some(message => message.authorType === 'agent' && message.authorId === 'frontend')).toBe(true)
  })

  it('rejects a native Codex profile ID that collides with a selected Hermes profile', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-agent-collision-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: async () => [{ id: 'codex-review-bot', displayName: 'Collision', adapter: 'hermes', model: 'test', status: 'stopped' }],
    })
    await service.initialize()
    await service.discoverAgents('hermes')
    await service.mutate({ action: 'add-discovered-agent', agentId: 'codex-review-bot' })
    await service.discoverAgents('codex')

    await expect(service.mutate({ action: 'add-discovered-agent', agentId: 'codex-review-bot' }))
      .rejects.toThrow('already exists')
  })

  it('rejects unknown conversations and attaches project context to channel threads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-host-'))
    roots.push(root)
    const projectAPath = join(root, 'a')
    const projectBPath = join(root, 'b')
    await mkdir(projectAPath)
    await mkdir(projectBPath)
    const runAgent = vi.fn(async () => 'ok')
    const service = new CommonspaceHostService({} as never, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent,
    })
    await service.initialize()
    await addTestHarness(service, 'hermes', 'Frontend')

    await expect(service.send({ conversation: { kind: 'channel', id: 'missing' }, text: 'hello' }))
      .rejects.toThrow('unknown channel')
    await expect(service.send({ conversation: { kind: 'dm', id: 'missing' }, text: 'hello' }))
      .rejects.toThrow('unknown agent')
    expect((await service.bootstrap()).state.messages).toEqual({})

    await service.mutate({ action: 'create-project', name: 'A', paths: [projectAPath] })
    const second = await service.mutate({ action: 'create-project', name: 'B', paths: [projectBPath] })
    const projectB = second.projects.find(project => project.name === 'B')!
    const channelState = await service.mutate({ action: 'create-channel', name: 'general', agentIds: ['hermes'] })
    const channel = channelState.channels[0]!

    const accepted = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      projectId: projectB.id,
      text: 'work in project B',
    })
    expect(channel).not.toHaveProperty('projectId')
    expect(accepted.thread).toMatchObject({ projectId: projectB.id })
    expect(accepted.thread).not.toHaveProperty('status')
    expect(accepted.accepted).toMatchObject({ projectId: projectB.id })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })
    expect(runAgent.mock.calls[0]?.[0]?.cwd).toBe(await realpath(projectBPath))
    await service.whenIdle()
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
      discoverAgents: discoverTestHarnesses,
      runAgent,
    })
    await service.initialize()
    await addTestHarness(service, 'hermes', 'Frontend')
    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace] })).projects[0]!
    const channel = (await service.mutate({ action: 'create-channel', name: 'general', projectId: project.id, agentIds: ['hermes'] })).channels[0]!

    const accepted = await service.send({ conversation: { kind: 'channel', id: channel.id }, projectId: project.id, text: 'Investigate checkout.' })
    expect(accepted.thread).not.toHaveProperty('status')
    expect(accepted.accepted.parentMessageId).toBeUndefined()
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledOnce() })

    release?.('Found the issue.')
    await vi.waitFor(async () => {
      const state = (await service.bootstrap()).state
      expect(state.threads.find(thread => thread.id === accepted.thread?.id)).not.toHaveProperty('status')
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
      discoverAgents: discoverTestHarnesses,
      runAgent,
    })
    await service.initialize()
    await addTestHarness(service, 'hermes', 'Frontend')
    await addTestHarness(service, 'codex', 'Review Bot')

    expect((await service.bootstrap()).agents).toEqual([
      { id: 'hermes', displayName: 'Frontend', adapter: 'hermes', model: null, status: 'stopped', description: 'Installed Hermes harness.' },
      {
        id: 'codex',
        displayName: 'Review Bot',
        adapter: 'codex',
        model: null,
        status: 'stopped',
        description: 'Installed Codex harness.',
      },
    ])

    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace, sibling] })).projects[0]!
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'review',
      projectId: project.id,
      agentIds: ['codex'],
    })).channels[0]!
    const accepted = await service.send({ conversation: { kind: 'channel', id: channel.id }, projectId: project.id, text: 'Review this.' })
    const thread = accepted.thread
    if (thread === undefined) throw new Error('expected a channel thread')

    await service.whenIdle()
    const sessionName = `Commonspace Thread: ${thread.id}`
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      agent: { id: 'codex', adapter: 'codex' },
      cwd: resolvedWorkspace,
      additionalCwds: [resolvedSibling],
      sessionName,
    })
    expect(service.snapshot().agentSessions.codex?.[sessionName]).toBe(sessionId)
    expect((await service.bootstrap()).state.agentSessions).toEqual({})

    await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: thread.id,
      text: 'Continue the review.',
    })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(2) })
    expect(runAgent.mock.calls[1]?.[0]).toMatchObject({ sessionName, sessionId })

    await service.send({ conversation: { kind: 'dm', id: 'codex' }, projectId: project.id, text: 'Start a DM.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(3) })
    expect(runAgent.mock.calls[2]?.[0]).toMatchObject({ sessionName: 'Bot Chat' })
    expect(runAgent.mock.calls[2]?.[0]?.sessionId).toBeUndefined()

    await service.send({ conversation: { kind: 'dm', id: 'codex' }, projectId: project.id, text: 'Continue the DM.' })
    await vi.waitFor(() => { expect(runAgent).toHaveBeenCalledTimes(4) })
    expect(runAgent.mock.calls[3]?.[0]).toMatchObject({ sessionName: 'Bot Chat', sessionId })
    await service.whenIdle()
  })
})
