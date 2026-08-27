export const COMMONSPACE_STATE_VERSION = 11 as const

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
  /** Native harness profile name used when invoking a discovered agent. */
  nativeProfile?: string
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
  /** Native harness profile name used when invoking a discovered agent. */
  nativeProfile?: string
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

export type CommonspaceImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

/** Public metadata for image bytes managed privately by the Commonspace host. */
export interface CommonspaceImageAttachment {
  id: string
  name: string
  mimeType: CommonspaceImageMimeType
  size: number
}

/** Base64 image payload accepted only at the local send boundary. */
export interface SendImageAttachment {
  name: string
  mimeType: CommonspaceImageMimeType
  data: string
}

/** Provider-emitted activity for an agent turn that is still running. */
export interface CommonspaceLiveAgentActivity {
  id: string
  agentId: string
  agentName: string
  adapter: AgentAdapterKind
  conversation: ConversationRef
  threadId?: string
  startedAt: string
  entries: CommonspaceTraceEntry[]
}

export interface CommonspaceMessage {
  id: string
  conversation: ConversationRef
  authorType: 'user' | 'agent' | 'system'
  authorId: string
  authorName: string
  text: string
  attachments?: CommonspaceImageAttachment[]
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
  /** Single-owner cursor for activity shown in the Inbox. */
  inboxReadAt: string | null
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
  liveActivities?: CommonspaceLiveAgentActivity[]
}

export interface DiscoverAgentsRequest {
  adapter: AgentAdapterKind
}

export type CommonspaceMutation =
  | { action: 'mark-inbox-read' }
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
  /** Restrict a channel-thread reply to one current channel agent. */
  targetAgentId?: string
  attachments?: SendImageAttachment[]
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
