import type { CommonspaceAgentConfiguration, UpdateAgentConfigurationRequest } from '@commonspace/shared'

async function configurationRequest(agentId: string, init?: RequestInit): Promise<CommonspaceAgentConfiguration> {
  const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/configuration`, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const body = await response.json() as CommonspaceAgentConfiguration | { error?: string }
  if (!response.ok) throw new Error('error' in body && typeof body.error === 'string' ? body.error : 'Agent configuration request failed')
  return body as CommonspaceAgentConfiguration
}

export function fetchAgentConfiguration(agentId: string): Promise<CommonspaceAgentConfiguration> {
  return configurationRequest(agentId)
}

export function saveAgentConfiguration(agentId: string, update: UpdateAgentConfigurationRequest): Promise<CommonspaceAgentConfiguration> {
  return configurationRequest(agentId, { method: 'PUT', body: JSON.stringify(update) })
}
