function referenceTagName(value: string, kind: 'agent' | 'project'): string {
  const tag = value.normalize('NFKC').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '')
  if (tag === '') throw new Error(`${kind} name must contain a letter or number`)
  return tag
}

export function agentTagName(value: string): string {
  return referenceTagName(value, 'agent')
}

export interface AgentMentionIdentity {
  id: string
  displayName: string
}

export function agentMentionName(agent: AgentMentionIdentity): string {
  return agentTagName(agent.displayName)
}

export function uniqueAgentDisplayName(
  requestedName: string,
  adapter: 'hermes' | 'codex',
  agents: readonly AgentMentionIdentity[],
): string {
  const usedHandles = new Set(agents.map(agentMentionName))
  const isAvailable = (name: string) => {
    const handle = agentTagName(name)
    return handle !== 'all' && !usedHandles.has(handle)
  }
  if (isAvailable(requestedName)) return requestedName

  const runtime = adapter === 'hermes' ? 'Hermes' : 'Codex'
  for (let index = 1; ; index += 1) {
    const suffix = ` (${runtime}${index === 1 ? '' : ` ${index}`})`
    const candidate = `${requestedName.slice(0, 80 - suffix.length).trimEnd()}${suffix}`
    if (isAvailable(candidate)) return candidate
  }
}

export function projectTagName(value: string): string {
  return referenceTagName(value, 'project')
}
