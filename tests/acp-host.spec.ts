import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService, type CommonspaceHostConfig } from '../server/src/service.ts'

const roots: string[] = []
const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-acp-agent.mjs')

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function acpConfig(root: string): CommonspaceHostConfig {
  return {
    root,
    codexAcpCommand: process.execPath,
    codexAcpArgs: [fixturePath],
  }
}

describe('Commonspace ACP host path', () => {
  it('delivers delta-only prompts, reloads persisted sessions, and preserves hard DM resets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-acp-host-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_REPLAY_ON_LOAD', '1')

    const service = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Only the first delta.' })
    await service.whenIdle()

    expect(service.snapshot().messages['dm:codex-review-bot']?.map(message => message.text)).toEqual([
      'Only the first delta.',
      'Echo: Only the first delta.',
    ])
    expect(service.snapshot().agentSessions['codex-review-bot']?.['Bot Chat'])
      .toBe('123e4567-e89b-42d3-a456-426614174000')
    await service.close()

    const restarted = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await restarted.initialize()
    await restarted.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Only the resumed delta.' })
    await restarted.whenIdle()
    expect(restarted.snapshot().messages['dm:codex-review-bot']?.at(-1)?.text).toBe('Echo: Only the resumed delta.')

    await restarted.mutate({ action: 'reset-dm', agentId: 'codex-review-bot' })
    await restarted.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Only the fresh delta.' })
    await restarted.whenIdle()
    expect(restarted.snapshot().messages['dm:codex-review-bot']?.map(message => message.text)).toEqual([
      'Only the first delta.',
      'Echo: Only the first delta.',
      'Only the resumed delta.',
      'Echo: Only the resumed delta.',
      'New session started',
      'Only the fresh delta.',
      'Echo: Only the fresh delta.',
    ])
    await restarted.close()

    const frames = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(frames.filter(frame => frame.method === 'session/prompt').map(frame => frame.params.prompt)).toEqual([
      [{ type: 'text', text: 'Only the first delta.' }],
      [{ type: 'text', text: 'Only the resumed delta.' }],
      [{ type: 'text', text: 'Only the fresh delta.' }],
    ])
    expect(frames.filter(frame => frame.method === 'session/new')).toHaveLength(2)
    expect(frames.filter(frame => frame.method === 'session/load')).toHaveLength(1)
  })

  it('launches a selected Codex custom agent with its native profile config', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-codex-native-profile-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    const logPath = join(root, 'frames.ndjson')
    await mkdir(join(workspace, '.codex', 'agents'), { recursive: true })
    await writeFile(join(workspace, '.codex', 'agents', 'reviewer.toml'), [
      'name = "reviewer"',
      'description = "Reviews changes."',
      'model = "gpt-5.4"',
      'model_reasoning_effort = "medium"',
      'sandbox_mode = "read-only"',
      'developer_instructions = "Review code with evidence."',
    ].join('\n'))
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_CAPTURE_ENV', '1')
    const service = new CommonspaceHostService({}, { ...acpConfig(root), defaultCwd: workspace }, { discoverAgents: async () => [] })
    await service.initialize()
    await service.discoverAgents('codex')
    await service.mutate({ action: 'add-discovered-agent', agentId: 'codex-reviewer' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-reviewer' }, text: 'Review this.' })
    await service.whenIdle()
    await service.close()

    const frames = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(frames.find(frame => frame.event === 'environment')).toMatchObject({
      codexConfig: {
        developer_instructions: 'Review code with evidence.',
        model: 'gpt-5.4',
        model_reasoning_effort: 'medium',
        sandbox_mode: 'read-only',
      },
    })
  })

  it.each(['codex', 'hermes'] as const)('persists a sanitized %s activity trace on the reply', async (adapter) => {
    const root = await mkdtemp(join(tmpdir(), `commonspace-${adapter}-trace-`))
    roots.push(root)
    vi.stubEnv('FAKE_ACP_TRACE', '1')
    vi.stubEnv('FAKE_ACP_TRACE_PATH', join(root, 'workspace', 'package.json'))
    const discovered = adapter === 'hermes'
      ? async () => [{
          id: 'default',
          displayName: 'Default',
          adapter: 'hermes' as const,
          model: null,
          status: 'stopped' as const,
        }]
      : async () => []
    const config: CommonspaceHostConfig = adapter === 'hermes'
      ? { root, hermesAcpCommand: process.execPath, hermesAcpArgs: [fixturePath] }
      : acpConfig(root)
    const agentId = adapter === 'hermes' ? 'default' : 'codex-review-bot'
    const service = new CommonspaceHostService({}, config, { discoverAgents: discovered })

    await service.initialize()
    if (adapter === 'hermes') await service.mutate({ action: 'add-discovered-agent', agentId })
    else await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await service.send({ conversation: { kind: 'dm', id: agentId }, text: 'Keep an audit trail.' })
    await service.whenIdle()

    const reply = service.snapshot().messages[`dm:${agentId}`]?.at(-1)
    expect(reply).toMatchObject({
      authorType: 'agent',
      trace: {
        adapter,
        startedAt: expect.any(String),
        completedAt: expect.any(String),
        entries: expect.arrayContaining([
          expect.objectContaining({ type: 'reasoning', text: 'Inspecting the workspace. Choosing the smallest safe change.' }),
          expect.objectContaining({ type: 'tool', id: 'call-1', status: 'completed', input: '{\n  "path": "[host path]/workspace/package.json"\n}' }),
        ]),
      },
    })
    expect(JSON.stringify(reply)).not.toContain(root)
    await service.close()

    const persisted = JSON.parse(await readFile(join(root, 'state.json'), 'utf8'))
    expect(JSON.stringify(persisted.messages[`dm:${agentId}`]?.at(-1))).not.toContain(root)

    const restarted = new CommonspaceHostService({}, config, { discoverAgents: discovered })
    await restarted.initialize()
    expect(restarted.snapshot().messages[`dm:${agentId}`]?.at(-1)?.trace).toEqual(reply?.trace)
    await restarted.close()
  })

  it('delivers Hermes Channel turns as exact message deltas over profile-native ACP', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-hermes-acp-delta-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_CAPTURE_ENV', '1')
    const service = new CommonspaceHostService({}, {
      root,
      hermesPath: join(root, 'missing-legacy-hermes'),
      hermesAcpCommand: process.execPath,
      hermesAcpArgs: [fixturePath],
    } as CommonspaceHostConfig, {
      discoverAgents: async () => [{
        id: 'default',
        displayName: 'Default',
        adapter: 'hermes',
        model: 'gpt-test',
        status: 'stopped',
      }],
      routeAgents: async input => ({ agentIds: [input.candidates[0]!.id], reason: 'Test inference selected the channel agent.' }),
    })
    await service.initialize()
    await service.mutate({ action: 'add-discovered-agent', agentId: 'default' })
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'general',
      agentIds: ['default'],
    })).channels[0]!

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Historical room message.' })
    await service.whenIdle()
    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'is the acp finished for @@commonspace' })
    await service.whenIdle()
    await service.close()

    const frames = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    const deliveredText = frames
      .filter(frame => frame.method === 'session/prompt')
      .map(frame => frame.params.prompt.map((part: { text?: string }) => part.text ?? '').join(''))
    expect(deliveredText).toEqual([
      'Historical room message.',
      'is the acp finished for @@commonspace',
    ])
    expect(deliveredText.join('\n')).not.toContain('Recent room history:')
    expect(deliveredText.join('\n')).not.toContain('Execution contract:')
    expect(frames.find(frame => frame.event === 'environment')).toMatchObject({
      noBrowser: '1',
      argv: ['-p', 'default', 'acp'],
    })
  })

  it('persists and reloads opaque ACP session identifiers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-acp-opaque-session-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_SESSION_ID', 'codex:thread/opaque-session-01')
    const service = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Start opaque.' })
    await service.whenIdle()
    expect(service.snapshot().agentSessions['codex-review-bot']?.['Bot Chat']).toBe('codex:thread/opaque-session-01')
    await service.close()

    const restarted = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await restarted.initialize()
    await restarted.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Resume opaque.' })
    await restarted.whenIdle()
    await restarted.close()

    const frames = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(frames.find(frame => frame.method === 'session/load')?.params.sessionId).toBe('codex:thread/opaque-session-01')
  })

  it('maps Commonspace model, reasoning, and safety settings onto ACP session configuration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-acp-host-settings-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_SETTINGS', '1')
    const service = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-test' })
    await service.mutate({ action: 'set-defaults', reasoning: 'high' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Use my settings.' })
    await service.whenIdle()
    await service.close()

    const frames = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(frames.find(frame => frame.method === 'session/set_mode')?.params.modeId).toBe('agent')
    expect(frames.filter(frame => frame.method === 'session/set_config_option').map(frame => frame.params))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ configId: 'model', value: 'gpt-test' }),
        expect.objectContaining({ configId: 'reasoning_effort', value: 'high' }),
      ]))
  })

  it('maps Hermes Channel model and workspace edit approval onto native ACP controls', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-hermes-acp-settings-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_HERMES_SETTINGS', '1')
    const service = new CommonspaceHostService({}, {
      root,
      hermesAcpCommand: process.execPath,
      hermesAcpArgs: [fixturePath],
    }, {
      discoverAgents: async () => [{
        id: 'default',
        displayName: 'Default',
        adapter: 'hermes',
        model: 'profile-default',
        status: 'stopped',
      }],
      routeAgents: async input => ({ agentIds: [input.candidates[0]!.id], reason: 'Test inference selected the channel agent.' }),
    })
    await service.initialize()
    await service.mutate({ action: 'add-discovered-agent', agentId: 'default' })
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'general',
      agentIds: ['default'],
    })).channels[0]!
    await service.mutate({
      action: 'set-channel-settings',
      channelId: channel.id,
      model: 'openai:hermes-test',
    })

    await service.send({ conversation: { kind: 'channel', id: channel.id }, text: 'Use native settings.' })
    await service.whenIdle()
    await service.close()

    const frames = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    // The fake Hermes session starts in accept_edits, so ACP may skip a redundant mode change.
    expect(frames.find(frame => frame.method === 'session/set_mode')?.params.modeId ?? 'accept_edits').toBe('accept_edits')
    expect(frames.find(frame => frame.method === 'session/set_model')?.params.modelId).toBe('openai:hermes-test')
  })

  it('cancels the active native ACP turn when a DM crosses a hard reset boundary', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-acp-reset-cancel-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_HANG_PROMPT', '1')
    const service = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    try {
      await service.initialize()
      await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
      await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Long turn.' })
      await vi.waitFor(async () => {
        expect((await readFile(logPath, 'utf8')).includes('session/prompt')).toBe(true)
      })

      await service.mutate({ action: 'reset-dm', agentId: 'codex-review-bot' })
      await vi.waitFor(async () => {
        expect((await readFile(logPath, 'utf8')).includes('session/cancel')).toBe(true)
      }, { timeout: 3_000 })
      await service.whenIdle()
      expect(service.snapshot().messages['dm:codex-review-bot']).toEqual([
        expect.objectContaining({ text: 'Long turn.', replyStatus: 'error', replyError: 'Interrupted by /new.' }),
        expect.objectContaining({ authorId: 'dm-session-boundary', text: 'New session started' }),
      ])
    } finally {
      await service.close()
    }
  })

  it('closes an active ACP turn without publishing a shutdown failure or leaving it running', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-acp-shutdown-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_HANG_PROMPT', '1')
    const service = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Long turn.' })
    await vi.waitFor(async () => {
      expect((await readFile(logPath, 'utf8')).includes('session/prompt')).toBe(true)
    })

    await expect(Promise.race([
      service.close().then(() => 'closed'),
      new Promise(resolve => setTimeout(() => resolve('timed-out'), 1_500)),
    ])).resolves.toBe('closed')
    expect(service.snapshot().messages['dm:codex-review-bot']).toEqual([
      expect.objectContaining({
        authorType: 'user',
        replyStatus: 'error',
        replyError: 'Commonspace shut down before the agent completed.',
      }),
    ])
  })

  it('keeps the ACP CLI connected until its turn finishes during a development restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-acp-development-restart-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    vi.stubEnv('FAKE_ACP_PROMPT_DELAY_MS', '150')
    const service = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await service.initialize()
    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await service.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Finish across the reload request.' })
    await vi.waitFor(async () => {
      expect((await readFile(logPath, 'utf8')).includes('session/prompt')).toBe(true)
    })

    const drain = service.drainAndClose()
    await expect(Promise.race([
      drain.then(() => 'closed'),
      new Promise(resolve => setTimeout(() => resolve('still-running'), 25)),
    ])).resolves.toBe('still-running')
    await drain

    expect(service.snapshot().messages['dm:codex-review-bot']).toEqual([
      expect.objectContaining({ authorType: 'user', replyStatus: 'complete' }),
      expect.objectContaining({ authorType: 'agent', text: 'Echo: Finish across the reload request.' }),
    ])
  })

  it('does not replace a persisted ACP session for a transient load failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-acp-load-transient-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    const initial = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await initial.initialize()
    await initial.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await initial.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Create native state.' })
    await initial.whenIdle()
    await initial.close()

    vi.stubEnv('FAKE_ACP_LOAD_ERROR', 'authentication service temporarily unavailable')
    const restarted = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await restarted.initialize()
    await restarted.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Do not replace this session.' })
    await restarted.whenIdle()
    const state = restarted.snapshot()
    expect(state.agentSessions['codex-review-bot']?.['Bot Chat']).toBe('123e4567-e89b-42d3-a456-426614174000')
    expect(state.messages['dm:codex-review-bot']?.at(-1)?.authorType).toBe('system')
    expect(state.messages['dm:codex-review-bot']?.at(-1)?.text)
      .not.toContain('123e4567-e89b-42d3-a456-426614174000')
    await restarted.close()

    const frames = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(frames.filter(frame => frame.method === 'session/new')).toHaveLength(1)
    expect(frames.filter(frame => frame.method === 'session/load')).toHaveLength(1)
  })

  it('replaces a persisted ACP session exactly once when the native session is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-acp-load-missing-'))
    roots.push(root)
    const logPath = join(root, 'frames.ndjson')
    vi.stubEnv('FAKE_ACP_LOG', logPath)
    const initial = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await initial.initialize()
    await initial.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })
    await initial.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Create native state.' })
    await initial.whenIdle()
    await initial.close()

    vi.stubEnv('FAKE_ACP_LOAD_ERROR', 'native session not found')
    const restarted = new CommonspaceHostService({}, acpConfig(root), { discoverAgents: async () => [] })
    await restarted.initialize()
    await restarted.send({ conversation: { kind: 'dm', id: 'codex-review-bot' }, text: 'Recover once.' })
    await restarted.whenIdle()
    expect(restarted.snapshot().messages['dm:codex-review-bot']?.at(-1)?.text).toBe('Echo: Recover once.')
    await restarted.close()

    const frames = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(frames.filter(frame => frame.method === 'session/load')).toHaveLength(1)
    expect(frames.filter(frame => frame.method === 'session/new')).toHaveLength(2)
  })
})
