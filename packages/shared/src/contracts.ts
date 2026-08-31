export const COMMONSPACE_STATE_VERSION = 17 as const

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

export type CommonspaceRoutingProvider = 'harness' | 'openai-compatible'

/** Public, Commonspace-wide AI routing configuration. Credentials are never included. */
export interface CommonspaceRoutingConfiguration {
  provider: CommonspaceRoutingProvider
  model: string
  harnessAgentId: string | null
  baseUrl: string
  apiKeyConfigured: boolean
}

export type UpdateRoutingConfigurationRequest =
  | { provider: 'harness'; harnessAgentId: string }
  | {
      provider: 'openai-compatible'
      model: string
      baseUrl?: string
      /** Omit to preserve the saved key, provide a value to replace it, or null to clear it. */
      apiKey?: string | null
    }

export interface CommonspaceRoutingAssignment {
  id: string
  agentId: string
  subRequest: string
  projectIds: string[]
}

export interface CommonspaceRoutingDecision {
  source: 'explicit' | 'ai' | 'local'
  status?: 'pending' | 'resolved' | 'failed'
  agentIds: string[]
  assignments: CommonspaceRoutingAssignment[]
  confidence?: number
  reason: string
}

export interface CommonspaceAgentProfile {
  id: string
  displayName: string
  /** Commonspace-local appearance; never used to address the native harness. */
  avatarEmoji?: string
  accentColor?: string
  adapter: AgentAdapterKind
  /** @deprecated Legacy imported profile reference retained only for persisted-history compatibility. */
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
  /** Commonspace-local appearance; never used to address the native harness. */
  avatarEmoji?: string
  accentColor?: string
  adapter: AgentAdapterKind
  /** @deprecated Legacy imported profile reference retained only for persisted-history compatibility. */
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

export interface CommonspaceRunFileChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'
  preExisting: boolean
  additions: number | null
  deletions: number | null
  patch?: string
  patchTruncated?: boolean
}

export type CommonspaceRunRootAttribution =
  | {
      available: true
      rootIndex: number
      /** Project that owns this root when a run spans multiple Projects. */
      projectId?: string
      /** Root index inside the owning Project. */
      projectRootIndex?: number
      branch: string | null
      headBefore: string | null
      headAfter: string | null
      preExisting: Array<{
        path: string
        status: CommonspaceRunFileChange['status']
      }>
      observed: CommonspaceRunFileChange[]
    }
  | {
      available: false
      rootIndex: number
      /** Project that owns this root when a run spans multiple Projects. */
      projectId?: string
      /** Root index inside the owning Project. */
      projectRootIndex?: number
      reason: string
    }

export interface CommonspaceRunAttribution {
  startedAt: string
  completedAt: string
  roots: CommonspaceRunRootAttribution[]
}

export interface CommonspaceChannelMemory {
  summary: string
  decisions: string[]
  openQuestions: string[]
  threadIds: string[]
  updatedAt: string | null
  /** How the current compacted representation was produced. */
  origin?: 'automatic' | 'inference' | 'user'
  /** Whether newer source messages exist beyond the current representation. */
  status?: 'empty' | 'current' | 'stale'
  sourceMessageCount?: number
  estimatedTokens?: number
  compactedThroughMessageId?: string | null
}

export interface UpdateChannelContextRequest {
  summary: string
  decisions?: string[]
  openQuestions?: string[]
}

export interface CommonspaceChannel {
  id: string
  name: string
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
  /** User message whose delivery started this agent run. */
  sourceMessageId: string
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
  /** Authoritative Project context for this message; Channels themselves are global. */
  projectIds?: string[]
  /** @deprecated Compatibility mirror of the first projectIds entry. */
  projectId?: string
  threadId?: string
  parentMessageId?: string
  /** User message that initiated the agent run represented by this message. */
  sourceMessageId?: string
  /** Lifecycle of the agent reply requested by a direct-message user turn. */
  replyStatus?: CommonspaceReplyStatus
  replyError?: string
  /** Sanitized provider-emitted reasoning, plan, tool, and usage activity for this reply. */
  trace?: CommonspaceAgentTrace
  /** Repository changes observed between this run's start and completion. */
  runAttribution?: CommonspaceRunAttribution
  /** Inspectable routing decision for a channel user message. */
  routing?: CommonspaceRoutingDecision
}

export type CommonspaceReplyStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'needs_input'
  | 'failed'
  | 'cancelled'
  | 'silent'
  | 'timeout'
  | 'error'
export interface CommonspaceThread {
  id: string
  channelId: string
  /** Authoritative Project context inherited by every message in this thread. */
  projectIds?: string[]
  /** @deprecated Compatibility mirror of the first projectIds entry. */
  projectId: string | null
  rootMessageId: string
  agentIds: string[]
  createdAt: string
}

export interface CommonspaceState {
  version: typeof COMMONSPACE_STATE_VERSION
  revision: number
  /** Single-owner cursor for activity shown in the Inbox. */
  inboxReadAt: string | null
  /** Agent message IDs opened individually after the global read cursor. */
  inboxReadMessageIds: string[]
  inboxSavedItemIds: string[]
  followedSessionIds: string[]
  mutedSessionIds: string[]
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
  queuedFollowups?: CommonspaceQueuedFollowup[]
  routing?: CommonspaceRoutingConfiguration
}

export interface DiscoverAgentsRequest {
  adapter: AgentAdapterKind
}

export type CommonspaceMutation =
  | { action: 'mark-inbox-read' }
  | { action: 'mark-inbox-item-read'; messageId: string }
  | { action: 'set-inbox-item-saved'; messageId: string; saved: boolean }
  | { action: 'set-session-followed'; sessionId: string; followed: boolean }
  | { action: 'set-session-muted'; sessionId: string; muted: boolean }
  | { action: 'create-project'; name: string; paths: string[] }
  | { action: 'add-project-path'; projectId: string; path: string }
  | { action: 'remove-project'; projectId: string }
  | { action: 'create-channel'; name: string; agentIds: string[] }
  | { action: 'set-channel-agents'; channelId: string; agentIds: string[] }
  | { action: 'set-channel-context'; channelId: string; instructions: string }
  | { action: 'set-channel-memory'; channelId: string; summary: string; decisions?: string[]; openQuestions?: string[] }
  | { action: 'set-channel-settings'; channelId: string; model?: string | null; reasoning?: CommonspaceReasoning | null }
  | { action: 'set-defaults'; model?: string | null; reasoning?: CommonspaceReasoning; maxAgentsPerTurn?: number; memoryThreads?: number }
  | { action: 'add-discovered-agent'; agentId: string }
  | { action: 'update-agent-profile'; agentId: string; displayName: string; avatarEmoji?: string; accentColor?: string }
  | { action: 'remove-agent'; agentId: string }
  | { action: 'reset-dm'; agentId: string }
  | { action: 'remove-channel'; channelId: string }

export interface SendMessageRequest {
  conversation: ConversationRef
  text: string
  /** Zero, one, or many explicit Project references. */
  projectIds?: string[]
  /** @deprecated Use projectIds. */
  projectId?: string
  threadId?: string
  /** Restrict a channel-thread reply to one current channel agent. */
  targetAgentId?: string
  attachments?: SendImageAttachment[]
  /** Behavior when the same conversation session already has an active run. */
  delivery?: 'queue' | 'steer' | 'stop-and-send'
}

export interface CommonspaceQueuedFollowup {
  messageId: string
  conversation: ConversationRef
  threadId?: string
  agentIds: string[]
  text: string
  position: number
  createdAt: string
  delivery: 'queue' | 'steer' | 'stop-and-send'
}

export interface ReorderFollowupRequest {
  messageId: string
  direction: 'up' | 'down'
}

export interface RemoveFollowupRequest {
  messageId: string
}

export interface FollowupQueueResponse {
  queuedFollowups: CommonspaceQueuedFollowup[]
}

export interface SendMessageResponse {
  accepted: CommonspaceMessage
  thread?: CommonspaceThread
  state: CommonspaceState
}

export interface StopAgentRunsRequest {
  messageId: string
  /** When omitted, stop every agent run initiated by the message. */
  agentId?: string
}

export interface StopAgentRunsResponse {
  stoppedAgentIds: string[]
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

/** Read canonical Project references while legacy singular snapshots remain supported. */
export function referencedProjectIds(value: { projectIds?: readonly string[]; projectId?: string | null }): string[] {
  return [...new Set([
    ...(value.projectIds ?? []),
    ...(value.projectId === undefined || value.projectId === null ? [] : [value.projectId]),
  ].filter(projectId => projectId !== ''))]
}
