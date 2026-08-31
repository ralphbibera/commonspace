import { useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  deriveCommonspaceInboxItems,
  type AgentAdapterKind,
  type CommonspaceAgentProfile,
  type CommonspaceChannel,
  type CommonspaceMessage,
  type CommonspaceMutation,
  type CommonspaceReasoning,
  type CommonspaceRoutingProvider,
  type CommonspaceSearchResult,
} from '@commonspace/shared'
import type { CommonspaceClientStore } from './commonspace-store.ts'
import { CommonspaceSearchDialog } from './CommonspaceSearch.tsx'
import { folderName } from './project-files-api.ts'

export interface CommonspaceSidebarProps {
  wide: boolean
  expandSidebar: () => void
  store: CommonspaceClientStore
  inboxActive?: boolean
  onOpenInbox?: () => void
  onOpenProject?: (projectId: string, file?: { rootIndex: number; path: string }) => void
  onOpenConversation?: (messageId?: string) => void
}

const MODAL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function modalFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR))
    .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
}

function useModalDialog(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const restoreFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )

  useLayoutEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const backdrop = backdropRef.current
    if (dialog === null || backdrop === null) return

    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialog && element !== backdrop)
      .map(element => ({ element, inert: element.inert, hadInertAttribute: element.hasAttribute('inert') }))
    for (const { element } of background) {
      element.inert = true
      element.setAttribute('inert', '')
    }

    if (!dialog.contains(document.activeElement)) {
      const firstFocusable = modalFocusableElements(dialog)[0]
      const initialFocus = firstFocusable ?? dialog
      initialFocus.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = modalFocusableElements(dialog)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]!
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', handleKeyDown)

    return () => {
      dialog.removeEventListener('keydown', handleKeyDown)
      for (const { element, inert, hadInertAttribute } of background) {
        element.inert = inert
        if (hadInertAttribute) element.setAttribute('inert', '')
        else element.removeAttribute('inert')
      }
      const restoreFocus = restoreFocusRef.current
      if (restoreFocus?.isConnected === true) restoreFocus.focus()
    }
  }, [])

  return { backdropRef, dialogRef }
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

function SidebarDialog({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const titleId = useId()
  const { backdropRef, dialogRef } = useModalDialog(onClose)

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div ref={backdropRef} className="csp-dialog-backdrop" aria-hidden="true" onMouseDown={onClose} />
      <section ref={dialogRef} className="csp-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="csp-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}>×</button>
        </header>
        <div className="csp-dialog-body">{children}</div>
      </section>
    </>,
    document.body,
  )
}

interface ChannelSearchResult {
  key: string
  kind: 'channel' | 'message'
  channelId: string
  channelName: string
  title: string
  detail: string
  messageId?: string
}

const MAX_CHANNEL_SEARCH_RESULTS = 24
const channelSearchTextCache = new WeakMap<CommonspaceChannel, string>()
const messageSearchTextCache = new WeakMap<CommonspaceMessage, string>()

function normalizedChannelSearchText(channel: CommonspaceChannel): string {
  const cached = channelSearchTextCache.get(channel)
  if (cached !== undefined) return cached
  const value = `${channel.name} ${channel.instructions}`.toLocaleLowerCase()
  channelSearchTextCache.set(channel, value)
  return value
}

function normalizedMessageSearchText(message: CommonspaceMessage): string {
  const cached = messageSearchTextCache.get(message)
  if (cached !== undefined) return cached
  const value = `${message.authorName} ${message.text}`.toLocaleLowerCase()
  messageSearchTextCache.set(message, value)
  return value
}

function matchesSearch(normalizedValue: string, terms: readonly string[]): boolean {
  return terms.every(term => normalizedValue.includes(term))
}

function insertNewestMessageResult(
  results: Array<ChannelSearchResult & { createdAt: string }>,
  candidate: ChannelSearchResult & { createdAt: string },
  limit: number,
): void {
  const insertAt = results.findIndex(result => candidate.createdAt.localeCompare(result.createdAt) > 0)
  if (insertAt === -1) {
    if (results.length < limit) results.push(candidate)
    return
  }
  results.splice(insertAt, 0, candidate)
  if (results.length > limit) results.pop()
}

function channelSearchResults(
  channels: CommonspaceChannel[],
  messages: Record<string, CommonspaceMessage[]>,
  query: string,
): ChannelSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (normalizedQuery === '') {
    return channels.slice(0, MAX_CHANNEL_SEARCH_RESULTS).map(channel => {
      const channelMessages = messages[`channel:${channel.id}`] ?? []
      const latestMessage = channelMessages.at(-1)
      return {
        key: `channel:${channel.id}`,
        kind: 'channel',
        channelId: channel.id,
        channelName: channel.name,
        title: `#${channel.name}`,
        detail: latestMessage?.text ?? (channel.instructions.trim() || 'No messages yet'),
      }
    })
  }

  const terms = normalizedQuery.split(/\s+/)
  const results: ChannelSearchResult[] = []
  for (const channel of channels) {
    if (matchesSearch(normalizedChannelSearchText(channel), terms)) {
      results.push({
        key: `channel:${channel.id}`,
        kind: 'channel',
        channelId: channel.id,
        channelName: channel.name,
        title: `#${channel.name}`,
        detail: channel.instructions.trim() || 'Channel',
      })
      if (results.length === MAX_CHANNEL_SEARCH_RESULTS) return results
    }
  }

  const remainingResultCount = MAX_CHANNEL_SEARCH_RESULTS - results.length
  const messageResults: Array<ChannelSearchResult & { createdAt: string }> = []
  for (const channel of channels) {
    for (const message of messages[`channel:${channel.id}`] ?? []) {
      if (!matchesSearch(normalizedMessageSearchText(message), terms)) continue
      insertNewestMessageResult(messageResults, {
        key: `message:${message.id}`,
        kind: 'message' as const,
        channelId: channel.id,
        channelName: channel.name,
        title: message.authorName,
        detail: message.text,
        createdAt: message.createdAt,
        messageId: message.parentMessageId ?? message.id,
      }, remainingResultCount)
    }
  }

  results.push(...messageResults)
  return results
}

/** @deprecated Legacy client-only channel search; use CommonspaceSearchDialog. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ChannelSearchDialog({ channels, messages, onClose, onSelect }: {
  channels: CommonspaceChannel[]
  messages: Record<string, CommonspaceMessage[]>
  onClose: () => void
  onSelect: (result: ChannelSearchResult) => void
}) {
  const titleId = useId()
  const resultsId = useId()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(() => channelSearchResults(channels, messages, deferredQuery), [channels, messages, deferredQuery])
  const boundedActiveIndex = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1)
  const activeResult = results[boundedActiveIndex]
  const searchPending = query !== deferredQuery
  const { backdropRef, dialogRef } = useModalDialog(onClose)

  if (typeof document === 'undefined') return null

  const moveSelection = (offset: number) => {
    if (results.length === 0) return
    setActiveIndex(current => (Math.min(current, results.length - 1) + offset + results.length) % results.length)
  }

  return createPortal(
    <>
      <div ref={backdropRef} className="csp-dialog-backdrop csp-search-backdrop" aria-hidden="true" onMouseDown={onClose} />
      <section ref={dialogRef} className="csp-dialog csp-search-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="csp-search-header">
          <h2 id={titleId} className="csp-visually-hidden">Search everything</h2>
          <span className="csp-search-icon" aria-hidden="true" />
          <input
            autoFocus
            type="search"
            aria-label="Search all channels"
            aria-controls={resultsId}
            aria-activedescendant={activeResult === undefined ? undefined : `${resultsId}-${String(boundedActiveIndex)}`}
            placeholder="Search messages and channels"
            value={query}
            onChange={event => { setQuery(event.target.value); setActiveIndex(0) }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                moveSelection(1)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                moveSelection(-1)
              } else if (event.key === 'Enter' && activeResult !== undefined) {
                event.preventDefault()
                onSelect(activeResult)
              }
            }}
          />
          <kbd aria-hidden="true">ESC</kbd>
        </header>
        <div className="csp-search-result-head">
          <span>{query.trim() === '' ? 'Channels' : 'Results'}</span>
          <span>{searchPending ? 'Searching…' : results.length}</span>
        </div>
        <div id={resultsId} className="csp-search-results" role="listbox" aria-label="Channel search results" aria-busy={searchPending}>
          {results.length === 0 && (
            <div className="csp-search-empty">
              {channels.length === 0 ? 'Create a channel to start searching.' : `No channel results for “${query.trim()}”.`}
            </div>
          )}
          {results.map((result, index) => (
            <button
              id={`${resultsId}-${String(index)}`}
              key={result.key}
              type="button"
              role="option"
              aria-label={result.kind === 'message' ? `Open message in ${result.channelName}: ${result.detail}` : `Open channel ${result.channelName}`}
              aria-selected={index === boundedActiveIndex}
              className="csp-search-result"
              onMouseEnter={() => { setActiveIndex(index) }}
              onClick={() => { onSelect(result) }}
            >
              <span className="csp-search-result-glyph" aria-hidden="true">{result.kind === 'channel' ? '#' : '↳'}</span>
              <span className="csp-search-result-main">
                <strong>{result.title}</strong>
                <small>{result.detail}</small>
              </span>
              <span className="csp-search-result-meta">{result.kind === 'channel' ? 'Channel' : `#${result.channelName}`}</span>
            </button>
          ))}
        </div>
        <footer className="csp-search-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>esc</kbd> Close</span>
        </footer>
      </section>
    </>,
    document.body,
  )
}

function runtimeLabel(adapter: AgentAdapterKind): string {
  if (adapter === 'codex') return 'Codex'
  return 'Hermes'
}

function agentStatusLabel(status: CommonspaceAgentProfile['status']): string {
  if (status === 'running') return 'online'
  if (status === 'unknown') return 'configured'
  return 'available'
}

function AgentAvatar({ agent }: { agent: CommonspaceAgentProfile }) {
  const style = agent.accentColor === undefined
    ? undefined
    : { '--csp-agent-accent': agent.accentColor } as CSSProperties
  return (
    <span className="csp-agent-avatar" data-runtime={agent.adapter} style={style} aria-hidden="true">
      {agent.avatarEmoji ?? agent.displayName.slice(0, 1).toLocaleUpperCase()}
      <i className={`csp-agent-presence csp-agent-presence--${agent.status}`} />
    </span>
  )
}

export function CommonspaceSidebar({ wide, expandSidebar, store, inboxActive = false, onOpenInbox, onOpenProject, onOpenConversation }: CommonspaceSidebarProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [form, setForm] = useState<'project' | 'channel' | 'agent' | null>(null)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [selectingPath, setSelectingPath] = useState(false)
  const [pathProjectId, setPathProjectId] = useState<string | null>(null)
  const [pathDraft, setPathDraft] = useState('')
  const [agentIds, setAgentIds] = useState<string[]>([])
  const [agentAdapter, setAgentAdapter] = useState<AgentAdapterKind | null>(null)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [agentProfileName, setAgentProfileName] = useState('')
  const [agentAvatarEmoji, setAgentAvatarEmoji] = useState('')
  const [agentAccentColor, setAgentAccentColor] = useState('#6d5dfc')
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
  const [routingProvider, setRoutingProvider] = useState<CommonspaceRoutingProvider>('openai-compatible')
  const [routingHarnessAgentId, setRoutingHarnessAgentId] = useState('')
  const [routingModel, setRoutingModel] = useState('')
  const [routingBaseUrl, setRoutingBaseUrl] = useState('https://api.openai.com/v1')
  const [routingApiKey, setRoutingApiKey] = useState('')
  const [clearRoutingApiKey, setClearRoutingApiKey] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => { void store.refresh() }, [store])
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLocaleLowerCase() !== 'k') return
      event.preventDefault()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', openSearch)
    return () => { window.removeEventListener('keydown', openSearch) }
  }, [])
  const bootstrap = snapshot.bootstrap
  const state = bootstrap?.state
  const inboxItems = useMemo(
    () => state === undefined ? [] : deriveCommonspaceInboxItems(state),
    [state],
  )
  const inboxUnreadCount = inboxItems.filter(item => item.unread).length
  const channelUnreadCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of inboxItems) {
      if (!item.unread || item.conversation.kind !== 'channel') continue
      counts.set(item.conversation.id, (counts.get(item.conversation.id) ?? 0) + 1)
    }
    return counts
  }, [inboxItems])
  const agents = bootstrap?.agents ?? []
  const activeAgentIds = new Set((bootstrap?.liveActivities ?? []).map(activity => activity.agentId))
  const discoveredAgents = bootstrap?.discoveredAgents ?? []
  const configuredAgentIds = new Set(agents.map(agent => agent.id))
  const availableDiscoveredAgents = discoveredAgents.filter(agent => agent.adapter === agentAdapter && !configuredAgentIds.has(agent.id))
  const models = useMemo(() => [...new Set(agents.map(agent => agent.model).filter((model): model is string => model !== null && model !== ''))], [agents])
  const projects = state?.projects ?? []
  const channels = state?.channels ?? []

  if (!wide) {
    return (
      <button type="button" className="csp-browser-rail" aria-label="Expand Commonspace sidebar" onClick={expandSidebar}>
        <span className="csp-mark" aria-hidden="true"><span /><span /><span /><span /></span>
      </button>
    )
  }

  const chooseProjectDirectory = async () => {
    setSelectingPath(true)
    try {
      const selectedPath = await store.selectDirectory()
      if (selectedPath !== null) {
        setPath(selectedPath)
        setName(current => current.trim() === '' ? folderName(selectedPath) : current)
      }
    } catch {
      // The application-level toast renders the store error once.
    } finally {
      setSelectingPath(false)
    }
  }

  const selectAgentHarness = (adapter: AgentAdapterKind) => {
    setAgentAdapter(adapter)
    setName('')
    void store.discoverAgents(adapter)
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
    } else return
    try {
      await store.mutate(mutation)
    } catch {
      // Keep the form open while the application-level toast shows the error.
      return
    }
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
    await store.mutate({ action: 'set-channel-context', channelId, instructions: channelInstructions })
    await store.mutate({ action: 'set-channel-settings', channelId, model: channelModel || null, reasoning: channelReasoning || null })
    setEditingChannelId(null)
  }

  const saveDefaults = async (event: FormEvent) => {
    event.preventDefault()
    const routingUpdate = routingProvider === 'harness'
      ? { provider: 'harness' as const, harnessAgentId: routingHarnessAgentId }
      : {
          provider: 'openai-compatible' as const,
          model: routingModel,
          baseUrl: routingBaseUrl,
          ...(clearRoutingApiKey ? { apiKey: null } : routingApiKey.trim() === '' ? {} : { apiKey: routingApiKey }),
        }
    await store.updateRoutingConfiguration(routingUpdate)
    await store.mutate({ action: 'set-defaults', model: defaultModel || null, reasoning: defaultReasoning, maxAgentsPerTurn: defaultMaxAgents, memoryThreads: defaultMemoryThreads })
    setSettingsOpen(false)
  }

  const saveAgentProfile = async (event: FormEvent, agentId: string) => {
    event.preventDefault()
    await store.mutate({
      action: 'update-agent-profile',
      agentId,
      displayName: agentProfileName,
      avatarEmoji: agentAvatarEmoji,
      accentColor: agentAccentColor,
    })
    setEditingAgentId(null)
  }

  const startDirectMessage = (agentId: string) => {
    onOpenConversation?.()
    store.selectConversation({ kind: 'dm', id: agentId })
    setForm(null)
  }

  const openSearchResult = (result: CommonspaceSearchResult) => {
    if (result.target.kind === 'conversation') {
      store.selectConversation(result.target.conversation)
      store.selectThread(result.target.threadId ?? null)
      onOpenConversation?.(result.target.messageId)
    } else if (result.target.kind === 'project-file') {
      store.selectProject(result.target.projectId)
      onOpenProject?.(result.target.projectId, { rootIndex: result.target.rootIndex, path: result.target.path })
    } else {
      store.selectConversation({ kind: 'dm', id: result.target.agentId })
      onOpenConversation?.()
    }
    setSearchOpen(false)
  }

  return (
    <div className="csp-browser" aria-label="Commonspace browser">
      <header className="csp-browser-header">
        <div className="csp-workspace-identity" aria-label="Workspace identity">
          <span className="csp-workspace-mark" aria-hidden="true">
            <span className="csp-mark"><span /><span /><span /><span /></span>
          </span>
          <span className="csp-workspace-name"><strong>Workspace</strong><small>Commonspace</small></span>
          <span className="csp-workspace-options" aria-hidden="true">•••</span>
        </div>
        <button type="button" className="csp-browser-search" aria-label="Search Commonspace" onClick={() => { setSearchOpen(true) }}>
          <span className="csp-browser-search-icon" aria-hidden="true" />
          <span className="csp-browser-search-label">Search everything</span>
          <kbd aria-hidden="true">⌘K</kbd>
        </button>
      </header>

      {searchOpen && (
        <CommonspaceSearchDialog
          projects={projects}
          onClose={() => { setSearchOpen(false) }}
          onSelect={openSearchResult}
        />
      )}

      {snapshot.loading && bootstrap === null && <div className="csp-browser-status">Loading agents…</div>}
      {settingsOpen && state !== undefined && (
        <form className="csp-browser-form csp-global-settings" onSubmit={(event) => { void saveDefaults(event) }}>
          <strong>Commonspace defaults</strong>
          <fieldset className="csp-routing-options">
            <legend>Routing engine</legend>
            {agents.map(agent => (
              <button key={agent.id} type="button" aria-label={`Use ${agent.displayName} agent for routing`} aria-pressed={routingProvider === 'harness' && routingHarnessAgentId === agent.id} onClick={() => { setRoutingProvider('harness'); setRoutingHarnessAgentId(agent.id) }}>
                <AgentAvatar agent={agent} />
                <span><strong>{agent.displayName}</strong><small>{runtimeLabel(agent.adapter)} · {agent.model ?? 'profile model'}</small></span>
              </button>
            ))}
            <button type="button" aria-label="Use OpenAI-compatible inference for routing" aria-pressed={routingProvider === 'openai-compatible'} onClick={() => { setRoutingProvider('openai-compatible'); setRoutingHarnessAgentId('') }}>
              <span><strong>{routingModel || 'Inference model'}</strong><small>OpenAI-compatible API</small></span>
            </button>
          </fieldset>
          {routingProvider === 'openai-compatible' && <>
            <strong>Inference configuration</strong>
            <label>Model ID<input aria-label="Routing model" placeholder="gpt-4.1-mini" value={routingModel} onChange={event => { setRoutingModel(event.target.value) }} /></label>
            <label>API base URL<input aria-label="Routing API base URL" type="url" value={routingBaseUrl} onChange={event => { setRoutingBaseUrl(event.target.value) }} /></label>
            <label>API key<input aria-label="Routing API key" type="password" autoComplete="new-password" placeholder={bootstrap?.routing?.apiKeyConfigured === true ? 'Saved — leave blank to keep' : 'Optional for local compatible APIs'} value={routingApiKey} onChange={event => { setRoutingApiKey(event.target.value); setClearRoutingApiKey(false) }} /></label>
            {bootstrap?.routing?.apiKeyConfigured === true && <label><input aria-label="Clear routing API key" type="checkbox" checked={clearRoutingApiKey} onChange={event => { setClearRoutingApiKey(event.target.checked) }} /> Clear saved API key</label>}
          </>}
          <fieldset className="csp-run-defaults">
            <legend>Agent run defaults</legend>
            <label>Model override<input aria-label="Default model" list="commonspace-models" placeholder="Use each agent profile model" value={defaultModel} onChange={event => { setDefaultModel(event.target.value) }} /></label>
            <datalist id="commonspace-models">{models.map(model => <option key={model} value={model} />)}</datalist>
            <label>Reasoning<select aria-label="Default reasoning" value={defaultReasoning} onChange={event => { setDefaultReasoning(event.target.value as CommonspaceReasoning) }}>
              {['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map(value => <option key={value} value={value}>{value}</option>)}
            </select></label>
            <label>Max agents per turn<input aria-label="Default max agents" type="number" min="1" max="8" value={defaultMaxAgents} onChange={event => { setDefaultMaxAgents(Number(event.target.value)) }} /></label>
            <label>Memory thread window<input aria-label="Default memory threads" type="number" min="1" max="50" value={defaultMemoryThreads} onChange={event => { setDefaultMemoryThreads(Number(event.target.value)) }} /></label>
          </fieldset>
          <div><button type="submit">Save defaults</button><button type="button" onClick={() => { setSettingsOpen(false) }}>Cancel</button></div>
        </form>
      )}

      <nav className="csp-browser-destinations" aria-label="Workspace destinations">
        <button
          type="button"
          className="csp-browser-destination"
          aria-label={`Open Inbox${inboxUnreadCount === 0 ? '' : `, ${String(inboxUnreadCount)} unread`}`}
          aria-pressed={inboxActive}
          onClick={onOpenInbox}
        >
          <span className="csp-browser-destination-icon" aria-hidden="true">⌄</span>
          <span>Inbox</span>
          {inboxUnreadCount > 0 && <span className="csp-inbox-count" aria-hidden="true">{inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}</span>}
        </button>
      </nav>

      <div className="csp-browser-scroll">
        <Section title="Projects" count={projects.length} onAdd={() => { setForm('project') }}>
          {form === 'project' && (
            <SidebarDialog title="Add a project" onClose={() => { setForm(null) }}>
              <form className="csp-browser-form csp-dialog-form" onSubmit={(event) => { void submit(event) }}>
                <input aria-label="Project name" placeholder="Project name" value={name} onChange={event => { setName(event.target.value) }} autoFocus />
                <div className="csp-directory-picker">
                  <input aria-label="Project path" placeholder="Choose a local folder" value={path} onChange={event => { setPath(event.target.value) }} />
                  <button type="button" aria-label="Choose project folder" disabled={selectingPath} onClick={() => { void chooseProjectDirectory() }}>{selectingPath ? 'Opening…' : 'Browse'}</button>
                </div>
                <div><button type="submit">Create</button><button type="button" onClick={() => { setForm(null) }}>Cancel</button></div>
              </form>
            </SidebarDialog>
          )}
          {projects.map(project => {
            const active = snapshot.activeProjectId === project.id
            const folderSummary = project.paths.length === 1
              ? '1 folder · working directory'
              : `${String(project.paths.length)} folders · working + references`
            return (
              <div key={project.id} className="csp-project-group">
                <div className="csp-project-head">
                  <button
                    type="button"
                    className="csp-browser-row"
                    aria-label={`Select project ${project.name}`}
                    aria-pressed={active}
                    onClick={() => {
                      store.selectProject(project.id)
                      onOpenProject?.(project.id)
                    }}
                  >
                    <span className="csp-project-glyph" aria-hidden="true"><span /></span>
                    <span className="csp-browser-row-main"><strong>{project.name}</strong><small>{folderSummary}</small></span>
                  </button>
                  <button
                    type="button"
                    className="csp-project-add"
                    aria-label={`Add local folder to project ${project.name}`}
                    onClick={() => {
                      store.selectProject(project.id)
                      setPathProjectId(project.id)
                      setPathDraft('')
                    }}
                  >+</button>
                </div>

                {pathProjectId === project.id && (
                  <div className="csp-project-workspaces">
                    <form className="csp-browser-form csp-path-form" onSubmit={(event) => { void submitPath(event, project.id) }}>
                      <input aria-label={`Workspace path for ${project.name}`} placeholder="/absolute/local/path" value={pathDraft} onChange={event => { setPathDraft(event.target.value) }} autoFocus />
                      <div><button type="submit">Add</button><button type="button" onClick={() => { setPathProjectId(null) }}>Cancel</button></div>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
          {projects.length === 0 && form !== 'project' && <div className="csp-browser-empty">Add a local filesystem project.</div>}
        </Section>

        <Section title="Channels" count={channels.length} onAdd={() => { setForm('channel'); setAgentIds([]) }}>
          {form === 'channel' && (
            <SidebarDialog title="Add a channel" onClose={() => { setForm(null) }}>
              <form className="csp-browser-form csp-dialog-form" onSubmit={(event) => { void submit(event) }}>
                <input aria-label="Channel name" placeholder="channel-name" value={name} onChange={event => { setName(event.target.value) }} autoFocus />
                <fieldset><legend>Agents</legend>{agents.map(agent => (
                  <label key={agent.id}><input type="checkbox" checked={agentIds.includes(agent.id)} onChange={event => {
                    setAgentIds(current => event.target.checked ? [...current, agent.id] : current.filter(id => id !== agent.id))
                  }} />{agent.displayName}</label>
                ))}</fieldset>
                <div><button type="submit">Create</button><button type="button" onClick={() => { setForm(null) }}>Cancel</button></div>
              </form>
            </SidebarDialog>
          )}
          {channels.map(channel => {
            const unreadCount = channelUnreadCounts.get(channel.id) ?? 0
            return (
            <div key={channel.id} className="csp-channel-group">
              <div className="csp-channel-head">
                <button
                  type="button"
                  className="csp-browser-row"
                  aria-label={`Open channel ${channel.name}${unreadCount === 0 ? '' : `, ${String(unreadCount)} unread`}`}
                  aria-pressed={snapshot.activeConversation?.kind === 'channel' && snapshot.activeConversation.id === channel.id}
                  onClick={() => { onOpenConversation?.(); store.selectConversation({ kind: 'channel', id: channel.id }) }}
                ><span className="csp-browser-hash">#</span><span className="csp-browser-row-main"><strong>{channel.name}</strong><small>{channel.agentIds.length} agent{channel.agentIds.length === 1 ? '' : 's'}</small></span>{unreadCount > 0 && <span className="csp-inbox-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
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
            )
          })}
          {channels.length === 0 && form !== 'channel' && <div className="csp-browser-empty">Create a channel and seat agents.</div>}
        </Section>

        <Section title="Agents" count={agents.length} onAdd={() => { setForm('agent'); setName(''); setAgentAdapter(null) }}>
          {form === 'agent' && (
            <SidebarDialog title="Add an agent" onClose={() => { setForm(null) }}>
              <label>Harness<select aria-label="Agent harness" value={agentAdapter ?? ''} onChange={event => {
                const value = event.target.value
                if (value === 'codex' || value === 'hermes') selectAgentHarness(value)
              }}>
                <option value="">Choose a harness</option>
                <option value="codex">Codex</option>
                <option value="hermes">Hermes</option>
              </select></label>
              {agentAdapter !== null && (
                <div className="csp-browser-form csp-discovered-agents">
                  <strong>{runtimeLabel(agentAdapter)} profiles</strong>
                  {snapshot.loading && <span>Discovering {runtimeLabel(agentAdapter)} profiles…</span>}
                  {!snapshot.loading && availableDiscoveredAgents.length === 0 && <span>No {runtimeLabel(agentAdapter)} profiles found.</span>}
                  {availableDiscoveredAgents.map(agent => (
                    <button key={agent.id} type="button" className="csp-dm-picker-agent" aria-label={`Add discovered agent ${agent.displayName}`} onClick={() => {
                        void store.mutate({ action: 'add-discovered-agent', agentId: agent.id })
                        setForm(null)
                      }}>
                        <AgentAvatar agent={agent} />
                        <span><strong>{agent.displayName}</strong><small>{runtimeLabel(agent.adapter)} · {agent.model ?? 'default model'}</small></span>
                      </button>
                    ))}
                </div>
              )}
              <div><button type="button" onClick={() => { setForm(null) }}>Cancel</button></div>
            </SidebarDialog>
          )}
          {editingAgentId !== null && (() => {
            const editingAgent = agents.find(agent => agent.id === editingAgentId)
            if (editingAgent === undefined) return null
            return (
              <SidebarDialog title={`Customize ${editingAgent.displayName}`} onClose={() => { setEditingAgentId(null) }}>
                <form className="csp-browser-form csp-dialog-form csp-agent-profile-form" onSubmit={(event) => { void saveAgentProfile(event, editingAgent.id) }}>
                  <div className="csp-agent-profile-preview">
                    <AgentAvatar agent={{ ...editingAgent, displayName: agentProfileName || editingAgent.displayName, ...(agentAvatarEmoji === '' ? {} : { avatarEmoji: agentAvatarEmoji }), accentColor: agentAccentColor }} />
                    <span><strong>{agentProfileName || editingAgent.displayName}</strong><small>Commonspace appearance only</small></span>
                  </div>
                  <label>Workspace name<input aria-label="Workspace name" value={agentProfileName} onChange={event => { setAgentProfileName(event.target.value) }} autoFocus /></label>
                  <label>Avatar emoji<input aria-label="Avatar emoji" value={agentAvatarEmoji} onChange={event => { setAgentAvatarEmoji(event.target.value) }} placeholder={(agentProfileName || editingAgent.displayName).slice(0, 1).toLocaleUpperCase()} maxLength={16} /></label>
                  <label>Accent color<input aria-label="Accent color" type="color" value={agentAccentColor} onChange={event => { setAgentAccentColor(event.target.value) }} /></label>
                  <p className="csp-agent-profile-note">The native {runtimeLabel(editingAgent.adapter)} profile, routing, and sessions stay unchanged.</p>
                  <div><button type="submit">Save appearance</button></div>
                </form>
              </SidebarDialog>
            )
          })()}
          {agents.map((agent) => {
            const effectiveStatus = activeAgentIds.has(agent.id) ? 'running' : agent.status
            return (
            <div key={agent.id} className="csp-agent-head">
              <button type="button" className="csp-browser-row" aria-label={`Message agent ${agent.displayName}`} aria-pressed={snapshot.activeConversation?.kind === 'dm' && snapshot.activeConversation.id === agent.id} onClick={() => { startDirectMessage(agent.id) }}>
                <AgentAvatar agent={{ ...agent, status: effectiveStatus }} />
                <span className="csp-browser-row-main">
                  <strong>{agent.displayName}</strong>
                  <small className="csp-agent-meta"><span className="csp-runtime-badge" data-runtime={agent.adapter}>{runtimeLabel(agent.adapter)}</span><span>{agent.model ?? 'default model'}</span><span className="csp-agent-status" data-status={effectiveStatus}>{agentStatusLabel(effectiveStatus)}</span></small>
                </span>
              </button>
              <button type="button" className="csp-project-add csp-agent-customize" aria-label={`Customize agent ${agent.displayName}`} onClick={() => {
                setEditingAgentId(agent.id)
                setAgentProfileName(agent.displayName)
                setAgentAvatarEmoji(agent.avatarEmoji ?? '')
                setAgentAccentColor(agent.accentColor ?? '#6d5dfc')
              }}>⋯</button>
              {state?.agents.some(candidate => candidate.id === agent.id) === true && (
                <button type="button" className="csp-project-add" aria-label={`Remove agent ${agent.displayName}`} onClick={() => { void store.mutate({ action: 'remove-agent', agentId: agent.id }) }}>×</button>
              )}
            </div>
            )
          })}
        </Section>
      </div>
      <footer className="csp-browser-footer">
        <div className="csp-browser-brand">
          <span className="csp-mark csp-mark--brand" aria-hidden="true"><span /><span /><span /><span /></span>
          <div>
            <strong>Commonspace</strong>
            <span>Local workspace</span>
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
            const routing = bootstrap?.routing
            setRoutingProvider(routing?.provider ?? 'openai-compatible')
            setRoutingHarnessAgentId(routing?.harnessAgentId ?? '')
            setRoutingModel(routing?.model ?? '')
            setRoutingBaseUrl(routing?.baseUrl ?? 'https://api.openai.com/v1')
            setRoutingApiKey('')
            setClearRoutingApiKey(false)
            setSettingsOpen(value => !value)
          }}>⚙</button>
          <button type="button" className="csp-browser-refresh" aria-label="Refresh Commonspace" onClick={() => { void store.refresh() }}>↻</button>
        </div>
      </footer>
    </div>
  )
}
