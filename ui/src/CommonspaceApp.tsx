import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CommonspaceClientStore } from './commonspace-store.ts'
import { CommonspaceConversation } from './CommonspaceConversation.tsx'
import { CommonspaceInbox } from './CommonspaceInbox.tsx'
import { CommonspaceProjectView } from './CommonspaceProjectView.tsx'
import { CommonspaceSidebar } from './CommonspaceSidebar.tsx'

export interface CommonspaceAppProps {
  store: CommonspaceClientStore
}

export function CommonspaceApp({ store }: CommonspaceAppProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [activeDestination, setActiveDestination] = useState<'conversation' | 'inbox'>('conversation')
  const [activeProjectViewId, setActiveProjectViewId] = useState<string | null>(null)
  const [targetProjectFile, setTargetProjectFile] = useState<{ rootIndex: number; path: string } | null>(null)
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null)
  const notificationLinkHandled = useRef(false)

  useEffect(() => {
    store.connectEvents()
    return () => { store.disconnectEvents() }
  }, [store])

  useEffect(() => {
    if (notificationLinkHandled.current || snapshot.bootstrap === null) return
    const parameters = new URLSearchParams(window.location.search)
    const kind = parameters.get('conversation')
    const conversationId = parameters.get('conversationId')
    const threadId = parameters.get('threadId')
    const messageId = parameters.get('messageId')
    if ((kind !== 'channel' && kind !== 'dm') || conversationId === null || messageId === null ||
      conversationId === '' || conversationId.length > 200 || messageId === '' || messageId.length > 200 ||
      (threadId !== null && (threadId === '' || threadId.length > 200))) {
      notificationLinkHandled.current = true
      return
    }
    const conversation = { kind, id: conversationId } as const
    const state = snapshot.bootstrap.state
    const conversationExists = kind === 'channel'
      ? state.channels.some(channel => channel.id === conversationId)
      : state.agents.some(agent => agent.id === conversationId)
    const message = state.messages[`${kind}:${conversationId}`]?.find(candidate => candidate.id === messageId)
    const thread = threadId === null ? undefined : state.threads.find(candidate => candidate.id === threadId)
    const threadMatches = kind === 'dm'
      ? threadId === null
      : threadId === null || (thread !== undefined && thread.channelId === conversationId &&
          (message?.threadId === thread.id || thread.rootMessageId === message?.id))
    notificationLinkHandled.current = true
    if (!conversationExists || message === undefined || !threadMatches) return
    store.selectConversation(conversation)
    if (thread !== undefined) store.selectThread(thread.id)
    setActiveProjectViewId(null)
    setTargetProjectFile(null)
    setActiveDestination('conversation')
    setTargetMessageId(message.id)
    void store.mutate({ action: 'mark-inbox-item-read', messageId: message.id }).catch(() => undefined)
  }, [snapshot.bootstrap, store])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavigationOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.removeEventListener('keydown', closeOnEscape) }
  }, [])

  return (
    <div className={`csp-app${navigationOpen ? ' csp-app--nav-open' : ''}`} aria-label="Commonspace application">
      <div className="csp-app-chrome" aria-hidden="true">
        <span className="csp-window-controls"><i /><i /><i /></span>
        <span className="csp-window-history"><i>‹</i><i>›</i></span>
      </div>
      <div className="csp-app-frame">
        <button
          type="button"
          className="csp-app-nav-toggle"
          aria-label={navigationOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navigationOpen}
          onClick={() => { setNavigationOpen(open => !open) }}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          className="csp-app-backdrop"
          aria-label="Close navigation"
          tabIndex={navigationOpen ? 0 : -1}
          onClick={() => { setNavigationOpen(false) }}
        />
        <aside className="csp-app-sidebar">
          <CommonspaceSidebar
            wide
            expandSidebar={() => undefined}
            store={store}
            inboxActive={activeDestination === 'inbox'}
            onOpenInbox={() => {
              setActiveProjectViewId(null)
              setTargetProjectFile(null)
              setActiveDestination('inbox')
              setNavigationOpen(false)
            }}
            onOpenProject={(projectId, file) => {
              setActiveProjectViewId(projectId)
              setTargetProjectFile(file ?? null)
              setActiveDestination('conversation')
              setNavigationOpen(false)
            }}
            onOpenConversation={messageId => {
              setActiveProjectViewId(null)
              setTargetProjectFile(null)
              setActiveDestination('conversation')
              setTargetMessageId(messageId ?? null)
              setNavigationOpen(false)
            }}
          />
        </aside>
        <section className="csp-app-conversation">
          {activeProjectViewId === null
            ? activeDestination === 'inbox'
              ? <CommonspaceInbox
                  store={store}
                  onOpenItem={item => {
                    store.selectConversation(item.conversation)
                    if (item.threadId !== undefined) store.selectThread(item.threadId)
                    if (item.conversation.kind === 'channel') {
                      const messages = snapshot.bootstrap?.state.messages[`channel:${item.conversation.id}`] ?? []
                      const sourceMessage = messages.find(message => message.id === item.messageId)
                      setTargetMessageId(sourceMessage?.parentMessageId ?? item.messageId)
                    }
                    setActiveDestination('conversation')
                  }}
                />
              : <CommonspaceConversation
                  store={store}
                  targetMessageId={targetMessageId}
                  onTargetMessageHandled={() => { setTargetMessageId(null) }}
                />
            : <CommonspaceProjectView
                projectId={activeProjectViewId}
                targetFile={targetProjectFile}
                store={store}
                onBack={() => { setActiveProjectViewId(null) }}
                onOpenConversation={conversation => {
                  store.selectConversation(conversation)
                  setActiveProjectViewId(null)
                }}
              />}
        </section>
      </div>
      {snapshot.error !== null && <div className="csp-app-toast" role="alert">{snapshot.error}</div>}
    </div>
  )
}
