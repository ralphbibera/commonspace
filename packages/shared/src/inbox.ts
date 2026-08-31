import type {
  CommonspaceAgentDefinition,
  CommonspaceLiveAgentActivity,
  CommonspaceMessage,
  CommonspaceState,
  ConversationRef,
} from './contracts.js'
import { referencedProjectIds } from './contracts.js'

export type CommonspaceInboxItemKind =
  | 'agent-reply'
  | 'thread-reply'
  | 'mention'
  | 'failure'
  | 'completion'
  | 'timeout'
  | 'input-request'
  | 'permission-request'

export interface CommonspaceInboxItem {
  id: string
  messageId: string
  sessionId: string
  kind: CommonspaceInboxItemKind
  actorId: string
  actorName: string
  conversation: ConversationRef
  conversationName: string
  threadId?: string
  createdAt: string
  text: string
  unread: boolean
  saved: boolean
  muted: boolean
}

export type CommonspaceSessionStatus = 'running' | 'needs-attention' | 'completed'

export interface CommonspaceSessionItem {
  id: string
  sourceMessageId: string
  messageId: string
  agentId: string
  agentName: string
  conversation: ConversationRef
  conversationName: string
  projectName: string | null
  threadId?: string
  status: CommonspaceSessionStatus
  attentionKind?: 'failure' | 'timeout' | 'input-request' | 'permission-request'
  summary: string
  updatedAt: string
  followed: boolean
  muted: boolean
}

function conciseText(value: string, fallback: string): string {
  const text = value.normalize('NFKC').replace(/\s+/gu, ' ').trim()
  return text === '' ? fallback : text.slice(0, 240)
}

function timestampValue(value: string): number | null {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

function conversationName(
  conversation: ConversationRef,
  channelNames: ReadonlyMap<string, string>,
  agents: ReadonlyMap<string, CommonspaceAgentDefinition>,
): string {
  if (conversation.kind === 'channel') {
    const name = channelNames.get(conversation.id)
    return name === undefined ? 'Channel' : `#${name}`
  }
  return agents.get(conversation.id)?.displayName ?? 'Direct message'
}

function isTimeout(value: string): boolean {
  return /\b(?:timed?\s*out|timeout)\b/iu.test(value)
}

function requestsInput(value: string): boolean {
  return /\b(?:need|requires?|waiting for|please provide|please choose|which|what)\b[^.!]{0,80}\b(?:input|answer|decision|approval|choose|provide|confirm|environment)\b/iu.test(value)
}

function mentionsOwner(value: string): boolean {
  return /(^|\s)@(?:ralph|user)\b/iu.test(value)
}

function sourceMessageId(message: CommonspaceMessage): string {
  return message.sourceMessageId ?? message.parentMessageId ?? message.id
}

function sessionId(message: CommonspaceMessage, agentId: string): string {
  return `${sourceMessageId(message)}:${agentId}`
}

function inboxKind(message: CommonspaceMessage): CommonspaceInboxItemKind | null {
  if (message.authorType === 'agent') {
    if (mentionsOwner(message.text)) return 'mention'
    if (requestsInput(message.text)) return 'input-request'
    return 'completion'
  }
  if (message.replyStatus === 'needs_input') return 'input-request'
  if ((message.authorType === 'system' && /\brun failed:/iu.test(message.text)) || message.replyStatus === 'error' || message.replyStatus === 'failed' || message.replyStatus === 'timeout' || message.replyStatus === 'silent') {
    return isTimeout(message.replyError ?? message.text) || message.replyStatus === 'timeout' ? 'timeout' : 'failure'
  }
  return null
}

/** Derive the single-owner attention Inbox from persisted run outcomes. */
export function deriveCommonspaceInboxItems(state: CommonspaceState): CommonspaceInboxItem[] {
  const agents = new Map(state.agents.map(agent => [agent.id, agent]))
  const channelNames = new Map(state.channels.map(channel => [channel.id, channel.name]))
  const readAt = state.inboxReadAt === null ? null : timestampValue(state.inboxReadAt)
  const readMessageIds = new Set(state.inboxReadMessageIds)
  const savedMessageIds = new Set(state.inboxSavedItemIds)
  const mutedSessionIds = new Set(state.mutedSessionIds)
  const failedSources = new Set(Object.values(state.messages).flat()
    .filter(message => message.authorType === 'user' && (message.replyStatus === 'error' || message.replyStatus === 'failed' || message.replyStatus === 'timeout' || message.replyStatus === 'silent'))
    .map(message => message.id))
  const items: CommonspaceInboxItem[] = []

  for (const messages of Object.values(state.messages)) {
    for (const message of messages) {
      const kind = inboxKind(message)
      if (kind === null) continue
      if (message.authorType === 'system' && message.sourceMessageId !== undefined && failedSources.has(message.sourceMessageId)) continue
      const actorId = message.authorType === 'user'
        ? message.conversation.kind === 'dm' ? message.conversation.id : 'system'
        : message.authorType === 'system'
          ? message.text.match(/^@([^\s]+)\s/u)?.[1] ?? 'system'
          : message.authorId
      const actorName = agents.get(actorId)?.displayName ?? (actorId === 'system' ? 'Commonspace' : message.authorName)
      const itemSessionId = sessionId(message, actorId)
      const muted = mutedSessionIds.has(itemSessionId)
      const created = timestampValue(message.createdAt)
      const unread = !muted && !readMessageIds.has(message.id) &&
        (readAt === null || (created !== null && created > readAt))
      items.push({
        id: `message:${message.id}`,
        messageId: message.id,
        sessionId: itemSessionId,
        kind,
        actorId,
        actorName,
        conversation: message.conversation,
        conversationName: conversationName(message.conversation, channelNames, agents),
        ...(message.threadId === undefined ? {} : { threadId: message.threadId }),
        createdAt: message.createdAt,
        text: conciseText(message.replyError ?? message.text, kind === 'failure' ? 'Agent run failed.' : 'Agent activity updated.'),
        unread,
        saved: savedMessageIds.has(message.id),
        muted,
      })
    }
  }

  for (const permission of state.permissions ?? []) {
    if (permission.status !== 'pending') continue
    const itemSessionId = `${permission.sourceMessageId}:${permission.agentId}`
    const muted = mutedSessionIds.has(itemSessionId)
    const created = timestampValue(permission.createdAt)
    items.push({
      id: `permission:${permission.id}`,
      messageId: permission.sourceMessageId,
      sessionId: itemSessionId,
      kind: 'permission-request',
      actorId: permission.agentId,
      actorName: agents.get(permission.agentId)?.displayName ?? permission.agentId,
      conversation: permission.conversation,
      conversationName: conversationName(permission.conversation, channelNames, agents),
      ...(permission.threadId === undefined ? {} : { threadId: permission.threadId }),
      createdAt: permission.createdAt,
      text: conciseText(permission.title, 'Permission requested.'),
      unread: !muted && !readMessageIds.has(permission.sourceMessageId) &&
        (readAt === null || (created !== null && created > readAt)),
      saved: savedMessageIds.has(permission.sourceMessageId),
      muted,
    })
  }

  return items.sort((left, right) => {
    const leftTime = timestampValue(left.createdAt)
    const rightTime = timestampValue(right.createdAt)
    const byTime = leftTime === rightTime ? 0 : leftTime === null ? 1 : rightTime === null ? -1 : rightTime - leftTime
    return byTime === 0 ? right.id.localeCompare(left.id) : byTime
  })
}

/** Derive compact session supervision rows from persisted outcomes and current live runs. */
export function deriveCommonspaceSessions(
  state: CommonspaceState,
  liveActivities: readonly CommonspaceLiveAgentActivity[] = [],
): CommonspaceSessionItem[] {
  const agents = new Map(state.agents.map(agent => [agent.id, agent]))
  const channelNames = new Map(state.channels.map(channel => [channel.id, channel.name]))
  const projects = new Map(state.projects.map(project => [project.id, project.name]))
  const threads = new Map(state.threads.map(thread => [thread.id, thread]))
  const messages = Object.values(state.messages).flat()
  const messagesById = new Map(messages.map(message => [message.id, message]))
  const followed = new Set(state.followedSessionIds)
  const muted = new Set(state.mutedSessionIds)
  const sessions = new Map<string, CommonspaceSessionItem>()

  const projectNameFor = (message: CommonspaceMessage, threadId?: string): string | null => {
    const direct = referencedProjectIds(message)
    const projectIds = direct.length > 0 || threadId === undefined
      ? direct
      : referencedProjectIds(threads.get(threadId) ?? {})
    const names = projectIds.flatMap(projectId => projects.get(projectId) ?? [])
    return names.length === 0 ? null : names.join(' · ')
  }

  for (const item of deriveCommonspaceInboxItems(state)) {
    const message = messagesById.get(item.messageId)
    if (message === undefined) continue
    const sourceId = sourceMessageId(message)
    const source = messagesById.get(sourceId) ?? message
    const status: CommonspaceSessionStatus = item.kind === 'failure' || item.kind === 'timeout' || item.kind === 'input-request' || item.kind === 'permission-request'
      ? 'needs-attention'
      : 'completed'
    if (sessions.get(item.sessionId)?.attentionKind === 'permission-request' && item.kind !== 'permission-request') continue
    sessions.set(item.sessionId, {
      id: item.sessionId,
      sourceMessageId: sourceId,
      messageId: item.messageId,
      agentId: item.actorId,
      agentName: item.actorName,
      conversation: item.conversation,
      conversationName: item.conversationName,
      projectName: projectNameFor(source, item.threadId),
      ...(item.threadId === undefined ? {} : { threadId: item.threadId }),
      status,
      ...(status === 'needs-attention' ? { attentionKind: item.kind as 'failure' | 'timeout' | 'input-request' | 'permission-request' } : {}),
      summary: item.text,
      updatedAt: item.createdAt,
      followed: followed.has(item.sessionId),
      muted: muted.has(item.sessionId),
    })
  }

  for (const activity of liveActivities) {
    const id = `${activity.sourceMessageId}:${activity.agentId}`
    const source = messagesById.get(activity.sourceMessageId)
    const current = sessions.get(id)
    if (current?.attentionKind === 'permission-request') continue
    const latestEntry = activity.entries.at(-1)
    sessions.set(id, {
      id,
      sourceMessageId: activity.sourceMessageId,
      messageId: current?.messageId ?? activity.sourceMessageId,
      agentId: activity.agentId,
      agentName: activity.agentName,
      conversation: activity.conversation,
      conversationName: conversationName(activity.conversation, channelNames, agents),
      projectName: source === undefined ? null : projectNameFor(source, activity.threadId),
      ...(activity.threadId === undefined ? {} : { threadId: activity.threadId }),
      status: 'running',
      summary: latestEntry?.type === 'tool' ? latestEntry.title : 'Working…',
      updatedAt: activity.startedAt,
      followed: followed.has(id),
      muted: muted.has(id),
    })
  }

  const statusRank: Record<CommonspaceSessionStatus, number> = { running: 0, 'needs-attention': 1, completed: 2 }
  return [...sessions.values()].sort((left, right) => {
    const byStatus = statusRank[left.status] - statusRank[right.status]
    if (byStatus !== 0) return byStatus
    return (timestampValue(right.updatedAt) ?? 0) - (timestampValue(left.updatedAt) ?? 0)
  })
}
