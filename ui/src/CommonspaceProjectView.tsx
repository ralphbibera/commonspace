import { useState, useSyncExternalStore } from 'react'
import type { CommonspaceBootstrap, CommonspaceProject, CommonspaceState, ConversationRef } from '@commonspace/shared'
import { CommonspaceProjectChanges } from './CommonspaceProjectChanges.tsx'
import { CommonspaceProjectFiles } from './CommonspaceProjectFiles.tsx'
import type { CommonspaceClientStore } from './commonspace-store.ts'

export interface CommonspaceProjectViewProps {
  projectId: string
  targetFile?: { rootIndex: number; path: string } | null
  store: CommonspaceClientStore
  onBack: () => void
  onOpenConversation: (conversation: ConversationRef) => void
}

type ProjectTab = 'conversations' | 'files' | 'changes'

function conversationReferencesProject(state: CommonspaceState, conversation: ConversationRef, projectId: string): boolean {
  return (state.messages[`${conversation.kind}:${conversation.id}`] ?? []).some(message => message.projectId === projectId)
}

function ProjectConversations({
  bootstrap,
  state,
  project,
  onOpenConversation,
}: {
  bootstrap: CommonspaceBootstrap
  state: CommonspaceState
  project: CommonspaceProject
  onOpenConversation: (conversation: ConversationRef) => void
}) {
  const channels = state.channels.filter(channel => conversationReferencesProject(state, { kind: 'channel', id: channel.id }, project.id))
  const directMessages = bootstrap.agents.filter(agent => conversationReferencesProject(state, { kind: 'dm', id: agent.id }, project.id))
  const conversationCount = channels.length + directMessages.length
  return (
    <section className="csp-project-card" aria-labelledby="project-conversations-heading">
      <header className="csp-project-card-head">
        <strong id="project-conversations-heading">Conversations</strong>
        <small>{project.name} · real workspace conversations</small>
      </header>
      <div className="csp-project-conversation-list">
        {channels.map(channel => {
          const latest = state.messages[`channel:${channel.id}`]?.findLast(message => message.projectId === project.id)
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
                <small>Global Channel · references {project.name}</small>
                <p>{latest?.text ?? (channel.instructions.trim() || 'No messages yet.')}</p>
              </span>
              <span className="csp-project-conversation-arrow" aria-hidden="true">→</span>
            </button>
          )
        })}
        {directMessages.map(agent => {
          const latest = state.messages[`dm:${agent.id}`]?.findLast(message => message.projectId === project.id)
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
        {conversationCount === 0 && <div className="csp-project-empty">No conversations are connected to this project yet.</div>}
      </div>
      <footer className="csp-project-card-foot">{conversationCount} {conversationCount === 1 ? 'conversation' : 'conversations'} available in {project.name}</footer>
    </section>
  )
}

export function CommonspaceProjectView({
  projectId,
  targetFile,
  store,
  onBack,
  onOpenConversation,
}: CommonspaceProjectViewProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>('files')
  const [addingFolder, setAddingFolder] = useState(false)
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const bootstrap = snapshot.bootstrap
  const state = bootstrap?.state
  const project = state?.projects.find(candidate => candidate.id === projectId)

  const addLocalFolder = async () => {
    setAddingFolder(true)
    try {
      const path = await store.selectDirectory()
      if (path !== null) await store.mutate({ action: 'add-project-path', projectId, path })
    } catch {
      // Store exposes picker and mutation failures through its shared error state.
    } finally {
      setAddingFolder(false)
    }
  }

  if (project === undefined || state === undefined || bootstrap === null) {
    return (
      <main className="csp-project-view" aria-label="Project unavailable">
        <header className="csp-project-view-header"><div><h1>Project unavailable</h1><p>Selected local context could not be found.</p></div></header>
        <div className="csp-project-view-empty"><button type="button" onClick={onBack}>Back to Workspace</button></div>
      </main>
    )
  }

  const channels = state.channels.filter(channel => conversationReferencesProject(state, { kind: 'channel', id: channel.id }, project.id))
  const directMessageCount = bootstrap.agents.filter(agent => conversationReferencesProject(state, { kind: 'dm', id: agent.id }, project.id)).length
  const conversationCount = channels.length + directMessageCount
  const folderCount = project.paths.length
  const folderSummary = folderCount === 1 ? '1 folder · working directory' : `${String(folderCount)} folders · working + references`
  const workbench = activeTab === 'files' || activeTab === 'changes'

  return (
    <main className="csp-project-view" aria-label={`Project ${project.name}`}>
      <header className="csp-project-view-header">
        <div><h1>{project.name}</h1><p>{conversationCount} {conversationCount === 1 ? 'conversation' : 'conversations'} · {folderSummary}</p></div>
      </header>

      <nav className="csp-project-toolbar" aria-label="Project views">
        <button type="button" className="csp-project-back" onClick={onBack}><span aria-hidden="true">‹</span> Workspace</button>
        <div className="csp-project-tabs" role="tablist" aria-label="Project views">
          {(['conversations', 'files', 'changes'] as const).map(tab => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => { setActiveTab(tab) }}>
              {tab.slice(0, 1).toLocaleUpperCase()}{tab.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="csp-project-add-folder"
          aria-label="Add local folder"
          disabled={addingFolder}
          onClick={() => { void addLocalFolder() }}
        >
          <span aria-hidden="true">+</span> {addingFolder ? 'Choosing…' : 'Add folder'}
        </button>
        <span className="csp-project-local-pill"><span aria-hidden="true">⌁</span> Read only</span>
      </nav>

      <div className={`csp-project-content${workbench ? ' csp-project-content--workbench' : ''}`}>
        {activeTab === 'files' && <CommonspaceProjectFiles projectId={project.id} roots={project.paths} targetFile={targetFile ?? null} />}
        {activeTab === 'changes' && <CommonspaceProjectChanges projectId={project.id} />}
        {activeTab === 'conversations' && <ProjectConversations bootstrap={bootstrap} state={state} project={project} onOpenConversation={onOpenConversation} />}
      </div>
    </main>
  )
}
