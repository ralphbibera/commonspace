import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { ConversationRef } from '../contracts.ts'
import type { CommonspaceClientStore } from './commonspace-store.ts'

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

export function CommonspaceConversation({ store }: CommonspaceConversationProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [draft, setDraft] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const messages = store.messages()
  const heading = conversationTitle(store, snapshot.activeConversation)

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages.length, snapshot.sending])

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
                <div><header><strong>{message.authorName}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></header><p>{message.text}</p></div>
              </article>
            ))}
            {snapshot.sending && <div className="csp-agent-working">Hermes agents are responding…</div>}
            <div ref={bottom} />
          </div>
          <form className="csp-message-composer" onSubmit={(event) => { void send(event) }}>
            <textarea aria-label={`Message ${heading.title}`} placeholder={`Message ${heading.title}`} value={draft} disabled={snapshot.sending} onChange={event => { setDraft(event.target.value) }} onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
            }} />
            <button type="submit" disabled={snapshot.sending || draft.trim() === ''}>Send</button>
          </form>
        </>
      )}
      {snapshot.error !== null && <div className="csp-conversation-error" role="alert">{snapshot.error}</div>}
    </main>
  )
}
