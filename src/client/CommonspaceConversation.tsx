import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { ConversationRef, CommonspaceMessage } from '../contracts.ts'
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
    ? <span key={`${message.id}-${index}`}>{part.text}</span>
    : <mark key={`${message.id}-${index}`} className={`csp-tag csp-tag--${part.kind}`}>{part.text}</mark>)
}

function suggestionLabel(suggestion: TagSuggestion): string {
  return suggestion.kind === 'agent' ? `Agent · ${suggestion.label}` : suggestion.kind === 'project' ? `Project · ${suggestion.label}` : `Channel · ${suggestion.label}`
}

export function CommonspaceConversation({ store }: CommonspaceConversationProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [draft, setDraft] = useState('')
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const bottom = useRef<HTMLDivElement>(null)
  const messages = store.messages()
  const heading = conversationTitle(store, snapshot.activeConversation)
  const suggestions = snapshot.bootstrap === null ? [] : tagSuggestions(draft, snapshot.bootstrap)

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages.length, snapshot.sending])

  const selectSuggestion = (suggestion: TagSuggestion) => {
    setDraft(current => insertTag(current, suggestion.token))
    setSelectedSuggestion(0)
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (text === '') return
    setDraft('')
    try { await store.send(text) } catch { setDraft(text) }
  }

  return (
    <main className="csp-conversation" aria-label="Commonspace conversation">
      <header className="csp-conversation-header">
        <div><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>
      </header>

      {snapshot.activeConversation === null ? (
        <div className="csp-conversation-hero">
          <span className="csp-mark csp-mark--large" aria-hidden="true"><span /><span /><span /><span /></span>
          <h2>Humans and Hermes agents, one workspace.</h2>
          <p>Choose a channel or an Agent from the Commonspace sidebar.</p>
        </div>
      ) : (
        <>
          <div className="csp-message-list">
            {messages.length === 0 && <div className="csp-conversation-empty">No messages yet. Start the conversation.</div>}
            {messages.map(message => (
              <article key={message.id} className={`csp-message csp-message--${message.authorType}`}>
                <div className="csp-message-avatar" aria-hidden="true">{message.authorName.slice(0, 1).toUpperCase()}</div>
                <div><header><strong>{message.authorName}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></header><p>{renderMessageText(message)}</p></div>
              </article>
            ))}
            {snapshot.sending && <div className="csp-agent-working">Hermes agents are responding…</div>}
            <div ref={bottom} />
          </div>
          <form className="csp-message-composer" onSubmit={(event) => { void send(event) }}>
            <div className="csp-composer-input-wrap">
              <textarea aria-label={`Message ${heading.title}`} placeholder={`Message ${heading.title}`} value={draft} disabled={snapshot.sending} onChange={event => { setDraft(event.target.value); setSelectedSuggestion(0) }} onKeyDown={event => {
                if (suggestions.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                  event.preventDefault()
                  setSelectedSuggestion(current => event.key === 'ArrowDown' ? (current + 1) % suggestions.length : (current - 1 + suggestions.length) % suggestions.length)
                } else if (suggestions.length > 0 && (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey))) {
                  event.preventDefault()
                  selectSuggestion(suggestions[selectedSuggestion] ?? suggestions[0]!)
                } else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
              }} />
              {suggestions.length > 0 && (
                <div className="csp-tag-suggestions" role="listbox" aria-label="Tag suggestions">
                  {suggestions.map((suggestion, index) => <button key={`${suggestion.kind}-${suggestion.id}`} type="button" role="option" aria-selected={index === selectedSuggestion} className={index === selectedSuggestion ? 'is-selected' : ''} onMouseDown={event => { event.preventDefault(); selectSuggestion(suggestion) }}><strong>{suggestion.token}</strong><span>{suggestionLabel(suggestion)}</span></button>)}
                </div>
              )}
            </div>
            <button type="submit" disabled={snapshot.sending || draft.trim() === ''}>Send</button>
          </form>
        </>
      )}
      {snapshot.error !== null && <div className="csp-conversation-error" role="alert">{snapshot.error}</div>}
    </main>
  )
}
