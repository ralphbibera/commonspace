import { useSyncExternalStore } from 'react'
import type { ConversationRef } from '@commonspace/shared'
import type { CommonspaceClientStore } from './commonspace-store.ts'

export interface CommonspaceProjectViewProps {
  projectId: string
  store: CommonspaceClientStore
  onBack: () => void
  onOpenConversation: (conversation: ConversationRef) => void
}

export function CommonspaceProjectView({
  projectId,
  store,
  onBack,
  onOpenConversation,
}: CommonspaceProjectViewProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const bootstrap = snapshot.bootstrap
  const state = bootstrap?.state
  const project = state?.projects.find(candidate => candidate.id === projectId)

  if (project === undefined || state === undefined || bootstrap === null) {
    return (
      <main className="csp-project-view" aria-label="Project unavailable">
        <header className="csp-project-view-header"><div><h1>Project unavailable</h1><p>The selected local context could not be found.</p></div></header>
        <div className="csp-project-view-empty"><button type="button" onClick={onBack}>Back to Workspace</button></div>
      </main>
    )
  }

  const channels = state.channels.filter(channel => channel.projectId === project.id || channel.projectId === null)
  const directMessages = bootstrap.agents.filter(agent => (state.messages[`dm:${agent.id}`]?.length ?? 0) > 0)
  const conversationCount = channels.length + directMessages.length
  const folderCount = project.paths.length
  const folderSummary = folderCount === 1 ? '1 folder · working directory' : `${String(folderCount)} folders · working + references`

  return (
    <main className="csp-project-view" aria-label={`Project ${project.name}`}>
      <header className="csp-project-view-header">
        <div><h1>{project.name}</h1><p>{project.name} · {conversationCount} {conversationCount === 1 ? 'conversation' : 'conversations'} · {folderSummary}</p></div>
      </header>

      <nav className="csp-project-toolbar" aria-label="Project views">
        <button type="button" className="csp-project-back" onClick={onBack}><span aria-hidden="true">‹</span> Workspace</button>
        <div className="csp-project-tabs" role="tablist" aria-label="Project views">
          <button type="button" role="tab" aria-selected="true">Conversations</button>
          <button type="button" role="tab" aria-selected="false" disabled title="Files require repository read support">Files</button>
          <button type="button" role="tab" aria-selected="false" disabled title="Changes require Git read support">Changes</button>
        </div>
        <span className="csp-project-local-pill"><span aria-hidden="true">⌁</span> Local</span>
      </nav>

      <div className="csp-project-content">
        <section className="csp-project-card" aria-labelledby="project-conversations-heading">
          <header className="csp-project-card-head">
            <strong id="project-conversations-heading">Conversations</strong>
            <small>{project.name} · real workspace conversations</small>
          </header>
          <div className="csp-project-conversation-list">
            {channels.map(channel => {
              const latest = state.messages[`channel:${channel.id}`]?.at(-1)
              const bound = channel.projectId === project.id
              return (
                <button
                  key={`channel:${channel.id}`}
                  type="button"
                  className="csp-project-conversation-row"
                  aria-label={`Open channel ${channel.name}`}
                  onClick={() => onOpenConversation({ kind: 'channel', id: channel.id })}
                >
                  <span className="csp-project-conversation-glyph" aria-hidden="true">#</span>
                  <span className="csp-project-conversation-main">
                    <strong># {channel.name}</strong>
                    <small>Channel · {bound ? `project ${project.name}` : 'unbound Workspace conversation'}</small>
                    <p>{latest?.text ?? (channel.instructions.trim() || 'No messages yet.')}</p>
                  </span>
                  <span className="csp-project-conversation-arrow" aria-hidden="true">→</span>
                </button>
              )
            })}
            {directMessages.map(agent => {
              const latest = state.messages[`dm:${agent.id}`]?.at(-1)
              return (
                <button
                  key={`dm:${agent.id}`}
                  type="button"
                  className="csp-project-conversation-row"
                  aria-label={`Open direct message ${agent.displayName}`}
                  onClick={() => onOpenConversation({ kind: 'dm', id: agent.id })}
                >
                  <span className="csp-project-conversation-avatar" aria-hidden="true">{agent.displayName.slice(0, 1).toLocaleUpperCase()}</span>
                  <span className="csp-project-conversation-main">
                    <strong>{agent.displayName}</strong>
                    <small>Agent DM · selected project context</small>
                    <p>{latest?.text ?? 'No messages yet.'}</p>
                  </span>
                  <span className="csp-project-conversation-arrow" aria-hidden="true">→</span>
                </button>
              )
            })}
            {conversationCount === 0 && <div className="csp-project-empty">No real conversations are connected to this project yet.</div>}
          </div>
          <footer className="csp-project-card-foot">{conversationCount} {conversationCount === 1 ? 'conversation' : 'conversations'} available in {project.name}</footer>
        </section>

        <section className="csp-project-card csp-project-folder-card" aria-labelledby="project-folders-heading">
          <header className="csp-project-card-head">
            <strong id="project-folders-heading">Local folders</strong>
            <small>{folderSummary} · repository browsing unavailable</small>
          </header>
          <div className="csp-project-folder-list">
            {project.paths.map((path, index) => (
              <div className="csp-project-folder-row" key={path} title={path}>
                <span className="csp-project-folder-glyph" aria-hidden="true" />
                <span><strong>{path.split(/[\\/]/).filter(Boolean).at(-1) ?? path}</strong><small>{index === 0 ? 'Working directory' : 'Reference folder'} · {path}</small></span>
                <span className="csp-project-unavailable">Files unavailable</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
