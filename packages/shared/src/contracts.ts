export const COMMONSPACE_STATE_VERSION = 9 as const

export type AgentAdapterKind = 'hermes' | 'codex'

export type CommonspaceReasoning = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface CommonspaceRunSettings {
  model: string | null
  reasoning: CommonspaceReasoning | null
}

export interface CommonspaceDefaults extends Omit<CommonspaceRunSettings, 'reasoning'> {
  reasoning: CommonspaceReasoning
  maxAgentsPerTurn: number
  memoryThreads: number
}

export interface CommonspaceAgentProfile {
  id: string
  displayName: string
  adapter: AgentAdapterKind
  model: string | null
  status: 'running' | 'stopped' | 'unknown'
  description?: string
}

/** @deprecated Use CommonspaceAgentProfile. */
export type HermesAgentProfile = CommonspaceAgentProfile

export interface CommonspaceAgentDefinition {
  id: string
  displayName: string
  adapter: AgentAdapterKind
  model: string | null
  createdAt: string
}

export interface CommonspaceProject {
  id: string
  name: string
  paths: string[]
  createdAt: string
}

export type CommonspaceTracePlanStatus = 'pending' | 'in_progress' | 'completed'
export type CommonspaceTraceToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface CommonspaceTracePlanStep {
  text: string
  priority: 'high' | 'medium' | 'low'
  status: CommonspaceTracePlanStatus
}

export type CommonspaceTraceEntry =
  | {
      type: 'reasoning'
      id: string
      text: string
      createdAt: string
      updatedAt: string
    }
  | {
      type: 'plan'
      id: string
      steps: CommonspaceTracePlanStep[]
      markdown?: string
      createdAt: string
      updatedAt: string
    }
  | {
      type: 'tool'
      id: string
      title: string
      toolName?: string
      toolKind?: string
      status: CommonspaceTraceToolStatus
      input?: string
      output?: string
      createdAt: string
      updatedAt: string
    }
  | {
      type: 'usage'
      id: 'usage'
      usedTokens: number
      contextWindow: number
      costAmount?: number
      costCurrency?: string
      createdAt: string
      updatedAt: string
    }

export interface CommonspaceAgentTrace {
  adapter: AgentAdapterKind
  startedAt: string
  completedAt: string
  entries: CommonspaceTraceEntry[]
}

export interface CommonspaceChannelMemory {
  summary: string
  decisions: string[]
  openQuestions: string[]
  threadIds: string[]
  updatedAt: string | null
}

export interface CommonspaceChannel {
  id: string
  name: string
  projectId: string | null
  agentIds: string[]
  instructions: string
  memory: CommonspaceChannelMemory
  settings: CommonspaceRunSettings
  createdAt: string
}

export type ConversationRef =
  | { kind: 'channel'; id: string }
  | { kind: 'dm'; id: string }

export interface CommonspaceMessage {
  id: string
  conversation: ConversationRef
  authorType: 'user' | 'agent' | 'system'
  authorId: string
  authorName: string
  text: string
  createdAt: string
  threadId?: string
  parentMessageId?: string
  /** Lifecycle of the agent reply requested by a direct-message user turn. */
  replyStatus?: CommonspaceReplyStatus
  replyError?: string
  /** Sanitized provider-emitted reasoning, plan, tool, and usage activity for this reply. */
  trace?: CommonspaceAgentTrace
}

export type CommonspaceReplyStatus = 'queued' | 'running' | 'complete' | 'error'
export type CommonspaceThreadStatus = CommonspaceReplyStatus

export interface CommonspaceThread {
  id: string
  channelId: string
  projectId: string | null
  rootMessageId: string
  agentIds: string[]
  status: CommonspaceThreadStatus
  createdAt: string
  updatedAt: string
  error?: string
}

export interface CommonspaceState {
  version: typeof COMMONSPACE_STATE_VERSION
  revision: number
  defaults: CommonspaceDefaults
  agents: CommonspaceAgentDefinition[]
  /** Host-private native session scope selected for each direct message. */
  dmSessions: Record<string, string>
  agentSessions: Record<string, Record<string, string>>
  projects: CommonspaceProject[]
  channels: CommonspaceChannel[]
  threads: CommonspaceThread[]
  messages: Record<string, CommonspaceMessage[]>
}

export interface CommonspaceBootstrap {
  agents: CommonspaceAgentProfile[]
  discoveredAgents: CommonspaceAgentProfile[]
  state: CommonspaceState
}

export type CommonspaceMutation =
  | { action: 'create-project'; name: string; paths: string[] }
  | { action: 'add-project-path'; projectId: string; path: string }
  | { action: 'remove-project'; projectId: string }
  | { action: 'create-channel'; name: string; projectId?: string; agentIds: string[] }
  | { action: 'set-channel-agents'; channelId: string; agentIds: string[] }
  | { action: 'set-channel-context'; channelId: string; instructions: string }
  | { action: 'set-channel-settings'; channelId: string; model?: string | null; reasoning?: CommonspaceReasoning | null }
  | { action: 'set-defaults'; model?: string | null; reasoning?: CommonspaceReasoning; maxAgentsPerTurn?: number; memoryThreads?: number }
  | { action: 'add-agent'; displayName: string; adapter: Exclude<AgentAdapterKind, 'hermes'>; model?: string | null }
  | { action: 'add-discovered-agent'; agentId: string }
  | { action: 'remove-agent'; agentId: string }
  | { action: 'reset-dm'; agentId: string }
  | { action: 'remove-channel'; channelId: string }

export interface SendMessageRequest {
  conversation: ConversationRef
  text: string
  projectId?: string
  threadId?: string
}

export interface SendMessageResponse {
  accepted: CommonspaceMessage
  thread?: CommonspaceThread
  state: CommonspaceState
}

export interface CommonspaceApiError {
  error: string
  code: string
}

export interface SelectDirectoryResponse {
  path: string | null
}

export function conversationKey(ref: ConversationRef): string {
  return `${ref.kind}:${ref.id}`
}
