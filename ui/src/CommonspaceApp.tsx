import { useEffect, useState } from 'react'
import type { CommonspaceClientStore } from './commonspace-store.ts'
import { CommonspaceConversation } from './CommonspaceConversation.tsx'
import { CommonspaceProjectView } from './CommonspaceProjectView.tsx'
import { CommonspaceSidebar } from './CommonspaceSidebar.tsx'

export interface CommonspaceAppProps {
  store: CommonspaceClientStore
}

export function CommonspaceApp({ store }: CommonspaceAppProps) {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [activeProjectViewId, setActiveProjectViewId] = useState<string | null>(null)

  useEffect(() => {
    store.connectEvents()
    return () => { store.disconnectEvents() }
  }, [store])

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
            onOpenProject={projectId => { setActiveProjectViewId(projectId); setNavigationOpen(false) }}
            onOpenConversation={() => { setActiveProjectViewId(null); setNavigationOpen(false) }}
          />
        </aside>
        <section className="csp-app-conversation">
          {activeProjectViewId === null
            ? <CommonspaceConversation store={store} />
            : <CommonspaceProjectView
                projectId={activeProjectViewId}
                store={store}
                onBack={() => { setActiveProjectViewId(null) }}
                onOpenConversation={conversation => {
                  store.selectConversation(conversation)
                  setActiveProjectViewId(null)
                }}
              />}
        </section>
      </div>
    </div>
  )
}
