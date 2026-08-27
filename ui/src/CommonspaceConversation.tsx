import { lazy, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { AgentAdapterKind, CommonspaceAgentProfile, CommonspaceLiveAgentActivity, CommonspaceTraceEntry, ConversationRef, CommonspaceMessage, CommonspaceThread, SendImageAttachment } from '@commonspace/shared'
import type { CommonspaceClientStore } from './commonspace-store.ts'
import { AgentTrace, AgentTraceTimeline } from './AgentTrace.tsx'
import { resolveSlashCommand, slashCommandSuggestions } from './slash-commands.ts'
import { insertTag, tagReferenceParts, tagSuggestions, type TagSuggestion } from './tagging.ts'

const LazyMessageMarkdown = lazy(async () => {
  const module = await import('./MessageMarkdown.tsx')
  return { default: module.MessageMarkdown }
})

const messageMarkdownFallback = (
  <p className="csp-message-loading" role="status" aria-label="Formatting agent message">Formatting message…</p>
)

export interface CommonspaceConversationProps {
  store: CommonspaceClientStore
}

interface CommandFeedback {
  tone: 'info' | 'success' | 'error'
  title: string
  body: string
  action?: 'reset-dm'
}

const MAX_PASTED_IMAGES = 4
const MAX_PASTED_IMAGE_BYTES = 8 * 1024 * 1024
const PASTED_IMAGE_TYPES = new Set<SendImageAttachment['mimeType']>(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

function readPastedImage(file: File): Promise<SendImageAttachment> {
  if (!PASTED_IMAGE_TYPES.has(file.type as SendImageAttachment['mimeType'])) return Promise.reject(new Error('Only PNG, JPEG, GIF, and WebP images can be pasted.'))
  if (file.size === 0 || file.size > MAX_PASTED_IMAGE_BYTES) return Promise.reject(new Error('Pasted images must be 8 MB or smaller.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => { reject(new Error('Could not read the pasted image.')) }
    reader.onload = () => {
      const result = reader.result
      const marker = ';base64,'
      const markerIndex = typeof result === 'string' ? result.indexOf(marker) : -1
      if (typeof result !== 'string' || markerIndex < 0) {
        reject(new Error('Could not read the pasted image.'))
        return
      }
      resolve({
        name: file.name.trim() || 'pasted-image.png',
        mimeType: file.type as SendImageAttachment['mimeType'],
        data: result.slice(markerIndex + marker.length),
      })
    }
    reader.readAsDataURL(file)
  })
}

function PendingImageStrip({
  images,
  onRemove,
}: {
  images: readonly SendImageAttachment[]
  onRemove: (index: number) => void
}) {
  if (images.length === 0) return null
  return (
    <div className="csp-composer-attachments" aria-label="Attached images">
      {images.map((image, index) => (
        <figure key={`${image.name}-${String(index)}`}>
          <img src={`data:${image.mimeType};base64,${image.data}`} alt={`Pasted image ${image.name}`} />
          <figcaption>{image.name}</figcaption>
          <button type="button" aria-label={`Remove ${image.name}`} onClick={() => { onRemove(index) }}>×</button>
        </figure>
      ))}
    </div>
  )
}

function runtimeLabel(adapter: AgentAdapterKind | undefined): string {
  if (adapter === 'codex') return 'Codex'
  return 'Hermes'
}

function conversationTitle(store: CommonspaceClientStore, ref: ConversationRef | null): { title: string; subtitle: string } {
  const bootstrap = store.getSnapshot().bootstrap
  if (ref === null || bootstrap === null) return { title: 'Commonspace', subtitle: 'Select a channel or agent' }
  if (ref.kind === 'dm') {
    const agent = bootstrap.agents.find(candidate => candidate.id === ref.id)
    return { title: agent?.displayName ?? ref.id, subtitle: `${runtimeLabel(agent?.adapter)} · ${agent?.model ?? 'default model'}` }
  }
  const channel = bootstrap.state.channels.find(candidate => candidate.id === ref.id)
  const project = bootstrap.state.projects.find(candidate => candidate.id === channel?.projectId)
  const members = (channel?.agentIds ?? []).map(id => bootstrap.agents.find(agent => agent.id === id)?.displayName ?? id)
  const roster = members.length === 0 ? 'No agents' : members.map(name => `@${name}`).join(' ')
  return { title: channel?.name ?? 'channel', subtitle: project === undefined ? roster : `${project.name} · ${roster}` }
}

function renderMessageText(message: CommonspaceMessage) {
  return tagReferenceParts(message.text).map((part, index) => part.kind === 'text'
    ? <span key={`${message.id}-${String(index)}`}>{part.text}</span>
    : <mark key={`${message.id}-${String(index)}`} className={`csp-tag csp-tag--${part.kind}`}>{part.text}</mark>)
}

function MessageRow({
  message,
  compact = false,
  onReplyToAgent,
}: {
  message: CommonspaceMessage
  compact?: boolean
  onReplyToAgent?: (message: CommonspaceMessage) => void
}) {
  return (
    <article className={`csp-message csp-message--${message.authorType}${compact ? ' csp-message--compact' : ''}`} data-author={message.authorType}>
      <div className="csp-message-avatar" aria-hidden="true">{message.authorName.slice(0, 1).toUpperCase()}</div>
      <div className="csp-message-main">
        <header>
          <strong>{message.authorName}</strong>
          <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          {message.authorType === 'agent' && onReplyToAgent !== undefined && (
            <button
              type="button"
              className="csp-message-direct-reply"
              aria-label={`Reply directly to ${message.authorName}`}
              onClick={() => { onReplyToAgent(message) }}
            ><span aria-hidden="true">↩</span> Reply</button>
          )}
        </header>
        {message.text !== '' && (message.authorType === 'agent'
          ? <Suspense fallback={messageMarkdownFallback}>
              <LazyMessageMarkdown text={message.text} />
            </Suspense>
          : <p className="csp-message-plain-text">{renderMessageText(message)}</p>)}
        {message.attachments !== undefined && message.attachments.length > 0 && (
          <div className="csp-message-attachments">
            {message.attachments.map(attachment => (
              <img
                key={attachment.id}
                src={`/api/attachments/${encodeURIComponent(attachment.id)}`}
                alt={attachment.name}
                loading="lazy"
              />
            ))}
          </div>
        )}
        {message.authorType === 'agent' && message.trace !== undefined && <AgentTrace authorName={message.authorName} trace={message.trace} />}
      </div>
    </article>
  )
}

function suggestionLabel(suggestion: TagSuggestion): string {
  if (suggestion.kind === 'agent') return `Agent · ${suggestion.label}`
  if (suggestion.kind === 'project') return `Project · ${suggestion.label}`
  return `Channel · ${suggestion.label}`
}

interface SuggestionMenuProps {
  id: string
  selectedSuggestion: number
  slashSuggestions: ReturnType<typeof slashCommandSuggestions>
  referenceSuggestions: TagSuggestion[]
  onSelectSlash: (name: string) => void
  onSelectTag: (suggestion: TagSuggestion) => void
}

function SuggestionMenu({
  id,
  selectedSuggestion,
  slashSuggestions,
  referenceSuggestions,
  onSelectSlash,
  onSelectTag,
}: SuggestionMenuProps) {
  return (
    <div id={id} className="csp-tag-suggestions" role="listbox" aria-label={slashSuggestions.length > 0 ? 'Slash commands' : 'Tag suggestions'}>
      {slashSuggestions.map((command, index) => (
        <button
          key={command.id}
          id={`${id}-option-${String(index)}`}
          type="button"
          role="option"
          aria-selected={index === selectedSuggestion}
          className={index === selectedSuggestion ? 'is-selected' : ''}
          onMouseDown={event => { event.preventDefault(); onSelectSlash(command.name) }}
        ><strong>{command.name}</strong><span>{command.description}</span></button>
      ))}
      {referenceSuggestions.map((suggestion, index) => (
        <button
          key={`${suggestion.kind}-${suggestion.id}`}
          id={`${id}-option-${String(index + slashSuggestions.length)}`}
          type="button"
          role="option"
          aria-selected={index + slashSuggestions.length === selectedSuggestion}
          className={index + slashSuggestions.length === selectedSuggestion ? 'is-selected' : ''}
          onMouseDown={event => { event.preventDefault(); onSelectTag(suggestion) }}
        ><strong>{suggestion.token}</strong><span>{suggestionLabel(suggestion)}</span></button>
      ))}
    </div>
  )
}

function threadStatus(thread: CommonspaceThread | undefined): string | null {
  if (thread === undefined) return null
  if (thread.status === 'queued') return 'Queued'
  if (thread.status === 'running') return 'Agents working'
  if (thread.status === 'error') return 'Blocked'
  return null
}

function liveActivitiesFor(
  activities: readonly CommonspaceLiveAgentActivity[] | undefined,
  conversation: ConversationRef | null,
  threadId: string | undefined,
): CommonspaceLiveAgentActivity[] {
  if (conversation === null) return []
  return (activities ?? []).filter(activity =>
    activity.conversation.kind === conversation.kind &&
    activity.conversation.id === conversation.id &&
    activity.threadId === threadId)
}

function latestTraceEntry(entries: readonly CommonspaceTraceEntry[]): CommonspaceTraceEntry | undefined {
  return entries.reduce<CommonspaceTraceEntry | undefined>((latest, entry) =>
    latest === undefined || entry.updatedAt > latest.updatedAt ? entry : latest, undefined)
}

function liveActivityDetail(activity: CommonspaceLiveAgentActivity): { kind: string; text: string } {
  const entry = latestTraceEntry(activity.entries)
  if (entry === undefined) return { kind: 'Waiting', text: 'Waiting for harness activity…' }
  if (entry.type === 'reasoning') return { kind: 'Reasoning', text: entry.text }
  if (entry.type === 'plan') {
    const step = entry.steps.findLast(candidate => candidate.status === 'in_progress') ?? entry.steps.at(-1)
    return { kind: 'Plan', text: step?.text ?? entry.markdown ?? 'Updating plan…' }
  }
  if (entry.type === 'tool') return { kind: entry.status === 'in_progress' ? 'Tool running' : 'Tool', text: entry.title }
  return { kind: 'Context', text: `${entry.usedTokens.toLocaleString()} / ${entry.contextWindow.toLocaleString()} tokens` }
}

function LiveAgentActivity({
  activities,
  fallbackAgents,
  phase,
}: {
  activities: readonly CommonspaceLiveAgentActivity[]
  fallbackAgents: readonly CommonspaceAgentProfile[]
  phase: 'queued' | 'running'
}) {
  const panelIdPrefix = useId()
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  if (activities.length === 0 && fallbackAgents.length === 0) return null
  const expandedActivityId = activities.some(activity => activity.id === selectedActivityId)
    ? selectedActivityId
    : activities[0]?.id ?? null
  return (
    <div className="csp-live-activity" role="status" aria-label="Live agent activity" aria-live="polite">
      {activities.length > 0
        ? activities.map((activity, index) => {
            const detail = liveActivityDetail(activity)
            const expanded = activity.id === expandedActivityId
            const panelId = `${panelIdPrefix}-${String(index)}`
            return (
              <article key={activity.id} className={`csp-live-activity-row${expanded ? ' is-expanded' : ''}`} data-runtime={activity.adapter}>
                <button
                  type="button"
                  className="csp-live-activity-trigger"
                  aria-label={`${activity.agentName} activity`}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => { setSelectedActivityId(activity.id) }}
                >
                  <span
                    className="csp-thread-agent-avatar csp-thread-agent-avatar--responding"
                    aria-label={`${activity.agentName} is responding`}
                  >{activity.agentName.slice(0, 1).toLocaleUpperCase()}</span>
                  <span className="csp-live-activity-copy">
                    <span className="csp-live-activity-heading"><strong>{activity.agentName}</strong><span>{runtimeLabel(activity.adapter)} · {detail.kind}</span></span>
                    <span className="csp-live-activity-summary">{detail.text}</span>
                  </span>
                  <span className="csp-live-activity-chevron" aria-hidden="true">⌄</span>
                </button>
                {expanded && (
                  <section id={panelId} className="csp-live-activity-panel" role="region" aria-label={`${activity.agentName} live activity`}>
                    {activity.entries.length > 0
                      ? <AgentTraceTimeline entries={activity.entries} />
                      : <p className="csp-live-activity-empty">Waiting for harness activity…</p>}
                  </section>
                )}
              </article>
            )
          })
        : fallbackAgents.map(agent => (
            <div key={agent.id} className="csp-live-activity-row" data-runtime={agent.adapter}>
              <div className="csp-live-activity-trigger">
                <span
                  className="csp-thread-agent-avatar csp-thread-agent-avatar--responding"
                  aria-label={`${agent.displayName} is ${phase === 'queued' ? 'queued' : 'responding'}`}
                >{agent.displayName.slice(0, 1).toLocaleUpperCase()}</span>
                <span className="csp-live-activity-copy">
                  <span className="csp-live-activity-heading"><strong>{agent.displayName}</strong><span>{runtimeLabel(agent.adapter)} · {phase === 'queued' ? 'Queued' : 'Waiting'}</span></span>
                  <span className="csp-live-activity-summary">{phase === 'queued' ? 'Queued for provider run…' : 'Waiting for harness activity…'}</span>
                </span>
              </div>
            </div>
          ))}
    </div>
  )
}

function ThreadAgentActivity({
  thread,
  agents,
  respondingAgentIds = thread.agentIds,
}: {
  thread: CommonspaceThread
  agents: readonly CommonspaceAgentProfile[]
  respondingAgentIds?: readonly string[]
}) {
  if (thread.status !== 'queued' && thread.status !== 'running') return null
  return (
    <span className="csp-thread-agent-activity">
      {respondingAgentIds.map((agentId, index) => {
        const agent = agents.find(candidate => candidate.id === agentId)
        const name = agent?.displayName ?? agentId
        return (
          <span
            key={agentId}
            className="csp-thread-agent-avatar csp-thread-agent-avatar--responding"
            data-runtime={agent?.adapter}
            aria-label={`${name} is responding`}
            style={{ '--csp-thread-agent-index': index } as CSSProperties}
          >{name.slice(0, 1).toLocaleUpperCase()}</span>
        )
      })}
    </span>
  )
}

function ThreadReplyAgents({
  replies,
  agents,
}: {
  replies: readonly CommonspaceMessage[]
  agents: readonly CommonspaceAgentProfile[]
}) {
  const replyingAgents = [...new Map(
    replies
      .filter(reply => reply.authorType === 'agent')
      .map(reply => [reply.authorId, reply] as const),
  ).values()]
  if (replyingAgents.length === 0) return null
  return (
    <span className="csp-thread-reply-agents">
      {replyingAgents.map(reply => (
        <span
          key={reply.authorId}
          className="csp-thread-agent-avatar"
          data-runtime={agents.find(agent => agent.id === reply.authorId)?.adapter}
          aria-label={`${reply.authorName} replied`}
        >{reply.authorName.slice(0, 1).toLocaleUpperCase()}</span>
      ))}
    </span>
  )
}

export function CommonspaceConversation({ store }: CommonspaceConversationProps) {
  const suggestionListId = useId()
  const threadSuggestionListId = useId()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [draft, setDraft] = useState('')
  const [threadDraft, setThreadDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<SendImageAttachment[]>([])
  const [pendingThreadImages, setPendingThreadImages] = useState<SendImageAttachment[]>([])
  const [threadReplyTarget, setThreadReplyTarget] = useState<{ agentId: string; agentName: string } | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [selectedThreadSuggestion, setSelectedThreadSuggestion] = useState(0)
  const [commandFeedback, setCommandFeedback] = useState<CommandFeedback | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const threadComposer = useRef<HTMLTextAreaElement>(null)
  const bootstrap = snapshot.bootstrap
  const messages = store.messages()
  const heading = conversationTitle(store, snapshot.activeConversation)
  const isChannel = snapshot.activeConversation?.kind === 'channel'
  const activeChannel = isChannel && bootstrap !== null
    ? bootstrap.state.channels.find(channel => channel.id === snapshot.activeConversation?.id)
    : undefined
  const slashSuggestions = snapshot.activeConversation === null || pendingImages.length > 0 ? [] : slashCommandSuggestions(draft, snapshot.activeConversation.kind)
  const resolvedDraftCommand = snapshot.activeConversation === null || pendingImages.length > 0 ? null : resolveSlashCommand(draft, snapshot.activeConversation.kind)
  const referenceSuggestions = bootstrap === null || draft.startsWith('/') ? [] : tagSuggestions(draft, bootstrap)
  const suggestionCount = slashSuggestions.length + referenceSuggestions.length
  const activeSuggestionId = suggestionCount > 0 ? `${suggestionListId}-option-${String(selectedSuggestion)}` : undefined
  const channelThreads = isChannel && bootstrap !== null
    ? bootstrap.state.threads.filter(thread => thread.channelId === snapshot.activeConversation?.id)
    : []
  const activeThread = channelThreads.find(thread => thread.id === snapshot.activeThreadId)
  const activeThreadStatus = threadStatus(activeThread)
  const threadSlashSuggestions = activeThread === undefined || pendingThreadImages.length > 0 ? [] : slashCommandSuggestions(threadDraft, 'channel')
  const resolvedThreadCommand = activeThread === undefined || pendingThreadImages.length > 0 ? null : resolveSlashCommand(threadDraft, 'channel')
  const threadReferenceSuggestions = activeThread === undefined || bootstrap === null || threadDraft.startsWith('/') ? [] : tagSuggestions(threadDraft, bootstrap)
  const threadSuggestionCount = threadSlashSuggestions.length + threadReferenceSuggestions.length
  const activeThreadSuggestionId = threadSuggestionCount > 0 ? `${threadSuggestionListId}-option-${String(selectedThreadSuggestion)}` : undefined
  const roots = isChannel
    ? messages.filter(message => message.authorType === 'user' && message.parentMessageId === undefined)
    : messages
  const pendingDirectMessage = isChannel
    ? undefined
    : messages.findLast(message => message.authorType === 'user' && (message.replyStatus === 'queued' || message.replyStatus === 'running'))
  const directMessagePhase = pendingDirectMessage?.replyStatus === 'queued' || pendingDirectMessage?.replyStatus === 'running'
    ? pendingDirectMessage.replyStatus
    : null
  const directMessageActivities = liveActivitiesFor(bootstrap?.liveActivities, snapshot.activeConversation, undefined)
  const directMessageAgents = snapshot.activeConversation?.kind === 'dm' && bootstrap !== null
    ? bootstrap.agents.filter(agent => agent.id === snapshot.activeConversation?.id)
    : []
  const activeRoot = activeThread === undefined ? undefined : messages.find(message => message.id === activeThread.rootMessageId)
  const replies = activeThread === undefined
    ? []
    : messages.filter(message => message.threadId === activeThread.id && message.parentMessageId === activeThread.rootMessageId)
  const activeThreadActivities = liveActivitiesFor(bootstrap?.liveActivities, snapshot.activeConversation, activeThread?.id)
  const activeThreadAgents = activeThread === undefined || bootstrap === null
    ? []
    : activeThread.agentIds.flatMap(agentId => bootstrap.agents.filter(agent => agent.id === agentId))
  const rootIsCommand = pendingImages.length === 0 && draft.startsWith('/')
  const threadIsCommand = pendingThreadImages.length === 0 && threadDraft.startsWith('/')

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages.length, snapshot.sending, directMessagePhase])
  useEffect(() => {
    composer.current?.focus()
    setCommandFeedback(null)
    setPendingImages([])
  }, [snapshot.activeConversation?.id, snapshot.activeConversation?.kind])
  useEffect(() => {
    setThreadReplyTarget(null)
    setPendingThreadImages([])
  }, [snapshot.activeConversation?.id, snapshot.activeConversation?.kind, snapshot.activeThreadId])

  const attachPastedImages = async (
    files: readonly File[],
    setImages: Dispatch<SetStateAction<SendImageAttachment[]>>,
  ) => {
    try {
      const images = await Promise.all(files.slice(0, MAX_PASTED_IMAGES).map(readPastedImage))
      setImages(current => [...current, ...images].slice(0, MAX_PASTED_IMAGES))
      setCommandFeedback(null)
    } catch (error) {
      setCommandFeedback({ tone: 'error', title: 'Could not attach image', body: error instanceof Error ? error.message : String(error) })
    }
  }

  const selectSuggestion = (suggestion: TagSuggestion) => {
    setDraft(current => insertTag(current, suggestion.token))
    setSelectedSuggestion(0)
  }

  const selectSlashSuggestion = (name: string) => {
    setDraft(name)
    setSelectedSuggestion(0)
  }

  const selectThreadSuggestion = (suggestion: TagSuggestion) => {
    setThreadDraft(current => insertTag(current, suggestion.token))
    setSelectedThreadSuggestion(0)
  }

  const selectThreadSlashSuggestion = (name: string) => {
    setThreadDraft(name)
    setSelectedThreadSuggestion(0)
  }

  const resetDirectMessage = async () => {
    const conversation = snapshot.activeConversation
    if (conversation?.kind !== 'dm') return
    setCommandFeedback({ tone: 'info', title: 'Starting a new chat…', body: 'Clearing this transcript and rotating the agent session.' })
    try {
      await store.mutate({ action: 'reset-dm', agentId: conversation.id })
      setCommandFeedback({ tone: 'success', title: 'New chat started', body: 'Earlier messages remain visible, and your next message starts with fresh agent context.' })
      composer.current?.focus()
    } catch (error) {
      setCommandFeedback({ tone: 'error', title: 'Could not start a new chat', body: error instanceof Error ? error.message : String(error) })
    }
  }

  const executeSlashCommand = async (text: string, threadId?: string) => {
    const conversation = snapshot.activeConversation
    if (conversation === null || bootstrap === null) return
    const resolved = resolveSlashCommand(text, conversation.kind)
    if (resolved === null) {
      const token = text.split(/\s+/, 1)[0] ?? text
      setCommandFeedback({ tone: 'error', title: 'Unknown command', body: `${token} is not available here. Type /help to see Commonspace commands.` })
      return
    }

    if (resolved.command.id === 'help') {
      const commands = slashCommandSuggestions('/', conversation.kind)
      setCommandFeedback({
        tone: 'info',
        title: 'Commonspace commands',
        body: commands.map(command => `${command.name} — ${command.description}`).join('\n'),
      })
      return
    }

    if (resolved.command.id === 'status') {
      if (conversation.kind === 'dm') {
        const agent = bootstrap.agents.find(candidate => candidate.id === conversation.id)
        const project = bootstrap.state.projects.find(candidate => candidate.id === snapshot.activeProjectId)
        setCommandFeedback({
          tone: 'info',
          title: 'Direct-message status',
          body: `${agent?.displayName ?? conversation.id} · ${runtimeLabel(agent?.adapter)} · ${agent?.model ?? 'default model'} · ${agent?.status ?? 'unknown'}${project === undefined ? '' : `\nProject context: ${project.name}`}`,
        })
      } else {
        const channel = bootstrap.state.channels.find(candidate => candidate.id === conversation.id)
        const project = bootstrap.state.projects.find(candidate => candidate.id === channel?.projectId)
        setCommandFeedback({
          tone: 'info',
          title: 'Channel status',
          body: `${heading.title} · ${project?.name ?? 'No project'} · ${channel?.agentIds.length ?? 0} agents\nModel: ${channel?.settings.model ?? bootstrap.state.defaults.model ?? 'agent defaults'} · Reasoning: ${channel?.settings.reasoning ?? bootstrap.state.defaults.reasoning}`,
        })
      }
      return
    }

    if (resolved.command.id === 'agents') {
      setCommandFeedback({
        tone: 'info',
        title: 'Available agents',
        body: bootstrap.agents.length === 0
          ? 'No agents are configured.'
          : bootstrap.agents.map(agent => `${agent.displayName} · ${runtimeLabel(agent.adapter)} · ${agent.model ?? 'default model'}`).join('\n'),
      })
      return
    }

    if (resolved.command.id === 'retry') {
      const previous = [...messages].reverse().find(message => message.authorType === 'user' &&
        (threadId === undefined
          ? conversation.kind === 'dm' || message.parentMessageId === undefined
          : message.threadId === threadId))
      if (previous === undefined) {
        setCommandFeedback({ tone: 'error', title: 'Nothing to retry', body: 'Send a message first, then use /retry.' })
        return
      }
      setCommandFeedback({ tone: 'info', title: 'Retrying message', body: previous.text })
      try {
        if (threadId === undefined) await store.send(previous.text)
        else await store.send(previous.text, threadId)
      } catch (error) {
        setCommandFeedback({ tone: 'error', title: 'Retry failed', body: error instanceof Error ? error.message : String(error) })
      }
      return
    }

    const skipConfirmation = ['now', '--yes', '-y'].includes(resolved.args.toLocaleLowerCase())
    if (skipConfirmation) {
      await resetDirectMessage()
    } else {
      setCommandFeedback({
        tone: 'info',
        title: 'Start a new chat?',
        body: 'This keeps earlier messages visible and starts a fresh native session for this agent.',
        action: 'reset-dm',
      })
    }
  }

  const sendRoot = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (text === '' && pendingImages.length === 0) return
    const attachments = pendingImages
    setDraft('')
    if (rootIsCommand) {
      await executeSlashCommand(text)
      return
    }
    setPendingImages([])
    setCommandFeedback(null)
    try {
      if (attachments.length === 0) await store.send(text)
      else await store.send(text, undefined, attachments)
    } catch {
      setDraft(text)
      setPendingImages(attachments)
    }
  }

  const sendThreadReply = async (event: FormEvent) => {
    event.preventDefault()
    const text = threadDraft.trim()
    if ((text === '' && pendingThreadImages.length === 0) || activeThread === undefined) return
    const attachments = pendingThreadImages
    setThreadDraft('')
    if (threadIsCommand) {
      setThreadReplyTarget(null)
      await executeSlashCommand(text, activeThread.id)
      return
    }
    setPendingThreadImages([])
    setCommandFeedback(null)
    try {
      if (threadReplyTarget === null) {
        if (attachments.length === 0) await store.send(text, activeThread.id)
        else await store.send(text, activeThread.id, attachments)
      } else if (attachments.length === 0) {
        await store.sendDirectReply(text, activeThread.id, threadReplyTarget.agentId)
      } else {
        await store.sendDirectReply(text, activeThread.id, threadReplyTarget.agentId, attachments)
      }
      setThreadReplyTarget(null)
    } catch {
      setThreadDraft(text)
      setPendingThreadImages(attachments)
    }
  }

  const replyDirectlyToAgent = (message: CommonspaceMessage) => {
    setThreadReplyTarget({ agentId: message.authorId, agentName: message.authorName })
    threadComposer.current?.focus()
  }

  return (
    <main className="csp-conversation" aria-label="Commonspace conversation">
      <header className="csp-conversation-header">
        <div className="csp-conversation-heading">
          <span className="csp-conversation-kicker" aria-hidden="true">{snapshot.activeConversation === null ? '✦' : isChannel ? '#' : '@'}</span>
          <div><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>
        </div>
        <div className="csp-header-actions">
          {isChannel && <span className="csp-header-roster"><span aria-hidden="true">♙</span>{activeChannel?.agentIds.length ?? 0}</span>}
          <span className="csp-header-mode">{snapshot.activeConversation === null ? 'local-first' : isChannel ? 'shared room' : 'private session'}</span>
        </div>
      </header>

      {snapshot.activeConversation === null ? (
        <div className="csp-conversation-hero">
          <div className="csp-hero-constellation" aria-hidden="true"><span className="csp-mark csp-mark--large"><span /><span /><span /><span /></span><i /><i /></div>
          <span className="csp-hero-eyebrow">YOUR LOCAL AGENT WORKSPACE</span>
          <h2>Make space for the whole team.</h2>
          <p>Projects set context. Channels gather agents. Threads keep work focused.</p>
          <div className="csp-hero-flow" aria-hidden="true">
            <span><b>01</b><span>Projects<small>Choose local context.</small></span></span>
            <span><b>02</b><span>Channels<small>Seat agents together.</small></span></span>
            <span><b>03</b><span>Threads<small>Keep native sessions exact.</small></span></span>
          </div>
        </div>
      ) : (
        <div className={`csp-conversation-layout${activeThread === undefined ? '' : ' has-thread'}`}>
          <section className="csp-channel-feed" aria-label={isChannel ? `${heading.title} posts` : `${heading.title} messages`}>
            <div className="csp-message-list">
              {roots.length === 0 && <div className="csp-conversation-empty">No messages yet. Start the conversation.</div>}
              {isChannel
                ? roots.map(root => {
                    const thread = channelThreads.find(candidate => candidate.rootMessageId === root.id)
                    const threadReplies = thread === undefined ? [] : messages.filter(message => message.threadId === thread.id && message.parentMessageId === root.id)
                    const replyCount = threadReplies.length
                    const status = threadStatus(thread)
                    const threadActivities = liveActivitiesFor(bootstrap?.liveActivities, snapshot.activeConversation, thread?.id)
                    return (
                      <article key={root.id} className="csp-thread-root">
                        <MessageRow message={root} />
                        <button type="button" className="csp-thread-open" onClick={() => { if (thread !== undefined) store.selectThread(thread.id) }}>
                          <span className="csp-thread-reply-summary">
                            {bootstrap !== null && <ThreadReplyAgents replies={threadReplies} agents={bootstrap.agents} />}
                            <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                          </span>
                          {status !== null && <span className="csp-thread-meta">
                            {thread !== undefined && bootstrap !== null && <ThreadAgentActivity
                              thread={thread}
                              agents={bootstrap.agents}
                              {...(threadActivities.length === 0 ? {} : { respondingAgentIds: threadActivities.map(activity => activity.agentId) })}
                            />}
                            <span className={`csp-thread-status csp-thread-status--${thread?.status ?? 'complete'}`}>{status}</span>
                          </span>}
                        </button>
                      </article>
                    )
                  })
                : roots.map(message => <MessageRow key={message.id} message={message} />)}
              {directMessagePhase !== null && <LiveAgentActivity
                activities={directMessageActivities}
                fallbackAgents={directMessageAgents}
                phase={directMessagePhase}
              />}
              <div ref={bottom} />
            </div>

            {commandFeedback !== null && (
              <section
                className={`csp-command-result csp-command-result--${commandFeedback.tone}`}
                role={commandFeedback.tone === 'error' ? 'alert' : 'status'}
                aria-label="Command result"
              >
                <header><strong>{commandFeedback.title}</strong><button type="button" aria-label="Dismiss command result" onClick={() => { setCommandFeedback(null); composer.current?.focus() }}>×</button></header>
                <p>{commandFeedback.body}</p>
                {commandFeedback.action === 'reset-dm' && (
                  <div><button type="button" onClick={() => { void resetDirectMessage() }}>Start new chat</button><button type="button" onClick={() => { setCommandFeedback(null); composer.current?.focus() }}>Cancel</button></div>
                )}
              </section>
            )}

            <form className="csp-message-composer" onSubmit={(event) => { void sendRoot(event) }}>
              <div className="csp-composer-input-wrap">
                <textarea
                  ref={composer}
                  aria-label={isChannel ? `Post in ${heading.title}` : `Message ${heading.title}`}
                  aria-autocomplete="list"
                  aria-expanded={suggestionCount > 0}
                  aria-controls={suggestionCount > 0 ? suggestionListId : undefined}
                  aria-activedescendant={activeSuggestionId}
                  placeholder={isChannel ? `Message #${heading.title}` : `Message ${heading.title}`}
                  value={draft}
                  disabled={snapshot.sending}
                  onChange={event => { setDraft(event.target.value); setSelectedSuggestion(0) }}
                  onPaste={event => {
                    const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'))
                    if (files.length > 0) void attachPastedImages(files, setPendingImages)
                  }}
                  onKeyDown={event => {
                    if (suggestionCount > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                      event.preventDefault()
                      setSelectedSuggestion(current => event.key === 'ArrowDown' ? (current + 1) % suggestionCount : (current - 1 + suggestionCount) % suggestionCount)
                    } else if (suggestionCount > 0 && event.key === 'Tab') {
                      event.preventDefault()
                      if (slashSuggestions.length > 0) selectSlashSuggestion((slashSuggestions[selectedSuggestion] ?? slashSuggestions[0]!).name)
                      else selectSuggestion(referenceSuggestions[selectedSuggestion] ?? referenceSuggestions[0]!)
                    } else if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      if (slashSuggestions.length > 0 && resolvedDraftCommand === null) {
                        selectSlashSuggestion((slashSuggestions[selectedSuggestion] ?? slashSuggestions[0]!).name)
                      } else if (referenceSuggestions.length > 0) {
                        selectSuggestion(referenceSuggestions[selectedSuggestion] ?? referenceSuggestions[0]!)
                      } else {
                        event.currentTarget.form?.requestSubmit()
                      }
                    }
                  }}
                />
                <PendingImageStrip
                  images={pendingImages}
                  onRemove={index => { setPendingImages(current => current.filter((_, candidate) => candidate !== index)) }}
                />
                {suggestionCount > 0 && <SuggestionMenu
                  id={suggestionListId}
                  selectedSuggestion={selectedSuggestion}
                  slashSuggestions={slashSuggestions}
                  referenceSuggestions={referenceSuggestions}
                  onSelectSlash={selectSlashSuggestion}
                  onSelectTag={selectSuggestion}
                />}
              </div>
              <div className="csp-composer-footer">
                <div className="csp-composer-tools" aria-hidden="true"><span>@</span><span>⌁</span><span>☺</span><span>Aa</span></div>
                <span className="csp-composer-hint">{isChannel ? '@ agent · @@ project · # channel · paste image · / commands' : 'Enter to send · paste image · / commands'}</span>
                <button
                  type="submit"
                  aria-label={rootIsCommand ? 'Run command' : isChannel ? 'Post message' : 'Send message'}
                  title={rootIsCommand ? 'Run command' : isChannel ? 'Post message' : 'Send message'}
                  disabled={snapshot.sending || (draft.trim() === '' && pendingImages.length === 0)}
                ><span aria-hidden="true">↑</span><span className="csp-send-label">{rootIsCommand ? 'Run' : isChannel ? 'Post' : 'Send'}</span></button>
              </div>
            </form>
          </section>

          {activeThread !== undefined && (
            <aside className="csp-thread-panel" aria-label="Thread replies">
              <header className="csp-thread-header">
                <div><strong>Thread</strong>{activeThreadStatus !== null && <span>{activeThreadStatus}</span>}</div>
                <button type="button" aria-label="Close thread" onClick={() => { store.selectThread(null) }}>×</button>
              </header>
              <div className="csp-thread-messages">
                {activeRoot !== undefined && <MessageRow message={activeRoot} />}
                <div className="csp-thread-divider">Replies</div>
                {replies.map(reply => (
                  <MessageRow key={reply.id} message={reply} compact onReplyToAgent={replyDirectlyToAgent} />
                ))}
                {(activeThread.status === 'queued' || activeThread.status === 'running') && (
                  <LiveAgentActivity
                    activities={activeThreadActivities}
                    fallbackAgents={activeThreadAgents}
                    phase={activeThread.status}
                  />
                )}
                {activeThread.error !== undefined && <div className="csp-conversation-error">{activeThread.error}</div>}
              </div>
              <form className="csp-thread-composer" onSubmit={(event) => { void sendThreadReply(event) }}>
                <div className="csp-composer-input-wrap">
                  {threadReplyTarget !== null && (
                    <div className="csp-thread-reply-target" role="status">
                      <span>Replying to {threadReplyTarget.agentName}</span>
                      <small>Only this agent will respond</small>
                      <button
                        type="button"
                        aria-label="Cancel direct reply"
                        onClick={() => { setThreadReplyTarget(null); threadComposer.current?.focus() }}
                      >×</button>
                    </div>
                  )}
                  <textarea
                    ref={threadComposer}
                    aria-label="Reply in thread"
                    aria-autocomplete="list"
                    aria-expanded={threadSuggestionCount > 0}
                    aria-controls={threadSuggestionCount > 0 ? threadSuggestionListId : undefined}
                    aria-activedescendant={activeThreadSuggestionId}
                    placeholder="Reply in thread, tag context, or type /"
                    value={threadDraft}
                    disabled={snapshot.sending}
                    onChange={event => { setThreadDraft(event.target.value); setSelectedThreadSuggestion(0) }}
                    onPaste={event => {
                      const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'))
                      if (files.length > 0) void attachPastedImages(files, setPendingThreadImages)
                    }}
                    onKeyDown={event => {
                      if (threadSuggestionCount > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                        event.preventDefault()
                        setSelectedThreadSuggestion(current => event.key === 'ArrowDown' ? (current + 1) % threadSuggestionCount : (current - 1 + threadSuggestionCount) % threadSuggestionCount)
                      } else if (threadSuggestionCount > 0 && event.key === 'Tab') {
                        event.preventDefault()
                        if (threadSlashSuggestions.length > 0) selectThreadSlashSuggestion((threadSlashSuggestions[selectedThreadSuggestion] ?? threadSlashSuggestions[0]!).name)
                        else selectThreadSuggestion(threadReferenceSuggestions[selectedThreadSuggestion] ?? threadReferenceSuggestions[0]!)
                      } else if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        if (threadSlashSuggestions.length > 0 && resolvedThreadCommand === null) {
                          selectThreadSlashSuggestion((threadSlashSuggestions[selectedThreadSuggestion] ?? threadSlashSuggestions[0]!).name)
                        } else if (threadReferenceSuggestions.length > 0) {
                          selectThreadSuggestion(threadReferenceSuggestions[selectedThreadSuggestion] ?? threadReferenceSuggestions[0]!)
                        } else {
                          event.currentTarget.form?.requestSubmit()
                        }
                      }
                    }}
                  />
                  <PendingImageStrip
                    images={pendingThreadImages}
                    onRemove={index => { setPendingThreadImages(current => current.filter((_, candidate) => candidate !== index)) }}
                  />
                  {threadSuggestionCount > 0 && <SuggestionMenu
                    id={threadSuggestionListId}
                    selectedSuggestion={selectedThreadSuggestion}
                    slashSuggestions={threadSlashSuggestions}
                    referenceSuggestions={threadReferenceSuggestions}
                    onSelectSlash={selectThreadSlashSuggestion}
                    onSelectTag={selectThreadSuggestion}
                  />}
                </div>
                <button type="submit" disabled={snapshot.sending || (threadDraft.trim() === '' && pendingThreadImages.length === 0)}>{threadIsCommand ? 'Run' : 'Reply'}</button>
              </form>
            </aside>
          )}
        </div>
      )}
      {snapshot.error !== null && <div className="csp-conversation-error" role="alert">{snapshot.error}</div>}
    </main>
  )
}
