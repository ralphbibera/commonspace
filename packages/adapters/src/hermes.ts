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
  delivery: {
    authorType: 'user' | 'agent'
    authorId: string
    authorName: string
    text: string
  }
  rootText: string
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

export function parseHermesOutput(output: string): string {
  const kept: string[] = []
  let droppingReasoning = false
  for (const raw of stripAnsi(output).replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    if (/^┌─\s*Reasoning\b/u.test(line)) {
      droppingReasoning = true
      continue
    }
    if (droppingReasoning) {
      if (line.trim() === '') droppingReasoning = false
      continue
    }
    if (/^(?:session_id:|↻\s+(?:Resumed|Created) session\b)/u.test(line.trim())) continue
    if (/^(?:\*\*[^*\n]+\*\*){2,}$/u.test(line.trim())) continue
    kept.push(line)
  }
  return kept.join('\n').trim()
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
  const sender = input.delivery.authorType === 'agent'
    ? `@${input.delivery.authorId}`
    : input.delivery.authorName
  return [
    `Commonspace channel #${input.channel} is a live agent-to-agent room.`,
    `You are @${input.agent}. Use your provider-native identity, instructions, memory, and tools. Other room agents are peers.`,
    `Delivery envelope:\nFrom: ${sender}\nTo: @${input.agent}\nMessage:\n${input.delivery.text}`,
    input.delivery.authorType === 'agent' || input.delivery.text !== input.rootText
      ? `Root request from Ralph:\n${input.rootText}`
      : 'This message is the root request from Ralph.',
    input.projectPaths?.length ? `Project workspaces:\n${input.projectPaths.map(path => `- ${path}`).join('\n')}` : 'Project workspaces: (none)',
    input.instructions ? `Channel instructions:\n${input.instructions}` : 'Channel instructions: (none)',
    input.memorySummary ? `Channel memory:\n${input.memorySummary}` : 'Channel memory: (empty)',
    input.decisions?.length ? `Known decisions:\n${input.decisions.map(value => `- ${value}`).join('\n')}` : 'Known decisions: (none)',
    input.openQuestions?.length ? `Open questions:\n${input.openQuestions.map(value => `- ${value}`).join('\n')}` : 'Open questions: (none)',
    [
      'Execution contract:',
      '- If the current message asks for an action, use your harness tools and do the work now in the listed workspaces.',
      '- Do not stop at an acknowledgement or plan unless the message explicitly requests planning only.',
      '- If it is conversational or asks a question, answer directly.',
      '- To involve a seated peer, @mention them with a concrete request. Commonspace will deliver that message once; do not poll or wait for them.',
      '- Return one concise final room message with the outcome, evidence, or a concrete blocker. Do not include private reasoning or tool logs.',
    ].join('\n'),
    transcript === '' ? 'Recent room history: (empty)' : `Recent room history:\n${transcript}`,
  ].join('\n\n')
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
