import type { AgentAdapterKind, CommonspaceAgentDefinition, CommonspaceAgentProfile, CommonspaceMutation, CommonspaceState } from '@commonspace/shared'
import { agentTagName, COMMONSPACE_STATE_VERSION, projectTagName, referencedProjectIds, uniqueAgentDisplayName } from '@commonspace/shared'
import { projectChannelMemory } from './memory.js'

export const DM_SESSION_BOUNDARY_AUTHOR_ID = 'dm-session-boundary'

export interface StateDependencies {
  ids(): string
  now(): string
}

const defaults: StateDependencies = {
  ids: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
}

const COMMONSPACE_REASONING_VALUES = new Set<CommonspaceState['defaults']['reasoning']>([
  'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
])

export function isCommonspaceReasoning(value: unknown): value is CommonspaceState['defaults']['reasoning'] {
  return typeof value === 'string' && COMMONSPACE_REASONING_VALUES.has(value as CommonspaceState['defaults']['reasoning'])
}

function requiredReasoning(value: unknown): CommonspaceState['defaults']['reasoning'] {
  if (!isCommonspaceReasoning(value)) throw new Error('unsupported reasoning value')
  return value
}

function optionalModel(value: unknown, current: string | null): string | null {
  if (value === undefined) return current
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('model must be a string or null')
  const normalized = value.trim()
  return normalized === '' ? null : normalized.slice(0, 200)
}

function boundedInteger(value: unknown, current: number, minimum: number, maximum: number, label: string): number {
  if (value === undefined) return current
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`)
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)))
}

export function emptyChannelMemory() {
  return {
    summary: '',
    decisions: [],
    openQuestions: [],
    threadIds: [],
    updatedAt: null,
    origin: 'automatic' as const,
    status: 'empty' as const,
    sourceMessageCount: 0,
    estimatedTokens: 0,
    compactedThroughMessageId: null,
  }
}

function normalizedContextEntries(value: unknown, label: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return [...new Set(value.map((entry) => {
    if (typeof entry !== 'string') throw new Error(`${label} must contain only strings`)
    return entry.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 2_000)
  }).filter(Boolean))].slice(0, 50)
}

export function defaultRunSettings() {
  return { model: null, reasoning: null }
}

export function defaultCommonspaceDefaults() {
  return { ...defaultRunSettings(), reasoning: 'max' as const, maxAgentsPerTurn: 4, memoryThreads: 12 }
}

function normalizedName(value: string, label: string): string {
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 80)
  if (name === '') throw new Error(`${label} name is required`)
  return name
}

function normalizedAvatarEmoji(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const emoji = value.normalize('NFKC').trim().slice(0, 16)
  return emoji === '' ? undefined : emoji
}

function normalizedAccentColor(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const color = value.trim().toLocaleLowerCase()
  if (!/^#[0-9a-f]{6}$/u.test(color)) throw new Error('agent accent color must be a six-digit hex color')
  return color
}

function normalizedChannel(value: string): string {
  const name = value.normalize('NFKC').trim().replace(/^#+/, '').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/g, '')
  if (name === '') throw new Error('channel name is required')
  return name
}

export function managedAgentId(adapter: Exclude<AgentAdapterKind, 'hermes'>, displayName: string): string {
  return `${adapter}-${normalizedChannel(normalizedName(displayName, 'agent'))}`
}

function nextRevision(state: CommonspaceState): number {
  return Math.max(0, state.revision) + 1
}

export function createInitialState(): CommonspaceState {
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: 0,
    inboxReadAt: null,
    inboxReadMessageIds: [],
    inboxSavedItemIds: [],
    followedSessionIds: [],
    mutedSessionIds: [],
    defaults: defaultCommonspaceDefaults(),
    agents: [],
    dmSessions: {},
    agentSessions: {},
    projects: [],
    channels: [],
    threads: [],
    messages: {},
  }
}

export function addDiscoveredAgent(
  state: CommonspaceState,
  agent: CommonspaceAgentProfile,
  dependencies: StateDependencies = defaults,
): CommonspaceState {
  if (agent.adapter !== 'hermes' && agent.adapter !== 'codex') throw new Error('unsupported agent adapter')
  if (agent.adapter === 'hermes' && (agent.id.trim() !== agent.id || agent.id === '' || agent.id.length > 200 || /\s/u.test(agent.id))) {
    throw new Error('invalid discovered agent id')
  }
  const nativeProfile = agent.adapter === 'codex' ? agent.nativeProfile : undefined
  if (agent.adapter === 'codex' && (nativeProfile === undefined || nativeProfile.trim() !== nativeProfile || nativeProfile === '' || nativeProfile.length > 200 || /\s/u.test(nativeProfile))) {
    throw new Error('invalid native Codex profile')
  }
  const displayName = uniqueAgentDisplayName(
    normalizedName(agent.displayName, 'agent'),
    agent.adapter,
    state.agents,
  )
  const id = agent.adapter === 'hermes' ? agent.id : managedAgentId('codex', nativeProfile!)
  if (state.agents.some(candidate => candidate.id === id)) throw new Error(`agent ${displayName} already exists`)
  return {
    ...state,
    revision: nextRevision(state),
    agents: [...state.agents, {
      id,
      displayName,
      adapter: agent.adapter,
      ...(nativeProfile === undefined ? {} : { nativeProfile }),
      model: optionalModel(agent.model, null),
      createdAt: dependencies.now(),
    }],
  }
}

export function applyMutation(
  state: CommonspaceState,
  mutation: CommonspaceMutation,
  dependencies: StateDependencies = defaults,
): CommonspaceState {
  switch (mutation.action) {
    case 'mark-inbox-read': {
      const readAt = dependencies.now()
      if (state.inboxReadAt !== null && state.inboxReadAt >= readAt && state.inboxReadMessageIds.length === 0) return state
      return { ...state, revision: nextRevision(state), inboxReadAt: readAt, inboxReadMessageIds: [] }
    }
    case 'mark-inbox-item-read': {
      const messageId = mutation.messageId.trim()
      const message = Object.values(state.messages).flat().find(candidate =>
        candidate.id === messageId && (candidate.authorType === 'agent' || (candidate.authorType === 'system' && /\brun failed:/iu.test(candidate.text)) || candidate.replyStatus === 'error' || candidate.replyStatus === 'failed' || candidate.replyStatus === 'timeout' || candidate.replyStatus === 'silent' || candidate.replyStatus === 'needs_input'))
      if (message === undefined) throw new Error('inbox item not found')
      if (state.inboxReadMessageIds.includes(messageId)) return state
      return {
        ...state,
        revision: nextRevision(state),
        inboxReadMessageIds: [...state.inboxReadMessageIds, messageId],
      }
    }
    case 'set-inbox-item-saved': {
      const messageId = mutation.messageId.trim()
      const message = Object.values(state.messages).flat().find(candidate =>
        candidate.id === messageId && (candidate.authorType === 'agent' || (candidate.authorType === 'system' && /\brun failed:/iu.test(candidate.text)) || candidate.replyStatus === 'error' || candidate.replyStatus === 'failed' || candidate.replyStatus === 'timeout' || candidate.replyStatus === 'silent' || candidate.replyStatus === 'needs_input'))
      if (message === undefined) throw new Error('inbox item not found')
      const inboxSavedItemIds = mutation.saved
        ? [...new Set([...state.inboxSavedItemIds, messageId])]
        : state.inboxSavedItemIds.filter(id => id !== messageId)
      if (inboxSavedItemIds.length === state.inboxSavedItemIds.length && inboxSavedItemIds.every((id, index) => id === state.inboxSavedItemIds[index])) return state
      return { ...state, revision: nextRevision(state), inboxSavedItemIds }
    }
    case 'set-session-followed': {
      const sessionId = mutation.sessionId.trim()
      if (sessionId === '' || sessionId.length > 500) throw new Error('invalid session id')
      const followedSessionIds = mutation.followed
        ? [...new Set([...state.followedSessionIds, sessionId])]
        : state.followedSessionIds.filter(id => id !== sessionId)
      const mutedSessionIds = mutation.followed ? state.mutedSessionIds.filter(id => id !== sessionId) : state.mutedSessionIds
      if (followedSessionIds.length === state.followedSessionIds.length && mutedSessionIds.length === state.mutedSessionIds.length) return state
      return { ...state, revision: nextRevision(state), followedSessionIds, mutedSessionIds }
    }
    case 'set-session-muted': {
      const sessionId = mutation.sessionId.trim()
      if (sessionId === '' || sessionId.length > 500) throw new Error('invalid session id')
      const mutedSessionIds = mutation.muted
        ? [...new Set([...state.mutedSessionIds, sessionId])]
        : state.mutedSessionIds.filter(id => id !== sessionId)
      const followedSessionIds = mutation.muted ? state.followedSessionIds.filter(id => id !== sessionId) : state.followedSessionIds
      if (mutedSessionIds.length === state.mutedSessionIds.length && followedSessionIds.length === state.followedSessionIds.length) return state
      return { ...state, revision: nextRevision(state), followedSessionIds, mutedSessionIds }
    }
    case 'create-project': {
      const name = normalizedName(mutation.name, 'project')
      const tagName = projectTagName(name)
      if (state.projects.some(project => projectTagName(project.name) === tagName)) {
        throw new Error('project name already exists')
      }
      const paths = [...new Set(mutation.paths.map(path => path.trim()).filter(Boolean))]
      if (paths.length === 0) throw new Error('project requires at least one filesystem path')
      return {
        ...state,
        revision: nextRevision(state),
        projects: [...state.projects, {
          id: dependencies.ids(),
          name,
          paths,
          createdAt: dependencies.now(),
        }],
      }
    }
    case 'add-project-path': {
      const path = mutation.path.trim()
      if (path === '') throw new Error('project path is required')
      let matched = false
      const projects = state.projects.map(project => {
        if (project.id !== mutation.projectId) return project
        matched = true
        return project.paths.includes(path) ? project : { ...project, paths: [...project.paths, path] }
      })
      if (!matched) throw new Error('unknown project')
      return { ...state, revision: nextRevision(state), projects }
    }
    case 'remove-project': {
      if (!state.projects.some(project => project.id === mutation.projectId)) return state
      return {
        ...state,
        revision: nextRevision(state),
        projects: state.projects.filter(project => project.id !== mutation.projectId),
        threads: state.threads.map((thread) => {
          const projectIds = referencedProjectIds(thread).filter(projectId => projectId !== mutation.projectId)
          return { ...thread, projectIds, projectId: projectIds[0] ?? null }
        }),
        messages: Object.fromEntries(Object.entries(state.messages).map(([key, messages]) => [
          key,
          messages.map((message) => {
            const projectIds = referencedProjectIds(message).filter(projectId => projectId !== mutation.projectId)
            const updated = { ...message }
            if (projectIds.length === 0) {
              delete updated.projectIds
              delete updated.projectId
            } else {
              updated.projectIds = projectIds
              updated.projectId = projectIds[0]!
            }
            return updated
          }),
        ])),
      }
    }
    case 'create-channel': {
      const name = normalizedChannel(mutation.name)
      if (state.channels.some(channel => channel.name === name)) throw new Error(`channel #${name} already exists`)
      return {
        ...state,
        revision: nextRevision(state),
        channels: [...state.channels, {
          id: dependencies.ids(),
          name,
          agentIds: [...new Set(mutation.agentIds.filter(Boolean))],
          instructions: '',
          memory: emptyChannelMemory(),
          settings: defaultRunSettings(),
          createdAt: dependencies.now(),
        }],
      }
    }
    case 'set-channel-agents': {
      let matched = false
      const channels = state.channels.map(channel => {
        if (channel.id !== mutation.channelId) return channel
        matched = true
        return { ...channel, agentIds: [...new Set(mutation.agentIds.filter(Boolean))] }
      })
      if (!matched) throw new Error('unknown channel')
      return { ...state, revision: nextRevision(state), channels }
    }
    case 'set-channel-context': {
      let matched = false
      const instructions = mutation.instructions.normalize('NFKC').trim().slice(0, 8_000)
      const channels = state.channels.map(channel => {
        if (channel.id !== mutation.channelId) return channel
        matched = true
        return { ...channel, instructions }
      })
      if (!matched) throw new Error('unknown channel')
      return { ...state, revision: nextRevision(state), channels }
    }
    case 'set-channel-memory': {
      if (typeof mutation.summary !== 'string') throw new Error('channel context summary is required')
      const summary = mutation.summary.normalize('NFKC').trim().slice(0, 16_000)
      const decisions = normalizedContextEntries(mutation.decisions, 'channel context decisions')
      const openQuestions = normalizedContextEntries(mutation.openQuestions, 'channel context open questions')
      const projection = projectChannelMemory(state, mutation.channelId, state.defaults.memoryThreads)
      let matched = false
      const channels = state.channels.map(channel => {
        if (channel.id !== mutation.channelId) return channel
        matched = true
        return {
          ...channel,
          memory: {
            summary,
            decisions,
            openQuestions,
            threadIds: projection.threadIds,
            updatedAt: dependencies.now(),
            origin: 'user' as const,
            status: 'current' as const,
            sourceMessageCount: projection.sourceMessageCount ?? 0,
            estimatedTokens: projection.estimatedTokens ?? 0,
            compactedThroughMessageId: projection.compactedThroughMessageId ?? null,
          },
        }
      })
      if (!matched) throw new Error('unknown channel')
      return { ...state, revision: nextRevision(state), channels }
    }
    case 'set-channel-settings': {
      let matched = false
      const reasoning = mutation.reasoning === undefined
        ? undefined
        : mutation.reasoning === null ? null : requiredReasoning(mutation.reasoning)
      const channels = state.channels.map(channel => {
        if (channel.id !== mutation.channelId) return channel
        matched = true
        return {
          ...channel,
          settings: {
            model: optionalModel(mutation.model, channel.settings.model),
            reasoning: reasoning === undefined ? channel.settings.reasoning : reasoning,
          },
        }
      })
      if (!matched) throw new Error('unknown channel')
      return { ...state, revision: nextRevision(state), channels }
    }
    case 'set-defaults': {
      const reasoning = mutation.reasoning === undefined ? state.defaults.reasoning : requiredReasoning(mutation.reasoning)
      return {
        ...state,
        revision: nextRevision(state),
        defaults: {
          model: optionalModel(mutation.model, state.defaults.model),
          reasoning,
          maxAgentsPerTurn: boundedInteger(mutation.maxAgentsPerTurn, state.defaults.maxAgentsPerTurn, 1, 8, 'max agents per turn'),
          memoryThreads: boundedInteger(mutation.memoryThreads, state.defaults.memoryThreads, 1, 50, 'memory thread window'),
        },
      }
    }
    case 'add-agent': {
      if (mutation.adapter !== 'codex') throw new Error('unsupported agent adapter')
      const requestedName = normalizedName(mutation.displayName, 'agent')
      const id = managedAgentId(mutation.adapter, requestedName)
      if (state.agents.some(agent => agent.id === id)) throw new Error(`agent ${requestedName} already exists`)
      const displayName = uniqueAgentDisplayName(requestedName, mutation.adapter, state.agents)
      return {
        ...state,
        revision: nextRevision(state),
        agents: [...state.agents, {
          id,
          displayName,
          adapter: mutation.adapter,
          model: optionalModel(mutation.model, null),
          createdAt: dependencies.now(),
        }],
      }
    }
    case 'add-discovered-agent': {
      throw new Error('discovered agent must be resolved by the Commonspace host')
    }
    case 'update-agent-profile': {
      const displayName = normalizedName(mutation.displayName, 'agent')
      const displayHandle = agentTagName(displayName)
      if (displayHandle === 'all' || state.agents.some(agent => agent.id !== mutation.agentId && agentTagName(agent.displayName) === displayHandle)) {
        throw new Error('agent workspace name already exists')
      }
      const avatarEmoji = normalizedAvatarEmoji(mutation.avatarEmoji)
      const accentColor = normalizedAccentColor(mutation.accentColor)
      let matched = false
      const agents = state.agents.map(agent => {
        if (agent.id !== mutation.agentId) return agent
        matched = true
        const updated: CommonspaceAgentDefinition = {
          id: agent.id,
          displayName,
          ...(avatarEmoji === undefined ? {} : { avatarEmoji }),
          ...(accentColor === undefined ? {} : { accentColor }),
          adapter: agent.adapter,
          ...(agent.nativeProfile === undefined ? {} : { nativeProfile: agent.nativeProfile }),
          model: agent.model,
          createdAt: agent.createdAt,
        }
        return updated
      })
      if (!matched) throw new Error('unknown agent')
      const messages = Object.fromEntries(Object.entries(state.messages).map(([key, entries]) => [
        key,
        entries.map(message => message.authorType === 'agent' && message.authorId === mutation.agentId
          ? { ...message, authorName: displayName }
          : message),
      ]))
      return { ...state, revision: nextRevision(state), agents, messages }
    }
    case 'remove-agent': {
      if (!state.agents.some(agent => agent.id === mutation.agentId)) return state
      return {
        ...state,
        revision: nextRevision(state),
        agents: state.agents.filter(agent => agent.id !== mutation.agentId),
        dmSessions: Object.fromEntries(Object.entries(state.dmSessions).filter(([agentId]) => agentId !== mutation.agentId)),
        agentSessions: Object.fromEntries(Object.entries(state.agentSessions).filter(([agentId]) => agentId !== mutation.agentId)),
        channels: state.channels.map(channel => ({ ...channel, agentIds: channel.agentIds.filter(agentId => agentId !== mutation.agentId) })),
        messages: Object.fromEntries(Object.entries(state.messages).filter(([key]) => key !== `dm:${mutation.agentId}`)),
      }
    }
    case 'reset-dm': {
      const previousScope = state.dmSessions[mutation.agentId] ?? 'Bot Chat'
      const nextScope = `Commonspace DM: ${dependencies.ids()}`
      const scopes = state.agentSessions[mutation.agentId]
      const remainingScopes = scopes === undefined
        ? undefined
        : Object.fromEntries(Object.entries(scopes).filter(([scope]) => scope !== previousScope))
      const agentSessions = { ...state.agentSessions }
      if (remainingScopes === undefined || Object.keys(remainingScopes).length === 0) {
        delete agentSessions[mutation.agentId]
      } else {
        agentSessions[mutation.agentId] = remainingScopes
      }
      const conversation = { kind: 'dm' as const, id: mutation.agentId }
      const messageKey = `dm:${mutation.agentId}`
      const previousMessages = state.messages[messageKey] ?? []
      const messages = {
        ...state.messages,
        [messageKey]: [
          ...previousMessages.map(message => message.replyStatus === 'queued' || message.replyStatus === 'running'
            ? { ...message, replyStatus: 'error' as const, replyError: 'Interrupted by /new.' }
            : message),
          {
            id: dependencies.ids(),
            conversation,
            authorType: 'system' as const,
            authorId: DM_SESSION_BOUNDARY_AUTHOR_ID,
            authorName: 'Commonspace',
            text: 'New session started',
            createdAt: dependencies.now(),
          },
        ],
      }
      return {
        ...state,
        revision: nextRevision(state),
        dmSessions: {
          ...state.dmSessions,
          [mutation.agentId]: nextScope,
        },
        agentSessions,
        messages,
      }
    }
    case 'remove-channel': {
      if (!state.channels.some(channel => channel.id === mutation.channelId)) return state
      const removedSessionNames = new Set(state.threads
        .filter(thread => thread.channelId === mutation.channelId)
        .map(thread => `Commonspace Thread: ${thread.id}`))
      const agentSessions = Object.fromEntries(Object.entries(state.agentSessions).flatMap(([agentId, sessions]) => {
        const remaining = Object.fromEntries(Object.entries(sessions).filter(([name]) => !removedSessionNames.has(name)))
        return Object.keys(remaining).length === 0 ? [] : [[agentId, remaining]]
      })) as CommonspaceState['agentSessions']
      return {
        ...state,
        revision: nextRevision(state),
        channels: state.channels.filter(channel => channel.id !== mutation.channelId),
        threads: state.threads.filter(thread => thread.channelId !== mutation.channelId),
        agentSessions,
        messages: Object.fromEntries(Object.entries(state.messages).filter(([key]) => key !== `channel:${mutation.channelId}`)),
      }
    }
    default: {
      const neverMutation: never = mutation
      throw new Error(`unknown mutation ${JSON.stringify(neverMutation)}`)
    }
  }
}
