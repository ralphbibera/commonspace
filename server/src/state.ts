import type { AgentAdapterKind, CommonspaceAgentProfile, CommonspaceMutation, CommonspaceState } from '@commonspace/shared'
import { COMMONSPACE_STATE_VERSION, projectTagName } from '@commonspace/shared'

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
  return { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null }
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
  const displayName = normalizedName(agent.displayName, 'agent')
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
      if (state.inboxReadAt !== null && state.inboxReadAt >= readAt) return state
      return { ...state, revision: nextRevision(state), inboxReadAt: readAt }
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
        channels: state.channels.map(channel => channel.projectId === mutation.projectId
          ? { ...channel, projectId: null }
          : channel),
        threads: state.threads.map(thread => thread.projectId === mutation.projectId
          ? { ...thread, projectId: null }
          : thread),
      }
    }
    case 'create-channel': {
      const name = normalizedChannel(mutation.name)
      if (state.channels.some(channel => channel.name === name)) throw new Error(`channel #${name} already exists`)
      const projectId = mutation.projectId
      if (projectId !== undefined && !state.projects.some(project => project.id === projectId)) {
        throw new Error('unknown project')
      }
      return {
        ...state,
        revision: nextRevision(state),
        channels: [...state.channels, {
          id: dependencies.ids(),
          name,
          projectId: projectId ?? null,
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
      const displayName = normalizedName(mutation.displayName, 'agent')
      const id = managedAgentId(mutation.adapter, displayName)
      if (state.agents.some(agent => agent.id === id)) throw new Error(`agent ${displayName} already exists`)
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
