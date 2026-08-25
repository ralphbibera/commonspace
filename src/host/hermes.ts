import type { CommonspaceMessage, HermesAgentProfile } from '../contracts.ts'

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
}

export interface RoomPromptInput {
  channel: string
  agent: string
  userText: string
  projectPaths?: string[]
  recent: Array<Pick<CommonspaceMessage, 'authorName' | 'text'> | { authorName: string; text: string }>
}

export function parseHermesProfileList(output: string): HermesAgentProfile[] {
  const profiles: HermesAgentProfile[] = []
  for (const raw of stripAnsi(output).split(/\r?\n/)) {
    const line = raw.trim().replace(/^◆\s?/, '')
    if (line === '' || line.startsWith('Profile') || /^[─\-\s]+$/.test(line)) continue

    const primary = /^(.*?)\s+\(default\)\s+(\S+)\s+(running|stopped)\b/.exec(line)
    if (primary !== null) {
      profiles.push({
        id: 'default',
        displayName: primary[1]!.trim(),
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
    `You are responding as @${input.agent}. Other Hermes profiles are peer agents, not subordinates.`,
    input.projectPaths?.length ? `Project workspaces:\n${input.projectPaths.map(path => `- ${path}`).join('\n')}` : 'Project workspaces: (none)',
    'Respond with a concise, useful room message. Hand work directly to a named peer with @profile when appropriate. Do not narrate private chain-of-thought.',
    transcript === '' ? 'Recent room history: (empty)' : `Recent room history:\n${transcript}`,
    `New message from Ralph:\n${input.userText}`,
  ].join('\n\n')
}

export function routeChannelAgents(
  memberIds: readonly string[],
  text: string,
  agents: readonly Pick<HermesAgentProfile, 'id'>[],
): string[] {
  const members = new Set(memberIds)
  const mentioned = agents
    .filter(agent => members.has(agent.id) && new RegExp(`(^|\\s)@${agent.id}(?=\\s|$|[,.!?])`, 'i').test(text))
    .map(agent => agent.id)
  return mentioned.length > 0 ? mentioned : [...memberIds]
}
