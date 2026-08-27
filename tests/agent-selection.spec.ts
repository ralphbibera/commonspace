import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    const discoverAgents = vi.fn(async () => discoveredAgents)
    const dependencies = { discoverAgents }
    const service = new CommonspaceHostService({}, { root }, dependencies)
    await service.initialize()

    expect((await service.bootstrap()).agents).toEqual([])
    expect((await service.bootstrap()).discoveredAgents).toEqual([])
    expect(discoverAgents).not.toHaveBeenCalled()
    expect((await service.discoverAgents('hermes')).discoveredAgents).toEqual(discoveredAgents)
    expect(discoverAgents).toHaveBeenCalledOnce()
    await service.mutate({ action: 'add-discovered-agent', agentId: 'frontend' })
    expect((await service.bootstrap()).agents).toEqual([discoveredAgents[0]])
    await service.close()

    const restarted = new CommonspaceHostService({}, { root }, dependencies)
    await restarted.initialize()
    expect((await restarted.bootstrap()).agents).toEqual([{
      ...discoveredAgents[0],
      status: 'unknown',
    }])
    expect((await restarted.discoverAgents('hermes')).agents).toEqual([discoveredAgents[0]])
    await restarted.close()
  })

  it('persists a Commonspace-local agent name and appearance without changing the native profile', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-agent-identity-'))
    roots.push(root)
    const discoveredAgent: CommonspaceAgentProfile = {
      id: 'frontend',
      displayName: 'Frontend',
      adapter: 'hermes',
      model: 'gpt-test',
      status: 'running',
    }
    const dependencies = { discoverAgents: vi.fn(async () => [discoveredAgent]) }
    const service = new CommonspaceHostService({}, { root }, dependencies)
    await service.initialize()
    await service.discoverAgents('hermes')
    await service.mutate({ action: 'add-discovered-agent', agentId: 'frontend' })

    await service.mutate({
      action: 'update-agent-profile',
      agentId: 'frontend',
      displayName: 'Atlas',
      avatarEmoji: '🧭',
      accentColor: '#7c3aed',
    })

    expect((await service.bootstrap()).agents).toEqual([expect.objectContaining({
      id: 'frontend',
      displayName: 'Atlas',
      avatarEmoji: '🧭',
      accentColor: '#7c3aed',
      adapter: 'hermes',
      status: 'running',
    })])
    await service.close()

    const statePath = join(root, 'state.json')
    const persisted = JSON.parse(await readFile(statePath, 'utf8')) as Record<string, unknown>
    await writeFile(statePath, JSON.stringify({ ...persisted, version: 11 }))

    const restarted = new CommonspaceHostService({}, { root }, dependencies)
    await restarted.initialize()
    expect((await restarted.bootstrap()).agents).toEqual([expect.objectContaining({
      id: 'frontend',
      displayName: 'Atlas',
      avatarEmoji: '🧭',
      accentColor: '#7c3aed',
      adapter: 'hermes',
      status: 'unknown',
    })])
    await restarted.close()
  })

  it('does not discover Hermes while adding a Codex agent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-codex-selection-'))
    roots.push(root)
    const discoverAgents = vi.fn(async () => [])
    const service = new CommonspaceHostService({}, { root }, { discoverAgents })
    await service.initialize()

    await service.mutate({ action: 'add-agent', displayName: 'Review Bot', adapter: 'codex' })

    expect(discoverAgents).not.toHaveBeenCalled()
    expect((await service.bootstrap()).discoveredAgents).toEqual([])
    await service.close()
  })

  it('discovers and persists a selected native Codex agent profile', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-codex-profile-selection-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(join(workspace, '.codex', 'agents'), { recursive: true })
    await writeFile(join(workspace, '.codex', 'agents', 'reviewer.toml'), [
      'name = "reviewer"',
      'description = "Reviews changes."',
      'developer_instructions = "Review code with evidence."',
    ].join('\n'))
    const service = new CommonspaceHostService({}, { root, defaultCwd: workspace }, { discoverAgents: async () => [] })
    await service.initialize()

    const discovery = await service.discoverAgents('codex')
    expect(discovery.discoveredAgents).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'codex-reviewer', adapter: 'codex', nativeProfile: 'reviewer' }),
    ]))
    await service.mutate({ action: 'add-discovered-agent', agentId: 'codex-reviewer' })

    expect(service.snapshot().agents).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'codex-reviewer', adapter: 'codex', nativeProfile: 'reviewer' }),
    ]))
    await service.close()
  })
})
