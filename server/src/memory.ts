import type { CommonspaceChannelMemory, CommonspaceMessage, CommonspaceState } from '@commonspace/shared'
import { conversationKey } from '@commonspace/shared'

function unique(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const compact = value.trim().replace(/\s+/g, ' ').slice(0, 500)
    const key = compact.toLocaleLowerCase()
    if (compact === '' || seen.has(key)) continue
    seen.add(key)
    result.push(compact)
    if (result.length >= limit) break
  }
  return result
}

function extracts(messages: CommonspaceMessage[], pattern: RegExp): string[] {
  const values: string[] = []
  for (const message of messages) {
    for (const match of message.text.matchAll(pattern)) {
      if (match[1] !== undefined) values.push(match[1])
    }
  }
  return values
}

function estimatedTokens(messages: readonly CommonspaceMessage[]): number {
  const characters = messages.reduce((total, message) => total + message.authorName.length + message.text.length + 2, 0)
  return Math.ceil(characters / 4)
}

export function projectChannelMemory(
  state: CommonspaceState,
  channelId: string,
  maxThreads = 12,
): CommonspaceChannelMemory {
  const threads = state.threads
    .filter(thread => thread.channelId === channelId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-Math.max(1, maxThreads))
  const messages = state.messages[conversationKey({ kind: 'channel', id: channelId })] ?? []
  const byId = new Map(messages.map(message => [message.id, message]))
  const summaryLines: string[] = []
  const sourceMessages: CommonspaceMessage[] = []
  for (const thread of threads) {
    const root = byId.get(thread.rootMessageId)
    if (root === undefined) continue
    const replies = messages.filter(message => message.threadId === thread.id && message.parentMessageId === thread.rootMessageId)
    sourceMessages.push(root, ...replies)
    const replySummary = replies
      .filter(message => message.authorType !== 'system')
      .map(message => `${message.authorName}: ${message.text.replace(/\s+/g, ' ').slice(0, 220)}`)
      .join(' | ')
    summaryLines.push(`- ${root.text.replace(/\s+/g, ' ').slice(0, 260)}${replySummary === '' ? '' : ` → ${replySummary}`}`)
  }
  const transcriptOrder = new Map(messages.map((message, index) => [message.id, index]))
  sourceMessages.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) ||
    (transcriptOrder.get(left.id) ?? 0) - (transcriptOrder.get(right.id) ?? 0))
  const decisions = unique(extracts(sourceMessages, /\b(?:decision|decided)\s*:\s*([^\n]+)/gim), 20)
  const explicitQuestions = extracts(sourceMessages, /\b(?:open question|question)\s*:\s*([^?\n]*\?)/gim)
  const sentenceQuestions = sourceMessages.flatMap(message => message.text.split(/(?<=[.!?])\s+/).filter(sentence => sentence.trim().endsWith('?')))
  return {
    summary: summaryLines.join('\n').slice(-8_000),
    decisions,
    openQuestions: unique([...explicitQuestions, ...sentenceQuestions], 20),
    threadIds: threads.map(thread => thread.id),
    updatedAt: sourceMessages.at(-1)?.createdAt ?? null,
    origin: 'automatic',
    status: sourceMessages.length === 0 ? 'empty' : 'current',
    sourceMessageCount: sourceMessages.length,
    estimatedTokens: estimatedTokens(sourceMessages),
    compactedThroughMessageId: sourceMessages.at(-1)?.id ?? null,
  }
}

/** Preserve a user/inference compacted representation while exposing when new source context makes it stale. */
export function mergeChannelMemoryProjection(
  current: CommonspaceChannelMemory,
  projection: CommonspaceChannelMemory,
): CommonspaceChannelMemory {
  if (current.origin === undefined || current.origin === 'automatic') return projection
  const currentThrough = current.compactedThroughMessageId ?? null
  const projectedThrough = projection.compactedThroughMessageId ?? null
  return {
    ...current,
    threadIds: projection.threadIds,
    sourceMessageCount: projection.sourceMessageCount ?? 0,
    estimatedTokens: projection.estimatedTokens ?? 0,
    status: current.status === 'failed'
      ? 'failed'
      : currentThrough === projectedThrough ? current.status ?? 'current' : 'stale',
  }
}
