import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentAdapterKind } from '../packages/shared/src/contracts.ts'
import { CommonspaceHostService } from '../server/src/service.ts'

const live = process.env.COMMONSPACE_LIVE_ADAPTERS === '1'
const roots: string[] = []

async function waitForAgentText(service: CommonspaceHostService, agentId: string, text: string): Promise<void> {
  await vi.waitFor(async () => {
    const messages = (await service.bootstrap()).state.messages[`dm:${agentId}`] ?? []
    const failure = messages.find(message => message.authorType === 'system')
    if (failure !== undefined) throw new Error(failure.text)
    expect(messages.some(message => message.authorType === 'agent' && message.text.includes(text))).toBe(true)
  }, { timeout: 180_000, interval: 500 })
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe.skipIf(!live).sequential('installed Commonspace agent adapters', () => {
  async function verifyAdapter(adapter: Exclude<AgentAdapterKind, 'hermes'>, displayName: string, firstText: string, resumedText: string): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), `commonspace-${adapter}-`))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, {
      root,
      runBudgetSeconds: 120,
      maxClaudeTurns: 4,
    }, {
      discoverAgents: async () => [],
    })
    await service.initialize()
    const state = await service.mutate({ action: 'add-agent', displayName, adapter, model: null })
    const agent = state.agents[0]!

    await service.send({
      conversation: { kind: 'dm', id: agent.id },
      text: `Reply with exactly ${firstText} and nothing else. Do not use tools.`,
    })
    await waitForAgentText(service, agent.id, firstText)
    const firstSession = service.snapshot().agentSessions[agent.id]?.['Bot Chat']
    expect(firstSession).toMatch(/^[0-9a-f-]{36}$/i)

    await service.send({
      conversation: { kind: 'dm', id: agent.id },
      text: `Reply with exactly ${resumedText} and nothing else. Do not use tools.`,
    })
    await waitForAgentText(service, agent.id, resumedText)
    expect(service.snapshot().agentSessions[agent.id]?.['Bot Chat']).toBe(firstSession)
  }

  it('starts and resumes Codex sessions', async () => {
    await verifyAdapter('codex', 'Live Codex', 'CODEX_ADAPTER_OK', 'CODEX_RESUME_OK')
  }, 240_000)

  it('starts and resumes Claude Code sessions', async () => {
    await verifyAdapter('claude-code', 'Live Claude', 'CLAUDE_ADAPTER_OK', 'CLAUDE_RESUME_OK')
  }, 240_000)
})
