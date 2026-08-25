import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { CommonspaceMutation, HermesAgentProfile } from '../contracts.ts'
import type { CommonspaceClientStore } from './commonspace-store.ts'

export interface CommonspaceSidebarProps {
  wide: boolean
  expandSidebar: () => void
  store: CommonspaceClientStore
}

function Section(props: {
  title: string
  count: number
  onAdd?: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <section className="csp-browser-section">
      <div className="csp-browser-section-head">
        <button type="button" className="csp-browser-disclosure" aria-expanded={open} onClick={() => { setOpen(value => !value) }}>
          <span aria-hidden="true">{open ? '⌄' : '›'}</span>
          <span>{props.title}</span>
          <span className="csp-browser-count">{props.count}</span>
        </button>
        {props.onAdd !== undefined && (
          <button type="button" className="csp-browser-add" aria-label={`Add ${props.title.slice(0, -1).toLowerCase()}`} onClick={props.onAdd}>+</button>
        )}
      </div>
      {open && <div className="csp-browser-section-body">{props.children}</div>}
    </section>
  )
}

function AgentDot({ agent }: { agent: HermesAgentProfile }) {
  return <span className={`csp-agent-dot csp-agent-dot--${agent.status}`} aria-hidden="true" />
}

export function CommonspaceSidebar({ wide, expandSidebar, store }: CommonspaceSidebarProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [form, setForm] = useState<'project' | 'channel' | null>(null)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [pathProjectId, setPathProjectId] = useState<string | null>(null)
  const [pathDraft, setPathDraft] = useState('')
  const [projectId, setProjectId] = useState('')
  const [agentIds, setAgentIds] = useState<string[]>([])
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [channelAgentIds, setChannelAgentIds] = useState<string[]>([])

  useEffect(() => { void store.refresh() }, [store])
  const bootstrap = snapshot.bootstrap
  const state = bootstrap?.state
  const agents = bootstrap?.agents ?? []
  const dmAgents = useMemo(() => agents.filter(agent => (state?.messages[`dm:${agent.id}`]?.length ?? 0) > 0), [agents, state])

  if (!wide) {
    return (
      <button type="button" className="csp-browser-rail" aria-label="Expand Commonspace sidebar" onClick={expandSidebar}>
        <span className="csp-mark" aria-hidden="true"><span /><span /><span /><span /></span>
      </button>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    let mutation: CommonspaceMutation
    if (form === 'project') {
      mutation = { action: 'create-project', name, paths: [path] }
    } else if (form === 'channel') {
      mutation = {
        action: 'create-channel',
        name,
        agentIds,
        ...(projectId === '' ? {} : { projectId }),
      }
    } else return
    await store.mutate(mutation)
    setForm(null)
    setName('')
    setPath('')
    setAgentIds([])
  }

  const submitPath = async (event: FormEvent, targetProjectId: string) => {
    event.preventDefault()
    await store.mutate({ action: 'add-project-path', projectId: targetProjectId, path: pathDraft })
    setPathProjectId(null)
    setPathDraft('')
  }

  const saveChannelAgents = async (event: FormEvent, channelId: string) => {
    event.preventDefault()
    await store.mutate({ action: 'set-channel-agents', channelId, agentIds: channelAgentIds })
    setEditingChannelId(null)
  }

  return (
    <div className="csp-browser" aria-label="Commonspace browser">
      <header className="csp-browser-header">
        <div>
          <strong>Commonspace</strong>
          <span>Hermes agents</span>
        </div>
        <button type="button" className="csp-browser-refresh" aria-label="Refresh Commonspace" onClick={() => { void store.refresh() }}>↻</button>
      </header>

      {snapshot.loading && bootstrap === null && <div className="csp-browser-status">Loading Hermes profiles…</div>}
      {snapshot.error !== null && <div className="csp-runtime-error" role="alert">{snapshot.error}</div>}

      <div className="csp-browser-scroll">
        <Section title="Projects" count={state?.projects.length ?? 0} onAdd={() => { setForm('project') }}>
          {form === 'project' && (
            <form className="csp-browser-form" onSubmit={(event) => { void submit(event) }}>
              <input aria-label="Project name" placeholder="Project name" value={name} onChange={event => { setName(event.target.value) }} autoFocus />
              <input aria-label="Project path" placeholder="/absolute/local/path" value={path} onChange={event => { setPath(event.target.value) }} />
              <div><button type="submit">Create</button><button type="button" onClick={() => { setForm(null) }}>Cancel</button></div>
            </form>
          )}
          {state?.projects.map(project => {
            const active = snapshot.activeProjectId === project.id
            return (
              <div key={project.id} className="csp-project-group">
                <div className="csp-project-head">
                  <button
                    type="button"
                    className="csp-browser-row"
                    aria-label={`Select project ${project.name}`}
                    aria-pressed={active}
                    onClick={() => { store.selectProject(project.id) }}
                  >
                    <span aria-hidden="true">▱</span>
                    <span className="csp-browser-row-main"><strong>{project.name}</strong><small>{project.paths.length} workspace{project.paths.length === 1 ? '' : 's'}</small></span>
                  </button>
                  <button
                    type="button"
                    className="csp-project-add"
                    aria-label={`Add workspace to project ${project.name}`}
                    onClick={() => {
                      store.selectProject(project.id)
                      setPathProjectId(project.id)
                      setPathDraft('')
                    }}
                  >+</button>
                </div>
                {active && (
                  <div className="csp-project-workspaces">
                    {project.paths.map(projectPath => (
                      <div key={projectPath} className="csp-workspace-row" title={projectPath}>
                        <span aria-hidden="true">▱</span>
                        <span>{projectPath.split(/[\\/]/).filter(Boolean).at(-1) ?? projectPath}</span>
                        <small>{projectPath}</small>
                      </div>
                    ))}
                    {pathProjectId === project.id && (
                      <form className="csp-browser-form csp-path-form" onSubmit={(event) => { void submitPath(event, project.id) }}>
                        <input aria-label={`Workspace path for ${project.name}`} placeholder="/absolute/local/path" value={pathDraft} onChange={event => { setPathDraft(event.target.value) }} autoFocus />
                        <div><button type="submit">Add</button><button type="button" onClick={() => { setPathProjectId(null) }}>Cancel</button></div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {(state?.projects.length ?? 0) === 0 && form !== 'project' && <div className="csp-browser-empty">Add a local filesystem project.</div>}
        </Section>

        <Section title="Channels" count={state?.channels.length ?? 0} onAdd={() => { setForm('channel'); setAgentIds(agents.map(agent => agent.id)) }}>
          {form === 'channel' && (
            <form className="csp-browser-form" onSubmit={(event) => { void submit(event) }}>
              <input aria-label="Channel name" placeholder="channel-name" value={name} onChange={event => { setName(event.target.value) }} autoFocus />
              <select aria-label="Channel project" value={projectId} onChange={event => { setProjectId(event.target.value) }}>
                <option value="">No project</option>
                {state?.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <fieldset><legend>Agents</legend>{agents.map(agent => (
                <label key={agent.id}><input type="checkbox" checked={agentIds.includes(agent.id)} onChange={event => {
                  setAgentIds(current => event.target.checked ? [...current, agent.id] : current.filter(id => id !== agent.id))
                }} />{agent.displayName}</label>
              ))}</fieldset>
              <div><button type="submit">Create</button><button type="button" onClick={() => { setForm(null) }}>Cancel</button></div>
            </form>
          )}
          {state?.channels.map(channel => (
            <div key={channel.id} className="csp-channel-group">
              <div className="csp-channel-head">
                <button
                  type="button"
                  className="csp-browser-row"
                  aria-pressed={snapshot.activeConversation?.kind === 'channel' && snapshot.activeConversation.id === channel.id}
                  onClick={() => { store.selectConversation({ kind: 'channel', id: channel.id }) }}
                ><span className="csp-browser-hash">#</span><span className="csp-browser-row-main"><strong>{channel.name}</strong><small>{channel.agentIds.length} agent{channel.agentIds.length === 1 ? '' : 's'}</small></span></button>
                <button
                  type="button"
                  className="csp-project-add"
                  aria-label={`Manage agents in channel ${channel.name}`}
                  onClick={() => {
                    setEditingChannelId(channel.id)
                    setChannelAgentIds(channel.agentIds)
                  }}
                >⋯</button>
              </div>
              {editingChannelId === channel.id && (
                <form className="csp-browser-form csp-channel-members" onSubmit={(event) => { void saveChannelAgents(event, channel.id) }}>
                  <fieldset><legend>Channel agents</legend>{agents.map(agent => (
                    <label key={agent.id}><input type="checkbox" checked={channelAgentIds.includes(agent.id)} onChange={event => {
                      setChannelAgentIds(current => event.target.checked ? [...current, agent.id] : current.filter(id => id !== agent.id))
                    }} />{agent.displayName}</label>
                  ))}</fieldset>
                  <div><button type="submit">Save</button><button type="button" onClick={() => { setEditingChannelId(null) }}>Cancel</button></div>
                </form>
              )}
            </div>
          ))}
          {(state?.channels.length ?? 0) === 0 && form !== 'channel' && <div className="csp-browser-empty">Create a channel and seat Hermes agents.</div>}
        </Section>

        <Section title="Direct Messages" count={dmAgents.length}>
          {dmAgents.map(agent => (
            <button key={agent.id} type="button" className="csp-browser-row" aria-pressed={snapshot.activeConversation?.kind === 'dm' && snapshot.activeConversation.id === agent.id} onClick={() => { store.selectConversation({ kind: 'dm', id: agent.id }) }}>
              <AgentDot agent={agent} /><span className="csp-browser-row-main"><strong>{agent.displayName}</strong><small>{state?.messages[`dm:${agent.id}`]?.at(-1)?.text.slice(0, 34)}</small></span>
            </button>
          ))}
          {dmAgents.length === 0 && <div className="csp-browser-empty">Start a DM from the Agents list.</div>}
        </Section>

        <Section title="Agents" count={agents.length}>
          {agents.map(agent => (
            <button key={agent.id} type="button" className="csp-browser-row" aria-label={`Message agent ${agent.displayName}`} onClick={() => { store.selectConversation({ kind: 'dm', id: agent.id }) }}>
              <AgentDot agent={agent} /><span className="csp-browser-row-main"><strong>{agent.displayName}</strong><small>{agent.model} · {agent.status === 'running' ? 'online' : 'available'}</small></span>
            </button>
          ))}
        </Section>
      </div>
    </div>
  )
}
