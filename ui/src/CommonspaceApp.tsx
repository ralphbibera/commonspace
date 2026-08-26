import { useEffect, useState } from 'react'
import type { CommonspaceClientStore } from './commonspace-store.ts'
import { CommonspaceConversation } from './CommonspaceConversation.tsx'
import { CommonspaceSidebar } from './CommonspaceSidebar.tsx'

export interface CommonspaceAppProps {
  store: CommonspaceClientStore
}

export function CommonspaceApp({ store }: CommonspaceAppProps) {
  const [navigationOpen, setNavigationOpen] = useState(false)

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
        <CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />
      </aside>
      <section className="csp-app-conversation">
        <CommonspaceConversation store={store} />
      </section>
    </div>
  )
}
