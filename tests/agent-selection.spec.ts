import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { CommonspaceAgentProfile } from '@commonspace/shared'
import { CommonspaceHostService } from '../server/src/service.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Commonspace agent selection', () => {
  it('adds only the Hermes profile selected by the user and persists that choice', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-agent-selection-'))
    roots.push(root)
    const discoveredAgents: CommonspaceAgentProfile[] = [
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'gpt-test', status: 'running' },
      { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'gpt-test', status: 'stopped' },
    ]
    const dependencies = { discoverAgents: async () => discoveredAgents }
    const service = new CommonspaceHostService({}, { root }, dependencies)
    await service.initialize()

    expect((await service.bootstrap()).agents).toEqual([])
    expect((await service.bootstrap()).discoveredAgents).toEqual(discoveredAgents)
    await service.mutate({ action: 'add-discovered-agent', agentId: 'frontend' })
    expect((await service.bootstrap()).agents).toEqual([discoveredAgents[0]])
    await service.close()

    const restarted = new CommonspaceHostService({}, { root }, dependencies)
    await restarted.initialize()
    expect((await restarted.bootstrap()).agents).toEqual([discoveredAgents[0]])
    await restarted.close()
  })
})
