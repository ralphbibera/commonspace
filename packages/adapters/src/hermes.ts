import type { CommonspaceAgentProfile, CommonspaceMessage, CommonspaceReasoning } from '@commonspace/shared'

const ESCAPE = String.fromCharCode(27)

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

export interface HermesInvocationInput {
  profile: string
  cwd: string
  sessionName: string
  queryFile: string
  hermesPath?: string
  yolo?: boolean
  model?: string
  reasoning?: CommonspaceReasoning
}

export interface CommonspaceTags {
  agents: string[]
  projects: string[]
  channels: string[]
}

export interface RoomPromptInput {
  channel: string
  agent: string
  userText: string
  projectPaths?: string[]
  instructions?: string
  memorySummary?: string
  decisions?: string[]
  openQuestions?: string[]
  recent: Array<Pick<CommonspaceMessage, 'authorName' | 'text'> | { authorName: string; text: string }>
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.toLocaleLowerCase()))]
}

/** Parse exact Commonspace references: @agent, @@project, and #channel. */
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
    else channels.push(value!)
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

export function buildHermesInvocation(input: HermesInvocationInput): { command: string; args: string[] } {
  return {
    command: input.hermesPath ?? 'hermes',
    args: [
      '-p', input.profile,
      'chat',
      '--in', input.cwd,
      '-c', input.sessionName,
      '--create-if-missing',
      '-Q',
      '--query-file', input.queryFile,
      '--source', 'tool',
      ...(input.model === undefined ? [] : ['--model', input.model]),
      ...(input.reasoning === undefined ? [] : ['--reasoning', input.reasoning]),
      ...(input.yolo === true ? ['--yolo'] : []),
    ],
  }
}

export function buildRoomPrompt(input: RoomPromptInput): string {
  const transcript = input.recent
    .slice(-20)
    .map(message => `${message.authorName}: ${message.text}`)
    .join('\n')
    .slice(-8_000)
  return [
    `Commonspace channel #${input.channel}.`,
    `You are responding as @${input.agent}. Other agents in Commonspace are peers, not subordinates.`,
    input.projectPaths?.length ? `Project workspaces:\n${input.projectPaths.map(path => `- ${path}`).join('\n')}` : 'Project workspaces: (none)',
    input.instructions ? `Channel instructions:\n${input.instructions}` : 'Channel instructions: (none)',
    input.memorySummary ? `Channel memory:\n${input.memorySummary}` : 'Channel memory: (empty)',
    input.decisions?.length ? `Known decisions:\n${input.decisions.map(value => `- ${value}`).join('\n')}` : 'Known decisions: (none)',
    input.openQuestions?.length ? `Open questions:\n${input.openQuestions.map(value => `- ${value}`).join('\n')}` : 'Open questions: (none)',
    'Respond with a concise, useful room message. Hand work directly to a named peer with @profile when appropriate. Do not narrate private chain-of-thought.',
    transcript === '' ? 'Recent room history: (empty)' : `Recent room history:\n${transcript}`,
    `New message from Ralph:\n${input.userText}`,
  ].join('\n\n')
}

export function routeChannelAgents(
  memberIds: readonly string[],
  text: string,
  agents: readonly Pick<CommonspaceAgentProfile, 'id'>[],
): string[] {
  const members = new Set(memberIds)
  const knownAgents = new Set(agents.map(agent => agent.id))
  const memberByNormalizedId = new Map(memberIds.map(id => [id.toLocaleLowerCase(), id]))
  const mentioned = parseTags(text).agents
    .map(id => memberByNormalizedId.get(id))
    .filter((id): id is string => id !== undefined && members.has(id) && knownAgents.has(id))
  return mentioned.length > 0 ? [...new Set(mentioned)] : [...memberIds]
}
