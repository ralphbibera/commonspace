import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { AgentAdapterKind, ConversationRef, CommonspaceMessage, CommonspaceThread } from '@commonspace/shared'
import type { CommonspaceClientStore } from './commonspace-store.ts'
import { resolveSlashCommand, slashCommandSuggestions } from './slash-commands.ts'
import { insertTag, tagReferenceParts, tagSuggestions, type TagSuggestion } from './tagging.ts'

export interface CommonspaceConversationProps {
  store: CommonspaceClientStore
}

interface CommandFeedback {
  tone: 'info' | 'success' | 'error'
  title: string
  body: string
  action?: 'reset-dm'
}

function adapterLabel(adapter: AgentAdapterKind | undefined): string {
  if (adapter === 'claude-code') return 'Claude Code'
  if (adapter === 'codex') return 'Codex CLI'
  return 'Hermes'
}

function conversationTitle(store: CommonspaceClientStore, ref: ConversationRef | null): { title: string; subtitle: string } {
  const bootstrap = store.getSnapshot().bootstrap
  if (ref === null || bootstrap === null) return { title: 'Commonspace', subtitle: 'Select a channel or agent' }
  if (ref.kind === 'dm') {
    const agent = bootstrap.agents.find(candidate => candidate.id === ref.id)
    return { title: agent?.displayName ?? ref.id, subtitle: `${adapterLabel(agent?.adapter)} · ${agent?.model ?? 'default model'}` }
  }
  const channel = bootstrap.state.channels.find(candidate => candidate.id === ref.id)
  const project = bootstrap.state.projects.find(candidate => candidate.id === channel?.projectId)
  const members = (channel?.agentIds ?? []).map(id => bootstrap.agents.find(agent => agent.id === id)?.displayName ?? id)
  const roster = members.length === 0 ? 'No agents' : members.map(name => `@${name}`).join(' ')
  return { title: `#${channel?.name ?? 'channel'}`, subtitle: project === undefined ? roster : `${project.name} · ${roster}` }
}

function renderMessageText(message: CommonspaceMessage) {
  return tagReferenceParts(message.text).map((part, index) => part.kind === 'text'
    ? <span key={`${message.id}-${String(index)}`}>{part.text}</span>
    : <mark key={`${message.id}-${String(index)}`} className={`csp-tag csp-tag--${part.kind}`}>{part.text}</mark>)
}

function MessageRow({ message, compact = false }: { message: CommonspaceMessage; compact?: boolean }) {
  return (
    <article className={`csp-message csp-message--${message.authorType}${compact ? ' csp-message--compact' : ''}`} data-author={message.authorType}>
      <div className="csp-message-avatar" aria-hidden="true">{message.authorName.slice(0, 1).toUpperCase()}</div>
      <div>
        <header><strong>{message.authorName}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></header>
        <p>{renderMessageText(message)}</p>
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

function threadStatus(thread: CommonspaceThread | undefined): string {
  if (thread === undefined) return 'Complete'
  if (thread.status === 'queued') return 'Queued'
  if (thread.status === 'running') return 'Agents working'
  if (thread.status === 'error') return 'Blocked'
  return 'Complete'
}

export function CommonspaceConversation({ store }: CommonspaceConversationProps) {
  const suggestionListId = useId()
  const threadSuggestionListId = useId()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [draft, setDraft] = useState('')
  const [threadDraft, setThreadDraft] = useState('')
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [selectedThreadSuggestion, setSelectedThreadSuggestion] = useState(0)
  const [commandFeedback, setCommandFeedback] = useState<CommandFeedback | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const bootstrap = snapshot.bootstrap
  const messages = store.messages()
  const heading = conversationTitle(store, snapshot.activeConversation)
  const isChannel = snapshot.activeConversation?.kind === 'channel'
  const slashSuggestions = snapshot.activeConversation === null ? [] : slashCommandSuggestions(draft, snapshot.activeConversation.kind)
  const resolvedDraftCommand = snapshot.activeConversation === null ? null : resolveSlashCommand(draft, snapshot.activeConversation.kind)
  const referenceSuggestions = bootstrap === null || draft.startsWith('/') ? [] : tagSuggestions(draft, bootstrap)
  const suggestionCount = slashSuggestions.length + referenceSuggestions.length
  const activeSuggestionId = suggestionCount > 0 ? `${suggestionListId}-option-${String(selectedSuggestion)}` : undefined
  const channelThreads = isChannel && bootstrap !== null
    ? bootstrap.state.threads.filter(thread => thread.channelId === snapshot.activeConversation?.id)
    : []
  const activeThread = channelThreads.find(thread => thread.id === snapshot.activeThreadId)
  const threadSlashSuggestions = activeThread === undefined ? [] : slashCommandSuggestions(threadDraft, 'channel')
  const resolvedThreadCommand = activeThread === undefined ? null : resolveSlashCommand(threadDraft, 'channel')
  const threadReferenceSuggestions = activeThread === undefined || bootstrap === null || threadDraft.startsWith('/') ? [] : tagSuggestions(threadDraft, bootstrap)
  const threadSuggestionCount = threadSlashSuggestions.length + threadReferenceSuggestions.length
  const activeThreadSuggestionId = threadSuggestionCount > 0 ? `${threadSuggestionListId}-option-${String(selectedThreadSuggestion)}` : undefined
  const roots = isChannel
    ? messages.filter(message => message.authorType === 'user' && message.parentMessageId === undefined)
    : messages
  const pendingDirectMessage = isChannel
    ? undefined
    : messages.findLast(message => message.authorType === 'user' && (message.replyStatus === 'queued' || message.replyStatus === 'running'))
  const directMessageStatus = pendingDirectMessage?.replyStatus === 'queued'
    ? `${heading.title} is queued…`
    : pendingDirectMessage?.replyStatus === 'running'
      ? `${heading.title} is responding…`
      : null
  const activeRoot = activeThread === undefined ? undefined : messages.find(message => message.id === activeThread.rootMessageId)
  const replies = activeThread === undefined
    ? []
    : messages.filter(message => message.threadId === activeThread.id && message.parentMessageId === activeThread.rootMessageId)

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages.length, snapshot.sending, directMessageStatus])
  useEffect(() => { composer.current?.focus(); setCommandFeedback(null) }, [snapshot.activeConversation?.id, snapshot.activeConversation?.kind])

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
      setCommandFeedback({ tone: 'success', title: 'New chat started', body: 'The transcript is clear and your next message starts with fresh agent context.' })
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
          body: `${agent?.displayName ?? conversation.id} · ${adapterLabel(agent?.adapter)} · ${agent?.model ?? 'default model'} · ${agent?.status ?? 'unknown'}${project === undefined ? '' : `\nProject context: ${project.name}`}`,
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
          : bootstrap.agents.map(agent => `${agent.displayName} · ${adapterLabel(agent.adapter)} · ${agent.model ?? 'default model'}`).join('\n'),
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
        body: 'This clears the visible transcript and starts a fresh native session for this agent.',
        action: 'reset-dm',
      })
    }
  }

  const sendRoot = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (text === '') return
    setDraft('')
    if (text.startsWith('/')) {
      await executeSlashCommand(text)
      return
    }
    setCommandFeedback(null)
    try { await store.send(text) } catch { setDraft(text) }
  }

  const sendThreadReply = async (event: FormEvent) => {
    event.preventDefault()
    const text = threadDraft.trim()
    if (text === '' || activeThread === undefined) return
    setThreadDraft('')
    if (text.startsWith('/')) {
      await executeSlashCommand(text, activeThread.id)
      return
    }
    setCommandFeedback(null)
    try { await store.send(text, activeThread.id) } catch { setThreadDraft(text) }
  }

  return (
    <main className="csp-conversation" aria-label="Commonspace conversation">
      <header className="csp-conversation-header">
        <div className="csp-conversation-heading">
          <span className="csp-conversation-kicker">{snapshot.activeConversation === null ? 'FIELD' : isChannel ? 'CHANNEL' : 'DIRECT'}</span>
          <div><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>
        </div>
        <span className="csp-header-mode">{snapshot.activeConversation === null ? 'local-first' : isChannel ? 'shared room' : 'private session'}</span>
      </header>

      {snapshot.activeConversation === null ? (
        <div className="csp-conversation-hero">
          <div className="csp-hero-constellation" aria-hidden="true"><span className="csp-mark csp-mark--large"><span /><span /><span /><span /></span><i /><i /></div>
          <span className="csp-hero-eyebrow">COMMON CONTEXT · FOCUSED THREADS</span>
          <h2>Make space for the whole team.</h2>
          <p>Projects set context. Channels gather agents. Threads keep work focused.</p>
          <div className="csp-hero-flow" aria-hidden="true"><span><b>01</b> Project</span><i /><span><b>02</b> Channel</span><i /><span><b>03</b> Thread</span></div>
        </div>
      ) : (
        <div className={`csp-conversation-layout${activeThread === undefined ? '' : ' has-thread'}`}>
          <section className="csp-channel-feed" aria-label={isChannel ? `${heading.title} posts` : `${heading.title} messages`}>
            <div className="csp-message-list">
              {roots.length === 0 && <div className="csp-conversation-empty">No messages yet. Start the conversation.</div>}
              {isChannel
                ? roots.map(root => {
                    const thread = channelThreads.find(candidate => candidate.rootMessageId === root.id)
                    const replyCount = thread === undefined ? 0 : messages.filter(message => message.threadId === thread.id && message.parentMessageId === root.id).length
                    return (
                      <article key={root.id} className="csp-thread-root">
                        <MessageRow message={root} />
                        <button type="button" className="csp-thread-open" onClick={() => { if (thread !== undefined) store.selectThread(thread.id) }}>
                          <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                          <span className={`csp-thread-status csp-thread-status--${thread?.status ?? 'complete'}`}>{threadStatus(thread)}</span>
                        </button>
                      </article>
                    )
                  })
                : roots.map(message => <MessageRow key={message.id} message={message} />)}
              {directMessageStatus !== null && <div className="csp-agent-working" role="status" aria-live="polite">{directMessageStatus}</div>}
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
                  placeholder={isChannel ? `Post new work in ${heading.title} or type /` : `Message ${heading.title} or type /`}
                  value={draft}
                  disabled={snapshot.sending}
                  onChange={event => { setDraft(event.target.value); setSelectedSuggestion(0) }}
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
                <span>{isChannel ? '@ agent · @@ project · # channel · / commands' : 'Enter to send · / for commands'}</span>
                <button type="submit" disabled={snapshot.sending || draft.trim() === ''}><span aria-hidden="true">↑</span>{draft.startsWith('/') ? 'Run' : isChannel ? 'Post' : 'Send'}</button>
              </div>
            </form>
          </section>

          {activeThread !== undefined && (
            <aside className="csp-thread-panel" aria-label="Thread replies">
              <header className="csp-thread-header">
                <div><strong>Thread</strong><span>{threadStatus(activeThread)}</span></div>
                <button type="button" aria-label="Close thread" onClick={() => { store.selectThread(null) }}>×</button>
              </header>
              <div className="csp-thread-messages">
                {activeRoot !== undefined && <MessageRow message={activeRoot} />}
                <div className="csp-thread-divider">Replies</div>
                {replies.map(reply => <MessageRow key={reply.id} message={reply} compact />)}
                {(activeThread.status === 'queued' || activeThread.status === 'running') && <div className="csp-agent-working">Agents are responding…</div>}
                {activeThread.error !== undefined && <div className="csp-conversation-error">{activeThread.error}</div>}
              </div>
              <form className="csp-thread-composer" onSubmit={(event) => { void sendThreadReply(event) }}>
                <div className="csp-composer-input-wrap">
                  <textarea
                    aria-label="Reply in thread"
                    aria-autocomplete="list"
                    aria-expanded={threadSuggestionCount > 0}
                    aria-controls={threadSuggestionCount > 0 ? threadSuggestionListId : undefined}
                    aria-activedescendant={activeThreadSuggestionId}
                    placeholder="Reply in thread, tag context, or type /"
                    value={threadDraft}
                    disabled={snapshot.sending}
                    onChange={event => { setThreadDraft(event.target.value); setSelectedThreadSuggestion(0) }}
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
                  {threadSuggestionCount > 0 && <SuggestionMenu
                    id={threadSuggestionListId}
                    selectedSuggestion={selectedThreadSuggestion}
                    slashSuggestions={threadSlashSuggestions}
                    referenceSuggestions={threadReferenceSuggestions}
                    onSelectSlash={selectThreadSlashSuggestion}
                    onSelectTag={selectThreadSuggestion}
                  />}
                </div>
                <button type="submit" disabled={snapshot.sending || threadDraft.trim() === ''}>Reply</button>
              </form>
            </aside>
          )}
        </div>
      )}
      {snapshot.error !== null && <div className="csp-conversation-error" role="alert">{snapshot.error}</div>}
    </main>
  )
}
