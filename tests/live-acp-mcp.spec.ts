import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startCommonspaceServer, type RunningCommonspaceServer } from '../server/src/index.ts'

const live = process.env.COMMONSPACE_LIVE_ACP_MCP === '1'
const roots: string[] = []
const servers: RunningCommonspaceServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe.skipIf(!live).sequential('installed ACP bridge with Commonspace MCP', () => {
  it('lets real Codex read scoped Channel context and post visible progress', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-live-acp-mcp-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    const running = await startCommonspaceServer({
      root,
      port: 0,
      runBudgetSeconds: 120,
      dependencies: { discoverAgents: async () => [] },
      logger: { info: () => undefined, warn: () => undefined },
    })
    servers.push(running)
    await running.service.mutate({ action: 'add-agent', displayName: 'Live MCP', adapter: 'codex' })
    const project = (await running.service.mutate({
      action: 'create-project',
      name: 'Live MCP Workspace',
      paths: [workspace],
    })).projects[0]!
    const channel = (await running.service.mutate({
      action: 'create-channel',
      name: 'live-mcp',
      projectId: project.id,
      agentIds: ['codex-live-mcp'],
    })).channels[0]!
    await running.service.mutate({
      action: 'set-channel-context',
      channelId: channel.id,
      instructions: 'The verification token is CODEX_MCP_CONTEXT_OK.',
    })

    await running.service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: [
        'Use commonspace_get_context before answering and read the Channel instructions.',
        'Then call commonspace_post_progress with exactly CODEX_MCP_PROGRESS_OK.',
        'Finally reply with exactly the verification token from the Channel instructions and nothing else.',
      ].join(' '),
    })
    await running.service.whenIdle()
    const state = running.service.snapshot()
    const messages = state.messages[`channel:${channel.id}`] ?? []
    expect(messages.find(message => message.authorType === 'system')).toBeUndefined()
    expect(messages.some(message => message.authorType === 'agent' && message.text === 'CODEX_MCP_PROGRESS_OK')).toBe(true)
    expect(messages.some(message => message.authorType === 'agent' && message.text.includes('CODEX_MCP_CONTEXT_OK'))).toBe(true)
    expect(state.threads[0]?.status).toBe('complete')
  }, 210_000)

  it('lets real Hermes read scoped Channel context and post visible progress', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-live-hermes-mcp-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    const running = await startCommonspaceServer({
      root,
      port: 0,
      runBudgetSeconds: 120,
      logger: { info: () => undefined, warn: () => undefined },
    })
    servers.push(running)
    const discovered = (await running.service.bootstrap()).discoveredAgents.find(agent => agent.id === 'default')
    if (discovered === undefined) throw new Error('Hermes default profile is not installed')
    await running.service.mutate({ action: 'add-discovered-agent', agentId: discovered.id })
    const project = (await running.service.mutate({
      action: 'create-project',
      name: 'Live Hermes MCP Workspace',
      paths: [workspace],
    })).projects[0]!
    const channel = (await running.service.mutate({
      action: 'create-channel',
      name: 'live-hermes-mcp',
      projectId: project.id,
      agentIds: [discovered.id],
    })).channels[0]!
    await running.service.mutate({
      action: 'set-channel-context',
      channelId: channel.id,
      instructions: 'The verification token is HERMES_MCP_CONTEXT_OK.',
    })

    await running.service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: [
        'Use commonspace_get_context before answering and read the Channel instructions.',
        'Then call commonspace_post_progress with exactly HERMES_MCP_PROGRESS_OK.',
        'Finally reply with exactly the verification token from the Channel instructions and nothing else.',
      ].join(' '),
    })
    await running.service.whenIdle()
    const state = running.service.snapshot()
    const messages = state.messages[`channel:${channel.id}`] ?? []
    expect(messages.find(message => message.authorType === 'system')).toBeUndefined()
    expect(messages.some(message => message.authorType === 'agent' && message.text === 'HERMES_MCP_PROGRESS_OK')).toBe(true)
    expect(messages.some(message => message.authorType === 'agent' && message.text.includes('HERMES_MCP_CONTEXT_OK'))).toBe(true)
    expect(state.threads[0]?.status).toBe('complete')
  }, 210_000)
})
