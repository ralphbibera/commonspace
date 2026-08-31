import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'
import { addTestHarness } from './test-harnesses.ts'

const live = process.env.COMMONSPACE_LIVE_ACP === '1'
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
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe.skipIf(!live).sequential('installed Commonspace ACP agents', () => {
  it('starts and resumes Codex sessions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-codex-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, {
      root,
      runBudgetSeconds: 120,
    })
    try {
      await service.initialize()
      const agent = await addTestHarness(service, 'codex', 'Live Codex')

      await service.send({
        conversation: { kind: 'dm', id: agent.id },
        text: 'Reply with exactly CODEX_ACP_OK and nothing else. Do not use tools.',
      })
      await waitForAgentText(service, agent.id, 'CODEX_ACP_OK')
      const firstSession = service.snapshot().agentSessions[agent.id]?.['Bot Chat']
      expect(firstSession).toEqual(expect.any(String))

      await service.send({
        conversation: { kind: 'dm', id: agent.id },
        text: 'Reply with exactly CODEX_RESUME_OK and nothing else. Do not use tools.',
      })
      await waitForAgentText(service, agent.id, 'CODEX_RESUME_OK')
      expect(service.snapshot().agentSessions[agent.id]?.['Bot Chat']).toBe(firstSession)
    } finally {
      await service.close()
    }
  }, 240_000)

  it('starts and resumes Hermes sessions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-hermes-'))
    roots.push(root)
    const service = new CommonspaceHostService({} as never, {
      root,
      runBudgetSeconds: 120,
    })
    try {
      await service.initialize()
      const discovered = (await service.discoverAgents('hermes')).discoveredAgents.find(agent => agent.id === 'default')
      if (discovered === undefined) throw new Error('Hermes default profile is not installed')
      await service.mutate({ action: 'add-discovered-agent', agentId: discovered.id })

      await service.send({
        conversation: { kind: 'dm', id: discovered.id },
        text: 'Reply with exactly HERMES_ACP_OK and nothing else. Do not use tools.',
      })
      await waitForAgentText(service, discovered.id, 'HERMES_ACP_OK')
      const firstSession = service.snapshot().agentSessions[discovered.id]?.['Bot Chat']
      expect(firstSession).toEqual(expect.any(String))

      await service.send({
        conversation: { kind: 'dm', id: discovered.id },
        text: 'Reply with exactly HERMES_RESUME_OK and nothing else. Do not use tools.',
      })
      await waitForAgentText(service, discovered.id, 'HERMES_RESUME_OK')
      expect(service.snapshot().agentSessions[discovered.id]?.['Bot Chat']).toBe(firstSession)
    } finally {
      await service.close()
    }
  }, 240_000)
})
