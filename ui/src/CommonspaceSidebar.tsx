import { useEffect, useId, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { AgentAdapterKind, CommonspaceAgentProfile, CommonspaceMutation, CommonspaceReasoning } from '@commonspace/shared'
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
          <span className={`csp-section-chevron${open ? ' is-open' : ''}`} aria-hidden="true">›</span>
          <span className="csp-section-title">{props.title}</span>
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

function adapterLabel(adapter: AgentAdapterKind): string {
  if (adapter === 'codex') return 'Codex CLI'
  if (adapter === 'claude-code') return 'Claude Code'
  return 'Hermes'
}

function agentStatusLabel(status: CommonspaceAgentProfile['status']): string {
  if (status === 'running') return 'online'
  if (status === 'unknown') return 'configured'
  return 'available'
}

function AgentAvatar({ agent }: { agent: CommonspaceAgentProfile }) {
  return (
    <span className="csp-agent-avatar" data-adapter={agent.adapter} aria-hidden="true">
      {agent.displayName.slice(0, 1).toLocaleUpperCase()}
      <i className={`csp-agent-presence csp-agent-presence--${agent.status}`} />
    </span>
  )
}

export function CommonspaceSidebar({ wide, expandSidebar, store }: CommonspaceSidebarProps) {
  const dmPickerListId = useId()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [form, setForm] = useState<'project' | 'channel' | 'dm' | 'agent' | null>(null)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [pathProjectId, setPathProjectId] = useState<string | null>(null)
  const [pathDraft, setPathDraft] = useState('')
  const [agentIds, setAgentIds] = useState<string[]>([])
  const [agentAdapter, setAgentAdapter] = useState<Exclude<AgentAdapterKind, 'hermes'>>('codex')
  const [agentModel, setAgentModel] = useState('')
  const [dmSearch, setDmSearch] = useState('')
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [channelAgentIds, setChannelAgentIds] = useState<string[]>([])
  const [channelInstructions, setChannelInstructions] = useState('')
  const [channelModel, setChannelModel] = useState('')
  const [channelReasoning, setChannelReasoning] = useState<CommonspaceReasoning | ''>('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [defaultModel, setDefaultModel] = useState('')
  const [defaultReasoning, setDefaultReasoning] = useState<CommonspaceReasoning>('max')
  const [defaultMaxAgents, setDefaultMaxAgents] = useState(4)
  const [defaultMemoryThreads, setDefaultMemoryThreads] = useState(12)

  useEffect(() => { void store.refresh() }, [store])
  const bootstrap = snapshot.bootstrap
  const state = bootstrap?.state
  const agents = bootstrap?.agents ?? []
  const activeDmId = snapshot.activeConversation?.kind === 'dm' ? snapshot.activeConversation.id : null
  const dmAgents = useMemo(
    () => agents.filter(agent => agent.id === activeDmId || (state?.messages[`dm:${agent.id}`]?.length ?? 0) > 0),
    [activeDmId, agents, state],
  )
  const normalizedDmSearch = dmSearch.trim().toLocaleLowerCase()
  const matchingDmAgents = agents.filter(agent => normalizedDmSearch === '' ||
    [agent.displayName, agent.id, agent.adapter, agent.model ?? ''].some(value => value.toLocaleLowerCase().includes(normalizedDmSearch)))
  const models = useMemo(() => [...new Set(agents.map(agent => agent.model).filter((model): model is string => model !== null && model !== ''))], [agents])

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
      }
    } else if (form === 'agent') {
      mutation = {
        action: 'add-agent',
        displayName: name,
        adapter: agentAdapter,
        model: agentModel || null,
      }
    } else return
    await store.mutate(mutation)
    setForm(null)
    setName('')
    setPath('')
    setAgentIds([])
    setAgentModel('')
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
    await store.mutate({ action: 'set-channel-context', channelId, instructions: channelInstructions })
    await store.mutate({ action: 'set-channel-settings', channelId, model: channelModel || null, reasoning: channelReasoning || null })
    setEditingChannelId(null)
  }

  const saveDefaults = async (event: FormEvent) => {
    event.preventDefault()
    await store.mutate({ action: 'set-defaults', model: defaultModel || null, reasoning: defaultReasoning, maxAgentsPerTurn: defaultMaxAgents, memoryThreads: defaultMemoryThreads })
    setSettingsOpen(false)
  }

  const startDirectMessage = (agentId: string) => {
    store.selectConversation({ kind: 'dm', id: agentId })
    setDmSearch('')
    setForm(null)
  }

  return (
    <div className="csp-browser" aria-label="Commonspace browser">
      <header className="csp-browser-header">
        <div className="csp-browser-brand">
          <span className="csp-mark csp-mark--brand" aria-hidden="true"><span /><span /><span /><span /></span>
          <div>
            <strong>Commonspace</strong>
            <span>Private agent field</span>
          </div>
          <em>LOCAL</em>
        </div>
        <div className="csp-browser-header-actions">
          <button type="button" className="csp-browser-refresh" aria-label="Commonspace settings" onClick={() => {
            const defaults = state?.defaults
            if (defaults !== undefined) {
              setDefaultModel(defaults.model ?? '')
              setDefaultReasoning(defaults.reasoning)
              setDefaultMaxAgents(defaults.maxAgentsPerTurn)
              setDefaultMemoryThreads(defaults.memoryThreads)
            }
            setSettingsOpen(value => !value)
          }}>⚙</button>
          <button type="button" className="csp-browser-refresh" aria-label="Refresh Commonspace" onClick={() => { void store.refresh() }}>↻</button>
        </div>
      </header>

      {snapshot.loading && bootstrap === null && <div className="csp-browser-status">Loading agents…</div>}
      {snapshot.error !== null && <div className="csp-runtime-error" role="alert">{snapshot.error}</div>}
      {settingsOpen && state !== undefined && (
        <form className="csp-browser-form csp-global-settings" onSubmit={(event) => { void saveDefaults(event) }}>
          <strong>Commonspace defaults</strong>
          <label>Model override<input aria-label="Default model" list="commonspace-models" placeholder="Use each agent profile model" value={defaultModel} onChange={event => { setDefaultModel(event.target.value) }} /></label>
          <datalist id="commonspace-models">{models.map(model => <option key={model} value={model} />)}</datalist>
          <label>Reasoning<select aria-label="Default reasoning" value={defaultReasoning} onChange={event => { setDefaultReasoning(event.target.value as CommonspaceReasoning) }}>
            {['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <label>Max agents per turn<input aria-label="Default max agents" type="number" min="1" max="8" value={defaultMaxAgents} onChange={event => { setDefaultMaxAgents(Number(event.target.value)) }} /></label>
          <label>Memory thread window<input aria-label="Default memory threads" type="number" min="1" max="50" value={defaultMemoryThreads} onChange={event => { setDefaultMemoryThreads(Number(event.target.value)) }} /></label>
          <div><button type="submit">Save defaults</button><button type="button" onClick={() => { setSettingsOpen(false) }}>Cancel</button></div>
        </form>
      )}

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
                    <span className="csp-project-glyph" aria-hidden="true"><span /></span>
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
                        <span className="csp-workspace-glyph" aria-hidden="true" />
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
                    setChannelInstructions(channel.instructions)
                    setChannelModel(channel.settings.model ?? '')
                    setChannelReasoning(channel.settings.reasoning ?? '')
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
                  <label className="csp-context-label">Channel instructions<textarea aria-label={`Instructions for channel ${channel.name}`} value={channelInstructions} onChange={event => { setChannelInstructions(event.target.value) }} placeholder="What agents should remember and how they should behave in this channel" /></label>
                  <label className="csp-context-label">Channel model<input aria-label={`Model for channel ${channel.name}`} list="commonspace-models" placeholder="Inherit default" value={channelModel} onChange={event => { setChannelModel(event.target.value) }} /></label>
                  <label className="csp-context-label">Channel reasoning<select aria-label={`Reasoning for channel ${channel.name}`} value={channelReasoning} onChange={event => { setChannelReasoning(event.target.value as CommonspaceReasoning | '') }}><option value="">Inherit default</option>{['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <details className="csp-memory-preview"><summary>Projected memory · {channel.memory.threadIds.length} threads</summary><pre>{channel.memory.summary || 'No completed thread memory yet.'}</pre>{channel.memory.decisions.length > 0 && <p><strong>Decisions:</strong> {channel.memory.decisions.join(' · ')}</p>}{channel.memory.openQuestions.length > 0 && <p><strong>Open questions:</strong> {channel.memory.openQuestions.join(' · ')}</p>}</details>
                  <div><button type="submit">Save</button><button type="button" onClick={() => { setEditingChannelId(null) }}>Cancel</button></div>
                </form>
              )}
            </div>
          ))}
          {(state?.channels.length ?? 0) === 0 && form !== 'channel' && <div className="csp-browser-empty">Create a channel and seat agents.</div>}
        </Section>

        <Section title="Direct Messages" count={dmAgents.length} onAdd={() => {
          setDmSearch('')
          setForm(current => current === 'dm' ? null : 'dm')
        }}>
          {form === 'dm' && (
            <div className="csp-browser-form csp-dm-picker">
              <label className="csp-dm-search">
                <span>Find an agent</span>
                <input autoFocus aria-label="Find an agent to message" aria-autocomplete="list" aria-expanded="true" aria-controls={dmPickerListId} value={dmSearch} onChange={event => { setDmSearch(event.target.value) }} placeholder="Name, profile, or adapter" />
              </label>
              <div id={dmPickerListId} className="csp-dm-picker-results" role="listbox" aria-label="Agents available for direct messages">
                {matchingDmAgents.length === 0 && <span className="csp-dm-picker-empty">No matching agents.</span>}
                {matchingDmAgents.map(agent => (
                  <button key={agent.id} type="button" role="option" aria-selected="false" className="csp-dm-picker-agent" aria-label={`Start direct message with ${agent.displayName}`} onClick={() => { startDirectMessage(agent.id) }}>
                    <AgentAvatar agent={agent} />
                    <span><strong>{agent.displayName}</strong><small>{adapterLabel(agent.adapter)} · {agent.model ?? 'default model'}</small></span>
                  </button>
                ))}
              </div>
              <div><button type="button" onClick={() => { setDmSearch(''); setForm(null) }}>Cancel</button></div>
            </div>
          )}
          {dmAgents.map(agent => (
            <button key={agent.id} type="button" className="csp-browser-row" aria-label={`Open direct message with ${agent.displayName}`} aria-pressed={snapshot.activeConversation?.kind === 'dm' && snapshot.activeConversation.id === agent.id} onClick={() => { startDirectMessage(agent.id) }}>
              <AgentAvatar agent={agent} /><span className="csp-browser-row-main"><strong>{agent.displayName}</strong><small>{state?.messages[`dm:${agent.id}`]?.at(-1)?.text.slice(0, 34) ?? 'New direct message'}</small></span>
            </button>
          ))}
          {dmAgents.length === 0 && form !== 'dm' && <div className="csp-browser-empty">Use + to choose an agent.</div>}
        </Section>

        <Section title="Agents" count={agents.length} onAdd={() => { setForm('agent'); setName(''); setAgentAdapter('codex'); setAgentModel('') }}>
          {form === 'agent' && (
            <form className="csp-browser-form" onSubmit={(event) => { void submit(event) }}>
              <input aria-label="Agent name" placeholder="Agent name" value={name} onChange={event => { setName(event.target.value) }} autoFocus />
              <select aria-label="Agent adapter" value={agentAdapter} onChange={event => { setAgentAdapter(event.target.value as Exclude<AgentAdapterKind, 'hermes'>) }}>
                <option value="codex">Codex</option>
                <option value="claude-code">Claude Code</option>
              </select>
              <input aria-label="Agent model" list="commonspace-models" placeholder="Use adapter default model" value={agentModel} onChange={event => { setAgentModel(event.target.value) }} />
              <div><button type="submit">Create agent</button><button type="button" onClick={() => { setForm(null) }}>Cancel</button></div>
            </form>
          )}
          {agents.map(agent => (
            <div key={agent.id} className="csp-agent-head">
              <button type="button" className="csp-browser-row" aria-label={`Message agent ${agent.displayName}`} onClick={() => { startDirectMessage(agent.id) }}>
                <AgentAvatar agent={agent} />
                <span className="csp-browser-row-main">
                  <strong>{agent.displayName}</strong>
                  <small className="csp-agent-meta"><span className="csp-adapter-badge" data-adapter={agent.adapter}>{adapterLabel(agent.adapter)}</span><span>{agent.model ?? 'default model'}</span><span className="csp-agent-status">{agentStatusLabel(agent.status)}</span></small>
                </span>
              </button>
              {state?.agents.some(candidate => candidate.id === agent.id) === true && (
                <button type="button" className="csp-project-add" aria-label={`Remove agent ${agent.displayName}`} onClick={() => { void store.mutate({ action: 'remove-agent', agentId: agent.id }) }}>×</button>
              )}
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}
