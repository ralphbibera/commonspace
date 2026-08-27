import type {
  CommonspaceAgentDefinition,
  CommonspaceState,
  ConversationRef,
} from './contracts.js'

export type CommonspaceInboxItemKind = 'agent-reply' | 'thread-reply'

export interface CommonspaceInboxItem {
  id: string
  kind: CommonspaceInboxItemKind
  actorId: string
  actorName: string
  conversation: ConversationRef
  conversationName: string
  threadId?: string
  createdAt: string
  text: string
  unread: boolean
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

/** Derive the single-owner Inbox from actual persisted agent replies. */
export function deriveCommonspaceInboxItems(state: CommonspaceState): CommonspaceInboxItem[] {
  const agents = new Map(state.agents.map(agent => [agent.id, agent]))
  const channelNames = new Map(state.channels.map(channel => [channel.id, channel.name]))
  const readAt = state.inboxReadAt === null ? null : timestampValue(state.inboxReadAt)
  const unread = (createdAt: string): boolean => {
    if (readAt === null) return true
    const created = timestampValue(createdAt)
    return created !== null && created > readAt
  }
  const items: CommonspaceInboxItem[] = []

  for (const messages of Object.values(state.messages)) {
    for (const message of messages) {
      if (message.authorType !== 'agent') continue
      const kind = message.threadId === undefined ? 'agent-reply' : 'thread-reply'
      items.push({
        id: `message:${message.id}`,
        kind,
        actorId: message.authorId,
        actorName: message.authorName,
        conversation: message.conversation,
        conversationName: conversationName(message.conversation, channelNames, agents),
        ...(message.threadId === undefined ? {} : { threadId: message.threadId }),
        createdAt: message.createdAt,
        text: conciseText(message.text, kind === 'thread-reply' ? 'Replied in a thread.' : 'Replied in a conversation.'),
        unread: unread(message.createdAt),
      })
    }
  }

  return items.sort((left, right) => {
    const leftTime = timestampValue(left.createdAt)
    const rightTime = timestampValue(right.createdAt)
    const byTime = leftTime === rightTime ? 0 : leftTime === null ? 1 : rightTime === null ? -1 : rightTime - leftTime
    return byTime === 0 ? right.id.localeCompare(left.id) : byTime
  })
}
