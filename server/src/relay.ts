import type { CommonspaceAgentProfile } from '@commonspace/shared'

const ESCAPE = String.fromCharCode(27)

export interface CommonspaceTags {
  agents: string[]
  projects: string[]
  channels: string[]
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.toLocaleLowerCase()))]
}

function stripAnsi(input: string): string {
  return input
    .split(ESCAPE)
    .map((part, index) => index === 0 ? part : part.replace(/^\[[0-9;]*m/, ''))
    .join('')
}

function profileDisplayName(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => `${part.slice(0, 1).toLocaleUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function parseTags(text: string): CommonspaceTags {
  const agents: string[] = []
  const projects: string[] = []
  const channels: string[] = []
  const token = /(^|[^\p{L}\p{N}_@])(@@|@|#)([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu
  for (const match of text.matchAll(token)) {
    const kind = match[2]
    const value = match[3]
    if (kind === '@@') projects.push(value!)
    else if (kind === '@') agents.push(value!)
    else if (kind === '#') channels.push(value!)
  }
  return { agents: unique(agents), projects: unique(projects), channels: unique(channels) }
}

export function parseHermesProfileList(output: string): CommonspaceAgentProfile[] {
  const profiles: CommonspaceAgentProfile[] = []
  for (const raw of stripAnsi(output).split(/\r?\n/)) {
    const line = raw.trim().replace(/^◆\s?/, '')
    if (line === '' || line.startsWith('Profile') || /^[─\-\s]+$/.test(line)) continue

    const primary = /^(.*?)\s+\(default\)\s+(\S+)\s+(running|stopped)\b/.exec(line)
    if (primary !== null) {
      profiles.push({
        id: 'default',
        displayName: primary[1]!.trim(),
        adapter: 'hermes',
        model: primary[2]!,
        status: primary[3]! as 'running' | 'stopped',
      })
      continue
    }

    const named = /^(\S+)\s+(\S+)\s+(running|stopped)\b/.exec(line)
    if (named === null) continue
    profiles.push({
      id: named[1]!,
      displayName: profileDisplayName(named[1]!),
      adapter: 'hermes',
      model: named[2]!,
      status: named[3]! as 'running' | 'stopped',
    })
  }
  return profiles
}

export function mentionedChannelAgents(
  memberIds: readonly string[],
  text: string,
  agents: readonly Pick<CommonspaceAgentProfile, 'id'>[],
): string[] {
  const members = new Set(memberIds)
  const knownAgents = new Set(agents.map(agent => agent.id))
  const memberByNormalizedId = new Map(memberIds.map(id => [id.toLocaleLowerCase(), id]))
  return [...new Set(parseTags(text).agents
    .map(id => memberByNormalizedId.get(id))
    .filter((id): id is string => id !== undefined && members.has(id) && knownAgents.has(id)))]
}

export function routeChannelAgents(
  memberIds: readonly string[],
  text: string,
  agents: readonly Pick<CommonspaceAgentProfile, 'id'>[],
): string[] {
  const mentioned = mentionedChannelAgents(memberIds, text, agents)
  return mentioned.length > 0 ? mentioned : [...memberIds]
}
