import { useMemo, useState, useSyncExternalStore } from 'react'
import { deriveCommonspaceInboxItems, type CommonspaceInboxItem } from '@commonspace/shared'
import type { CommonspaceClientStore } from './commonspace-store.ts'

export interface CommonspaceInboxProps {
  store: CommonspaceClientStore
  onOpenItem: (item: CommonspaceInboxItem) => void
}

function kindLabel(item: CommonspaceInboxItem): string {
  switch (item.kind) {
    case 'agent-reply': return 'Agent reply'
    case 'thread-reply': return 'Thread reply'
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

export function CommonspaceInbox({ store, onOpenItem }: CommonspaceInboxProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [markingRead, setMarkingRead] = useState(false)
  const state = snapshot.bootstrap?.state
  const items = useMemo(
    () => state === undefined ? [] : deriveCommonspaceInboxItems(state),
    [state],
  )
  const unreadCount = items.filter(item => item.unread).length
  const visibleItems = filter === 'unread' ? items.filter(item => item.unread) : items

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
    if (item.unread) void store.mutate({ action: 'mark-inbox-read' }).catch(() => undefined)
    onOpenItem(item)
  }

  return (
    <main className="csp-inbox" aria-label="Inbox">
      <header className="csp-inbox-header">
        <div>
          <span className="csp-inbox-eyebrow">ATTENTION</span>
          <h1>Inbox</h1>
          <p>Replies from agents across your conversations.</p>
        </div>
        <button
          type="button"
          className="csp-inbox-mark-read"
          disabled={unreadCount === 0 || markingRead}
          onClick={() => { void markAllRead().catch(() => undefined) }}
        >
          {markingRead ? 'Marking read…' : 'Mark all read'}
        </button>
      </header>

      <div className="csp-inbox-toolbar">
        <div className="csp-inbox-filters" role="group" aria-label="Inbox filter">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => { setFilter('all') }}>All</button>
          <button type="button" aria-pressed={filter === 'unread'} onClick={() => { setFilter('unread') }}>
            Unread{unreadCount === 0 ? '' : ` ${String(unreadCount)}`}
          </button>
        </div>
      </div>

      <div className="csp-inbox-scroll" aria-live="polite">
        {visibleItems.length === 0
          ? (
              <div className="csp-inbox-empty">
                <span aria-hidden="true">✓</span>
                <h2>{filter === 'unread' && items.length > 0 ? 'You’re all caught up.' : 'No agent activity yet.'}</h2>
                <p>{filter === 'unread' && items.length > 0
                  ? 'New agent replies will appear here.'
                  : 'Agent replies will appear here.'}</p>
              </div>
            )
          : (
              <ol className="csp-inbox-list">
                {visibleItems.map(item => (
                  <li key={item.id} className={item.unread ? 'is-unread' : undefined}>
                    <button
                      type="button"
                      aria-label={`Open ${kindLabel(item).toLowerCase()} from ${item.actorName} in ${item.conversationName}${item.unread ? ', unread' : ''}`}
                      onClick={() => { openItem(item) }}
                    >
                      <span className="csp-inbox-avatar" aria-hidden="true">{item.actorName.slice(0, 1).toLocaleUpperCase()}</span>
                      <span className="csp-inbox-item-main">
                        <span className="csp-inbox-item-heading">
                          <strong>{item.actorName}</strong>
                          <span>{item.conversationName}</span>
                          <time dateTime={item.createdAt}>{formattedTime(item.createdAt)}</time>
                        </span>
                        <span className="csp-inbox-item-text">{item.text}</span>
                        <span className={`csp-inbox-kind csp-inbox-kind--${item.kind}`}>{kindLabel(item)}</span>
                      </span>
                      {item.unread && <span className="csp-inbox-unread-dot" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ol>
            )}
      </div>
    </main>
  )
}
