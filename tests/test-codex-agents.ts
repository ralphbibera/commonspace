import type { CommonspaceAgentProfile } from '@commonspace/shared'
import type { CommonspaceHostService } from '../server/src/service.ts'

const DISPLAY_NAMES: Record<string, string> = {
  'codex-review-bot': 'Review Bot',
  'codex-second-bot': 'Second Bot',
  'codex-frontend': 'Frontend',
  'codex-backend': 'Backend',
  'codex-router': 'Router',
  'codex-worker': 'Worker',
  'codex-writer': 'Writer',
  'codex-live-codex': 'Live Codex',
  'codex-live-mcp': 'Live MCP',
}

export async function addTestCodexAgents(
  service: CommonspaceHostService,
  ...agentIds: string[]
): Promise<CommonspaceAgentProfile[]> {
  const discovered = (await service.discoverAgents('codex')).discoveredAgents
  const requested = agentIds.map((agentId) => {
    const agent = discovered.find(candidate => candidate.id === agentId)
    if (agent === undefined) throw new Error(`missing native Codex test profile ${agentId}`)
    return agent
  })
  for (const agent of requested) {
    await service.mutate({ action: 'add-discovered-agent', agentId: agent.id })
    const displayName = DISPLAY_NAMES[agent.id]
    if (displayName !== undefined && displayName !== agent.displayName) {
      await service.mutate({ action: 'update-agent-profile', agentId: agent.id, displayName })
    }
  }
  const configured = (await service.bootstrap()).agents
  return requested.map(agent => configured.find(candidate => candidate.id === agent.id)!)
}
