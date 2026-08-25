import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { ConversationRef, CommonspaceMessage, CommonspaceThread } from '../contracts.ts'
import type { CommonspaceClientStore } from './commonspace-store.ts'
import { insertTag, tagReferenceParts, tagSuggestions, type TagSuggestion } from './tagging.ts'

export interface CommonspaceConversationProps {
  store: CommonspaceClientStore
}

function conversationTitle(store: CommonspaceClientStore, ref: ConversationRef | null): { title: string; subtitle: string } {
  const bootstrap = store.getSnapshot().bootstrap
  if (ref === null || bootstrap === null) return { title: 'Commonspace', subtitle: 'Select a channel or agent' }
  if (ref.kind === 'dm') {
    const agent = bootstrap.agents.find(candidate => candidate.id === ref.id)
    return { title: agent?.displayName ?? ref.id, subtitle: `Hermes profile · ${agent?.model ?? 'unknown model'}` }
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
    <article className={`csp-message csp-message--${message.authorType}${compact ? ' csp-message--compact' : ''}`}>
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

function threadStatus(thread: CommonspaceThread | undefined): string {
  if (thread === undefined) return 'Complete'
  if (thread.status === 'queued') return 'Queued'
  if (thread.status === 'running') return 'Agents working'
  if (thread.status === 'error') return 'Blocked'
  return 'Complete'
}

export function CommonspaceConversation({ store }: CommonspaceConversationProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [draft, setDraft] = useState('')
  const [threadDraft, setThreadDraft] = useState('')
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const bottom = useRef<HTMLDivElement>(null)
  const bootstrap = snapshot.bootstrap
  const messages = store.messages()
  const heading = conversationTitle(store, snapshot.activeConversation)
  const suggestions = bootstrap === null ? [] : tagSuggestions(draft, bootstrap)
  const isChannel = snapshot.activeConversation?.kind === 'channel'
  const channelThreads = isChannel && bootstrap !== null
    ? bootstrap.state.threads.filter(thread => thread.channelId === snapshot.activeConversation?.id)
    : []
  const activeThread = channelThreads.find(thread => thread.id === snapshot.activeThreadId)
  const roots = isChannel
    ? messages.filter(message => message.authorType === 'user' && message.parentMessageId === undefined)
    : messages
  const activeRoot = activeThread === undefined ? undefined : messages.find(message => message.id === activeThread.rootMessageId)
  const replies = activeThread === undefined
    ? []
    : messages.filter(message => message.threadId === activeThread.id && message.parentMessageId === activeThread.rootMessageId)

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages.length, snapshot.sending])

  const selectSuggestion = (suggestion: TagSuggestion) => {
    setDraft(current => insertTag(current, suggestion.token))
    setSelectedSuggestion(0)
  }

  const sendRoot = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (text === '') return
    setDraft('')
    try { await store.send(text) } catch { setDraft(text) }
  }

  const sendThreadReply = async (event: FormEvent) => {
    event.preventDefault()
    const text = threadDraft.trim()
    if (text === '' || activeThread === undefined) return
    setThreadDraft('')
    try { await store.send(text, activeThread.id) } catch { setThreadDraft(text) }
  }

  return (
    <main className="csp-conversation" aria-label="Commonspace conversation">
      <header className="csp-conversation-header">
        <div><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>
      </header>

      {snapshot.activeConversation === null ? (
        <div className="csp-conversation-hero">
          <span className="csp-mark csp-mark--large" aria-hidden="true"><span /><span /><span /><span /></span>
          <h2>Humans and agents, one workspace.</h2>
          <p>Choose a channel or an Agent from the Commonspace sidebar.</p>
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
              <div ref={bottom} />
            </div>

            <form className="csp-message-composer" onSubmit={(event) => { void sendRoot(event) }}>
              <div className="csp-composer-input-wrap">
                <textarea
                  aria-label={isChannel ? `Post in ${heading.title}` : `Message ${heading.title}`}
                  placeholder={isChannel ? `Post new work in ${heading.title}` : `Message ${heading.title}`}
                  value={draft}
                  disabled={snapshot.sending}
                  onChange={event => { setDraft(event.target.value); setSelectedSuggestion(0) }}
                  onKeyDown={event => {
                    if (suggestions.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                      event.preventDefault()
                      setSelectedSuggestion(current => event.key === 'ArrowDown' ? (current + 1) % suggestions.length : (current - 1 + suggestions.length) % suggestions.length)
                    } else if (suggestions.length > 0 && (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey))) {
                      event.preventDefault()
                      selectSuggestion(suggestions[selectedSuggestion] ?? suggestions[0]!)
                    } else if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
                {suggestions.length > 0 && (
                  <div className="csp-tag-suggestions" role="listbox" aria-label="Tag suggestions">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.kind}-${suggestion.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === selectedSuggestion}
                        className={index === selectedSuggestion ? 'is-selected' : ''}
                        onMouseDown={event => { event.preventDefault(); selectSuggestion(suggestion) }}
                      ><strong>{suggestion.token}</strong><span>{suggestionLabel(suggestion)}</span></button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={snapshot.sending || draft.trim() === ''}>{isChannel ? 'Post' : 'Send'}</button>
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
                {(activeThread.status === 'queued' || activeThread.status === 'running') && <div className="csp-agent-working">Hermes agents are responding…</div>}
                {activeThread.error !== undefined && <div className="csp-conversation-error">{activeThread.error}</div>}
              </div>
              <form className="csp-thread-composer" onSubmit={(event) => { void sendThreadReply(event) }}>
                <textarea
                  aria-label="Reply in thread"
                  placeholder="Reply in thread"
                  value={threadDraft}
                  disabled={snapshot.sending}
                  onChange={event => { setThreadDraft(event.target.value) }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
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
