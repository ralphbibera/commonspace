export const COMMONSPACE_STATE_VERSION = 2 as const

export interface HermesAgentProfile {
  id: string
  displayName: string
  model: string
  status: 'running' | 'stopped' | 'unknown'
  description?: string
}

export interface CommonspaceProject {
  id: string
  name: string
  paths: string[]
  createdAt: string
}

export interface CommonspaceChannel {
  id: string
  name: string
  projectId: string | null
  agentIds: string[]
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
}

export type CommonspaceThreadStatus = 'queued' | 'running' | 'complete' | 'error'

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
  projects: CommonspaceProject[]
  channels: CommonspaceChannel[]
  threads: CommonspaceThread[]
  messages: Record<string, CommonspaceMessage[]>
}

export interface CommonspaceBootstrap {
  agents: HermesAgentProfile[]
  state: CommonspaceState
}

export type CommonspaceMutation =
  | { action: 'create-project'; name: string; paths: string[] }
  | { action: 'add-project-path'; projectId: string; path: string }
  | { action: 'remove-project'; projectId: string }
  | { action: 'create-channel'; name: string; projectId?: string; agentIds: string[] }
  | { action: 'set-channel-agents'; channelId: string; agentIds: string[] }
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

export function conversationKey(ref: ConversationRef): string {
  return `${ref.kind}:${ref.id}`
}
