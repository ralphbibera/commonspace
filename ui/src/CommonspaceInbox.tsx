import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  deriveCommonspaceInboxItems,
  deriveCommonspaceSessions,
  type CommonspaceInboxItem,
  type CommonspaceSessionItem,
  type ConversationRef,
} from '@commonspace/shared'
import type { CommonspaceClientStore } from './commonspace-store.ts'

export interface CommonspaceInboxTarget {
  messageId: string
  conversation: ConversationRef
  threadId?: string
}

export interface CommonspaceInboxProps {
  store: CommonspaceClientStore
  onOpenItem: (item: CommonspaceInboxTarget) => void
}

function kindLabel(item: CommonspaceInboxItem): string {
  switch (item.kind) {
    case 'agent-reply': return 'Agent reply'
    case 'thread-reply': return 'Thread reply'
    case 'mention': return 'Mention'
    case 'failure': return 'Failed'
    case 'completion': return 'Completed'
    case 'timeout': return 'Timed out'
    case 'input-request': return 'Needs input'
  }
}

function formattedTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function sessionStatusLabel(session: CommonspaceSessionItem): string {
  if (session.status === 'running') return 'Running'
  if (session.status === 'completed') return 'Completed'
  if (session.attentionKind === 'input-request') return 'Needs input'
  if (session.attentionKind === 'timeout') return 'Timed out'
  return 'Failed'
}

export function CommonspaceInbox({ store, onOpenItem }: CommonspaceInboxProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [view, setView] = useState<'attention' | 'sessions'>('attention')
  const [filter, setFilter] = useState<'all' | 'unread' | 'saved'>('all')
  const [sessionFilter, setSessionFilter] = useState<'all' | CommonspaceSessionItem['status']>('all')
  const [markingRead, setMarkingRead] = useState(false)
  const state = snapshot.bootstrap?.state
  const items = useMemo(
    () => state === undefined ? [] : deriveCommonspaceInboxItems(state),
    [state],
  )
  const sessions = useMemo(
    () => state === undefined ? [] : deriveCommonspaceSessions(state, snapshot.bootstrap?.liveActivities ?? []),
    [snapshot.bootstrap?.liveActivities, state],
  )
  const unreadCount = items.filter(item => item.unread).length
  const visibleItems = filter === 'unread'
    ? items.filter(item => item.unread)
    : filter === 'saved' ? items.filter(item => item.saved) : items
  const visibleSessions = sessionFilter === 'all' ? sessions : sessions.filter(session => session.status === sessionFilter)

  const markAllRead = async () => {
    if (unreadCount === 0 || markingRead) return
    setMarkingRead(true)
    try {
      await store.mutate({ action: 'mark-inbox-read' })
    } finally {
      setMarkingRead(false)
    }
  }

  const openItem = (item: CommonspaceInboxItem) => {
    if (item.unread) {
      void store.mutate({ action: 'mark-inbox-item-read', messageId: item.messageId }).catch(() => undefined)
    }
    onOpenItem(item)
  }

  const openSession = (session: CommonspaceSessionItem) => {
    onOpenItem({
      messageId: session.messageId,
      conversation: session.conversation,
      ...(session.threadId === undefined ? {} : { threadId: session.threadId }),
    })
  }

  return (
    <main className="csp-inbox" aria-label="Inbox">
      <header className="csp-inbox-header">
        <div>
          <span className="csp-inbox-eyebrow">ATTENTION</span>
          <h1>{view === 'attention' ? 'Inbox' : 'Sessions'}</h1>
          <p>{view === 'attention' ? 'Mentions, outcomes, and requests across your conversations.' : 'Supervise running work and review sessions that need attention.'}</p>
        </div>
        {view === 'attention' && <button
          type="button"
          className="csp-inbox-mark-read"
          disabled={unreadCount === 0 || markingRead}
          onClick={() => { void markAllRead().catch(() => undefined) }}
        >
          {markingRead ? 'Marking read…' : 'Mark all read'}
        </button>}
      </header>

      <div className="csp-inbox-toolbar">
        <div className="csp-inbox-filters" role="group" aria-label="Inbox view">
          <button type="button" aria-pressed={view === 'attention'} onClick={() => { setView('attention') }}>Attention</button>
          <button type="button" aria-pressed={view === 'sessions'} onClick={() => { setView('sessions') }}>Sessions {String(sessions.length)}</button>
        </div>
        {view === 'attention'
          ? <div className="csp-inbox-filters" role="group" aria-label="Inbox filter">
              <button type="button" aria-pressed={filter === 'all'} onClick={() => { setFilter('all') }}>All</button>
              <button type="button" aria-pressed={filter === 'unread'} onClick={() => { setFilter('unread') }}>Unread{unreadCount === 0 ? '' : ` ${String(unreadCount)}`}</button>
              <button type="button" aria-pressed={filter === 'saved'} onClick={() => { setFilter('saved') }}>Saved</button>
            </div>
          : <div className="csp-inbox-filters" role="group" aria-label="Session status filter">
              {(['all', 'running', 'needs-attention', 'completed'] as const).map(status => (
                <button key={status} type="button" aria-pressed={sessionFilter === status} onClick={() => { setSessionFilter(status) }}>
                  {status === 'all' ? 'All' : status === 'needs-attention' ? 'Needs attention' : status[0]?.toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>}
      </div>

      <div className="csp-inbox-scroll" aria-live="polite">
        {view === 'attention'
          ? visibleItems.length === 0
            ? <div className="csp-inbox-empty"><span aria-hidden="true">✓</span><h2>You’re all caught up.</h2><p>New agent activity will appear here.</p></div>
            : <ol className="csp-inbox-list">
                {visibleItems.map(item => (
                  <li key={item.id} className={item.unread ? 'is-unread' : undefined}>
                    <button className="csp-inbox-item-open" type="button" aria-label={`Open ${kindLabel(item).toLowerCase()} from ${item.actorName} in ${item.conversationName}${item.unread ? ', unread' : ''}`} onClick={() => { openItem(item) }}>
                      <span className="csp-inbox-avatar" aria-hidden="true">{item.actorName.slice(0, 1).toLocaleUpperCase()}</span>
                      <span className="csp-inbox-item-main">
                        <span className="csp-inbox-item-heading"><strong>{item.actorName}</strong><span>{item.conversationName}</span><time dateTime={item.createdAt}>{formattedTime(item.createdAt)}</time></span>
                        <span className="csp-inbox-item-text">{item.text}</span>
                        <span className={`csp-inbox-kind csp-inbox-kind--${item.kind}`}>{kindLabel(item)}</span>
                      </span>
                      {item.unread && <span className="csp-inbox-unread-dot" aria-hidden="true" />}
                    </button>
                    <button className="csp-inbox-row-action" type="button" aria-pressed={item.saved} onClick={() => { void store.mutate({ action: 'set-inbox-item-saved', messageId: item.messageId, saved: !item.saved }).catch(() => undefined) }}>
                      {item.saved ? 'Remove from saved' : 'Save for later'}
                    </button>
                  </li>
                ))}
              </ol>
          : visibleSessions.length === 0
            ? <div className="csp-inbox-empty"><span aria-hidden="true">✓</span><h2>No matching sessions.</h2><p>Change the status filter to see other work.</p></div>
            : <ol className="csp-inbox-list csp-session-list">
                {visibleSessions.map(session => (
                  <li key={session.id}>
                    <button className="csp-inbox-item-open" type="button" aria-label={`Open ${sessionStatusLabel(session).toLowerCase()} session for ${session.agentName} in ${session.conversationName}`} onClick={() => { openSession(session) }}>
                      <span className="csp-inbox-avatar" aria-hidden="true">{session.agentName.slice(0, 1).toLocaleUpperCase()}</span>
                      <span className="csp-inbox-item-main">
                        <span className="csp-inbox-item-heading"><strong>{session.agentName}</strong><span>{session.projectName === null ? session.conversationName : `${session.projectName} · ${session.conversationName}`}</span><time dateTime={session.updatedAt}>{formattedTime(session.updatedAt)}</time></span>
                        <span className="csp-inbox-item-text">{session.summary}</span>
                        <span className={`csp-inbox-kind csp-inbox-kind--${session.status}`}>{sessionStatusLabel(session)}</span>
                      </span>
                    </button>
                    <div className="csp-inbox-row-actions">
                      <button type="button" aria-pressed={session.followed} onClick={() => { void store.mutate({ action: 'set-session-followed', sessionId: session.id, followed: !session.followed }).catch(() => undefined) }}>{session.followed ? 'Following' : 'Follow'}</button>
                      <button type="button" aria-pressed={session.muted} onClick={() => { void store.mutate({ action: 'set-session-muted', sessionId: session.id, muted: !session.muted }).catch(() => undefined) }}>{session.muted ? 'Muted' : 'Mute'}</button>
                    </div>
                  </li>
                ))}
              </ol>}
      </div>
    </main>
  )
}