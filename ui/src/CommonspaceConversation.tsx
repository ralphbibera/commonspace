import { Fragment, lazy, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { deriveCommonspaceInboxItems, deriveCommonspaceSessions, referencedProjectIds, type AgentAdapterKind, type CommonspaceAgentProfile, type CommonspaceBootstrap, type CommonspaceLiveAgentActivity, type CommonspacePermissionRequest, type CommonspaceTraceEntry, type ConversationRef, type CommonspaceMessage, type CommonspaceThread, type RerouteAssignmentRequest, type SendFileAttachment, type SendImageAttachment } from '@commonspace/shared'
import { SettingsIcon } from 'lucide-react'
import type { CommonspaceClientStore } from './commonspace-store.ts'
import { AgentSettingsPane, ChannelSettingsPane } from './CommonspaceContextSettings.tsx'
import { AgentTrace, AgentTraceTimeline } from './AgentTrace.tsx'
import { RunAttribution } from './RunAttribution.tsx'
import { useMessageSpeech, type MessageSpeechControls } from './message-speech.ts'
import { resolveSlashCommand, slashCommandSuggestions } from './slash-commands.ts'
import { insertTag, tagReferenceParts, tagSuggestions, type TagSuggestion } from './tagging.ts'
import { cn } from '@/lib/utils'
import { WorkspaceHeader } from '@/design-system/WorkspaceHeader'

const LazyMessageMarkdown = lazy(async () => {
  const module = await import('./MessageMarkdown.tsx')
  return { default: module.MessageMarkdown }
})

const messageMarkdownFallback = (
  <p className="text-xs text-muted-foreground" role="status" aria-label="Formatting agent message">Formatting message…</p>
)

export interface CommonspaceConversationProps {
  store: CommonspaceClientStore
  targetMessageId?: string | null
  onTargetMessageHandled?: () => void
  settingsRequest?: { kind: 'channel' | 'agent'; id: string; token: number } | null
}

interface CommandFeedback {
  tone: 'info' | 'success' | 'error'
  title: string
  body: string
  action?: 'reset-dm'
}

const MAX_PASTED_IMAGES = 4
const MAX_PASTED_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_ATTACHED_FILES = 8
const MAX_ATTACHED_FILE_BYTES = 8 * 1024 * 1024
const PASTED_IMAGE_TYPES = new Set<SendImageAttachment['mimeType']>(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

function readPastedImage(file: File): Promise<SendImageAttachment> {
  if (!PASTED_IMAGE_TYPES.has(file.type as SendImageAttachment['mimeType'])) return Promise.reject(new Error('Only PNG, JPEG, GIF, and WebP images can be pasted.'))
  if (file.size === 0 || file.size > MAX_PASTED_IMAGE_BYTES) return Promise.reject(new Error('Pasted images must be 8 MB or smaller.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => { reject(new Error('Could not read the pasted image.')) }
    reader.onload = () => {
      const result = reader.result
      const marker = ';base64,'
      const markerIndex = typeof result === 'string' ? result.indexOf(marker) : -1
      if (typeof result !== 'string' || markerIndex < 0) {
        reject(new Error('Could not read the pasted image.'))
        return
      }
      resolve({
        name: file.name.trim() || 'pasted-image.png',
        mimeType: file.type as SendImageAttachment['mimeType'],
        data: result.slice(markerIndex + marker.length),
      })
    }
    reader.readAsDataURL(file)
  })
}

function readAttachedFile(file: File): Promise<SendFileAttachment> {
  if (file.size === 0 || file.size > MAX_ATTACHED_FILE_BYTES) return Promise.reject(new Error('Attached files must be 8 MB or smaller.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => { reject(new Error('Could not read the attached file.')) }
    reader.onload = () => {
      const result = reader.result
      const marker = ';base64,'
      const markerIndex = typeof result === 'string' ? result.indexOf(marker) : -1
      if (typeof result !== 'string' || markerIndex < 0) {
        reject(new Error('Could not read the attached file.'))
        return
      }
      resolve({
        name: file.name.trim() || 'attachment',
        mimeType: file.type.trim() || 'application/octet-stream',
        data: result.slice(markerIndex + marker.length),
      })
    }
    reader.readAsDataURL(file)
  })
}

function PendingImageStrip({
  images,
  onRemove,
}: {
  images: readonly SendImageAttachment[]
  onRemove: (index: number) => void
}) {
  if (images.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 py-2" aria-label="Attached images">
      {images.map((image, index) => (
        <figure key={`${image.name}-${String(index)}`} className="relative w-24"><img className="h-16 w-24 rounded-sm border object-cover" src={`data:${image.mimeType};base64,${image.data}`} alt={`Pasted image ${image.name}`} /><figcaption className="mt-1 truncate text-xs text-muted-foreground">{image.name}</figcaption><button className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full border bg-background" type="button" aria-label={`Remove ${image.name}`} onClick={() => { onRemove(index) }}>×</button>
        </figure>
      ))}
    </div>
  )
}

function PendingFileStrip({ files, onRemove }: { files: readonly SendFileAttachment[]; onRemove: (index: number) => void }) {
  if (files.length === 0) return null
  return <div className="grid gap-1 py-2" aria-label="Attached files">{files.map((file, index) => (
    <span key={`${file.name}-${String(index)}`} className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center rounded-sm border bg-muted px-3"><span className="min-w-0"><strong className="block truncate text-xs">{file.name}</strong><small className="block truncate text-[10px] text-muted-foreground">{file.mimeType}</small></span><button className="grid size-8 place-items-center rounded-full border-0 bg-transparent" type="button" aria-label={`Remove ${file.name}`} onClick={() => { onRemove(index) }}>×</button></span>
  ))}</div>
}


function runtimeLabel(adapter: AgentAdapterKind | undefined): string {
  if (adapter === 'codex') return 'Codex'
  return 'Hermes'
}

function waitingActivityText(adapter: AgentAdapterKind): string {
  return `Waiting for ${runtimeLabel(adapter)} activity…`
}

function conversationTitle(store: CommonspaceClientStore, ref: ConversationRef | null): { title: string; subtitle: string } {
  const bootstrap = store.getSnapshot().bootstrap
  if (ref === null || bootstrap === null) return { title: 'Commonspace', subtitle: 'Select a channel or agent' }
  if (ref.kind === 'dm') {
    const agent = bootstrap.agents.find(candidate => candidate.id === ref.id)
    return { title: agent?.displayName ?? ref.id, subtitle: `${runtimeLabel(agent?.adapter)} · ${agent?.model ?? 'default model'}` }
  }
  const channel = bootstrap.state.channels.find(candidate => candidate.id === ref.id)
  const members = (channel?.agentIds ?? []).map(id => bootstrap.agents.find(agent => agent.id === id)?.displayName ?? id)
  const roster = members.length === 0 ? 'No agents' : members.map(name => `@${name}`).join(' ')
  return { title: channel?.name ?? 'channel', subtitle: `Global Channel · ${roster}` }
}

function renderMessageText(message: CommonspaceMessage, bootstrap?: CommonspaceBootstrap) {
  return tagReferenceParts(message.text, bootstrap).map((part, index) => part.kind === 'text'
    ? <span key={`${message.id}-${String(index)}`}>{part.text}</span>
    : <mark key={`${message.id}-${String(index)}`} className="rounded-sm bg-muted px-1 font-semibold text-foreground">{part.text}</mark>)
}

function fileSizeLabel(size: number): string {
  if (size < 1_024) return `${String(size)} B`
  if (size < 1_024 * 1_024) return `${(size / 1_024).toFixed(1)} KB`
  return `${(size / (1_024 * 1_024)).toFixed(1)} MB`
}

function routingDurationLabel(durationMs: number | undefined): string | null {
  if (durationMs === undefined) return null
  if (durationMs < 1_000) return `routed in ${String(durationMs)}ms`
  return `routed in ${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)}s`
}

function conversationDateLabel(messages: readonly CommonspaceMessage[]): string | null {
  const timestamp = messages[0]?.createdAt
  if (timestamp === undefined) return null
  const date = new Date(timestamp)
  if (Number.isNaN(date.valueOf())) return null
  const today = new Date()
  const prefix = date.toDateString() === today.toDateString() ? 'Today' : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `${prefix} · ${date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}`
}

function RoutingAssignments({
  message,
  bootstrap,
  onReroute,
}: {
  message: CommonspaceMessage
  bootstrap: CommonspaceBootstrap | null | undefined
  onReroute: ((request: RerouteAssignmentRequest) => Promise<void>) | undefined
}) {
  const routing = message.routing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [agentId, setAgentId] = useState('')
  const [subRequest, setSubRequest] = useState('')
  const [submitting, setSubmitting] = useState(false)
  if (routing === undefined || routing.assignments.length === 0) return null
  const corrections = routing.corrections ?? []
  const supersededIds = new Set(corrections.map(correction => correction.fromAssignmentId))
  const correctedIds = new Set(corrections.map(correction => correction.toAssignmentId))
  const channelAgentIds = message.conversation.kind === 'channel'
    ? bootstrap?.state.channels.find(channel => channel.id === message.conversation.id)?.agentIds ?? []
    : []
  const rerouteAgents = (bootstrap?.agents ?? []).filter(agent => channelAgentIds.includes(agent.id))
  const beginReroute = (assignmentId: string) => {
    const assignment = routing.assignments.find(candidate => candidate.id === assignmentId)
    if (assignment === undefined) return
    setEditingId(assignment.id)
    setAgentId(assignment.agentId)
    setSubRequest(assignment.subRequest)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (editingId === null || agentId === '' || subRequest.trim() === '' || onReroute === undefined || submitting) return
    const assignment = routing.assignments.find(candidate => candidate.id === editingId)
    if (assignment === undefined) return
    setSubmitting(true)
    try {
      await onReroute({
        sourceMessageId: message.id,
        assignmentId: editingId,
        agentId,
        subRequest,
        projectIds: assignment.projectIds,
      })
      setEditingId(null)
    } catch {
      // Store exposes request failures through shared error state.
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <ul className="mt-2 grid gap-2" aria-label="Routing assignments">
      {routing.assignments.map((assignment) => {
        const agent = bootstrap?.agents.find(candidate => candidate.id === assignment.agentId)
        const projects = assignment.projectIds.flatMap(projectId => {
          const project = bootstrap?.state.projects.find(candidate => candidate.id === projectId)
          return project === undefined ? [] : [project.name]
        })
        const superseded = supersededIds.has(assignment.id)
        const corrected = correctedIds.has(assignment.id)
        const inferred = !corrected && assignment.projectIds.some(projectId =>
          (routing.inferredProjectIds ?? []).includes(projectId))
        return (
          <li key={assignment.id} className="relative rounded-sm border bg-background p-3 text-xs" data-status={superseded ? 'superseded' : 'current'}>
            <strong>@{agent?.displayName ?? assignment.agentId}{projects.length === 0 ? '' : ` · ${projects.join(', ')}`}{inferred ? ' · inferred' : ''}</strong>
            {superseded && <span className="ml-2 rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">Superseded</span>}
            {corrected && <span className="ml-2 rounded-full border px-2 py-0.5 font-mono text-[10px] text-primary">Correction</span>}
            <p className="mt-1 text-[13px]">{assignment.subRequest}</p>
            {!superseded && onReroute !== undefined && (
              <button
                type="button"
                className="mt-2 min-h-9 rounded-sm border bg-background px-3 text-xs hover:bg-muted"
                aria-label={`Reroute assignment for ${agent?.displayName ?? assignment.agentId}`}
                onClick={() => { beginReroute(assignment.id) }}
              >Reroute</button>
            )}
            {editingId === assignment.id && (
              <form className="mt-3 grid gap-2 rounded-sm border bg-muted p-3 [&_button]:min-h-9 [&_button]:rounded-sm [&_button]:border [&_button]:px-3 [&_label]:grid [&_label]:gap-1 [&_select]:min-h-10 [&_select]:rounded-sm [&_select]:border [&_select]:bg-background [&_select]:px-2 [&_textarea]:min-h-20 [&_textarea]:rounded-sm [&_textarea]:border [&_textarea]:bg-background [&_textarea]:p-2" aria-label="Reroute assignment" onSubmit={(event) => { void submit(event) }}>
                <label>Agent<select aria-label="Reroute agent" value={agentId} onChange={event => { setAgentId(event.target.value) }}>
                  {rerouteAgents.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.displayName}</option>)}
                </select></label>
                <label>Sub-request<textarea aria-label="Corrected sub-request" value={subRequest} onChange={event => { setSubRequest(event.target.value) }} /></label>
                <div>
                  <button type="submit" disabled={submitting || agentId === '' || subRequest.trim() === ''}>{submitting ? 'Sending…' : 'Send correction'}</button>
                  <button type="button" onClick={() => { setEditingId(null) }}>Cancel</button>
                </div>
              </form>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function MessageRow({
  message,
  elementId,
  bootstrap,
  compact = false,
  onReplyToAgent,
  onReroute,
  onPin,
  onEdit,
  onDelete,
  onOpenVersion,
  speech,
}: {
  message: CommonspaceMessage
  elementId?: string
  bootstrap?: CommonspaceBootstrap | null
  compact?: boolean
  onReplyToAgent?: (message: CommonspaceMessage) => void
  onReroute?: (request: RerouteAssignmentRequest) => Promise<void>
  onPin?: (message: CommonspaceMessage, attachmentId?: string) => Promise<void>
  onEdit?: (message: CommonspaceMessage, text: string) => Promise<void>
  onDelete?: (message: CommonspaceMessage) => Promise<void>
  onOpenVersion?: (messageId: string) => void
  speech: MessageSpeechControls
}) {
  const reading = speech.activeMessageId === message.id
  const supersedesMessageId = message.supersedesMessageId
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState(message.text)
  const [savingEdit, setSavingEdit] = useState(false)
  const submitEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (onEdit === undefined || editedText.trim() === '' || savingEdit) return
    setSavingEdit(true)
    try {
      await onEdit(message, editedText)
      setEditing(false)
    } finally {
      setSavingEdit(false)
    }
  }
  return (
    <article id={elementId} className={cn('mx-auto mb-6 grid w-full max-w-[780px] grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-md', compact && 'mb-3')} data-author={message.authorType}>
      <div className={cn('grid size-9 place-items-center rounded-md border bg-background font-mono text-xs font-semibold', message.authorType === 'agent' && 'text-primary', message.authorType === 'system' && 'bg-muted text-muted-foreground')} aria-hidden="true">{message.authorName.slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0">
        <header className="flex min-h-[22px] flex-wrap items-center gap-2 text-xs [&>strong]:text-sm">
          <strong>{message.authorName}</strong>
          <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          {message.authorType === 'agent' && onReplyToAgent !== undefined && (
            <button
              type="button"
              className="min-h-8 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Reply directly to ${message.authorName}`}
              onClick={() => { onReplyToAgent(message) }}
            ><span aria-hidden="true">↩</span> Reply</button>
          )}
          {onPin !== undefined && (
            <button
              type="button"
              className="min-h-8 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Pin message from ${message.authorName}`}
              onClick={() => { void onPin(message) }}
            >Pin</button>
          )}
          {message.authorType === 'user' && message.deletedAt === undefined && onEdit !== undefined && (
            <button type="button" className="min-h-8 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit message from ${message.authorName}`} onClick={() => {
              setEditedText(message.text)
              setEditing(true)
            }}>Edit</button>
          )}
          {message.deletedAt === undefined && onDelete !== undefined && (
            <button type="button" className="min-h-8 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-destructive/5 hover:text-destructive" aria-label={`Delete message from ${message.authorName}`} onClick={() => {
              if (window.confirm('Delete this delivered message content? The transcript marker and delivery history will remain.')) void onDelete(message)
            }}>Delete</button>
          )}
          {message.authorType === 'agent' && message.text.trim() !== '' && speech.supported && (
            <button
              type="button"
              className="ml-auto grid size-8 place-items-center rounded-sm border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={reading ? 'Stop reading aloud' : 'Read message aloud'}
              aria-pressed={reading}
              title={reading ? 'Stop reading aloud' : 'Read message aloud'}
              onClick={() => { speech.toggle(message.id, message.text) }}
            ><span aria-hidden="true">{reading ? '■' : '◖))'}</span></button>
          )}
        </header>
        {supersedesMessageId !== undefined && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Edited branch</span>
            {onOpenVersion !== undefined && <button type="button" aria-label="Open previous message version" onClick={() => { onOpenVersion(supersedesMessageId) }}>Previous version</button>}
          </div>
        )}
        {message.deletedAt !== undefined
          ? <p className="mt-2 rounded-sm border bg-muted p-2 text-xs text-muted-foreground" role="status">Message deleted · content was delivered at {new Date(message.createdAt).toLocaleString()}</p>
          : message.text !== '' && (message.authorType === 'agent'
          ? <Suspense fallback={messageMarkdownFallback}>
              <LazyMessageMarkdown text={message.text} />
            </Suspense>
          : <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{renderMessageText(message, bootstrap ?? undefined)}</p>)}
        {editing && (
          <form className="mt-3 grid gap-2 rounded-md border bg-muted p-3 [&_button]:min-h-9 [&_button]:rounded-sm [&_button]:border [&_button]:px-3 [&_label]:grid [&_label]:gap-1 [&_textarea]:min-h-24 [&_textarea]:rounded-sm [&_textarea]:border [&_textarea]:bg-background [&_textarea]:p-2" aria-label="Edit delivered message" onSubmit={(event) => { void submitEdit(event) }}>
            <label>Message<textarea aria-label="Edited message" value={editedText} onChange={event => { setEditedText(event.target.value) }} /></label>
            <div><button type="submit" disabled={savingEdit || editedText.trim() === ''}>{savingEdit ? 'Branching…' : 'Create branch'}</button><button type="button" onClick={() => { setEditing(false) }}>Cancel</button></div>
          </form>
        )}
        {message.routing !== undefined && (
          message.routing.status === 'pending'
            ? <div className="mt-2 text-xs text-muted-foreground" role="status" aria-label="Routing message">Routing…</div>
            : message.routing.status === 'failed'
              ? <div className="mt-2 rounded-sm border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive" role="alert">Routing failed · {message.routing.reason}{routingDurationLabel(message.routing.durationMs) === null ? '' : ` · ${routingDurationLabel(message.routing.durationMs)}`}</div>
              : <div className="mt-2 border-l-2 pl-2 text-xs text-muted-foreground" title={message.routing.reason}>
                  <span>{message.routing.source === 'ai' ? 'AI routed' : message.routing.source === 'explicit' ? 'Explicitly routed' : 'Local routing'} to {message.routing.agentIds.map((agentId) => {
                    const agent = bootstrap?.agents.find(candidate => candidate.id === agentId)
                    return `@${agent?.displayName ?? agentId}`
                  }).join(', ')} · {message.routing.reason}{routingDurationLabel(message.routing.durationMs) === null ? '' : ` · ${routingDurationLabel(message.routing.durationMs)}`}</span>
                  <RoutingAssignments message={message} bootstrap={bootstrap} onReroute={onReroute} />
                </div>
        )}
        {message.attachments !== undefined && message.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.attachments.map(attachment => (
              <figure key={attachment.id} className="relative overflow-hidden rounded-md border">
                <img
                  src={`/api/attachments/${encodeURIComponent(attachment.id)}`}
                  alt={attachment.name}
                  className="max-h-72 max-w-full object-contain"
                  loading="lazy"
                />
                {onPin !== undefined && <button type="button" aria-label={`Pin attachment ${attachment.name}`} onClick={() => { void onPin(message, attachment.id) }}>Pin</button>}
              </figure>
            ))}
          </div>
        )}
        {message.files !== undefined && message.files.length > 0 && (
          <div className="mt-3 grid gap-1" aria-label="Message files">
            {message.files.map(file => (
              <span key={file.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center rounded-sm border bg-muted px-3 text-xs">
                <a href={`/api/files/${encodeURIComponent(file.id)}`} download={file.name} aria-label={`Download ${file.name}`}><strong>{file.name}</strong><small>{file.mimeType} · {fileSizeLabel(file.size)}</small></a>
                {onPin !== undefined && <button type="button" aria-label={`Pin attachment ${file.name}`} onClick={() => { void onPin(message, file.id) }}>Pin</button>}
              </span>
            ))}
          </div>
        )}

        {message.authorType === 'agent' && message.trace !== undefined && <AgentTrace authorName={message.authorName} trace={message.trace} />}
        {message.authorType === 'agent' && message.projectId !== undefined && message.runAttribution !== undefined && <RunAttribution attribution={message.runAttribution} authorName={message.authorName} messageId={message.id} projectId={message.projectId} />}
      </div>
    </article>
  )
}

function suggestionLabel(suggestion: TagSuggestion): string {
  if (suggestion.kind === 'agent') return `Agent · ${suggestion.label}${suggestion.channelMembership === 'outside' ? ' · will be added' : ''}`
  if (suggestion.kind === 'project') return `Project · ${suggestion.label}`
  return `Channel · ${suggestion.label}`
}

interface SuggestionMenuProps {
  id: string
  selectedSuggestion: number
  slashSuggestions: ReturnType<typeof slashCommandSuggestions>
  referenceSuggestions: TagSuggestion[]
  onSelectSlash: (name: string) => void
  onSelectTag: (suggestion: TagSuggestion) => void
}

function SuggestionMenu({
  id,
  selectedSuggestion,
  slashSuggestions,
  referenceSuggestions,
  onSelectSlash,
  onSelectTag,
}: SuggestionMenuProps) {
  return (
    <div id={id} className="absolute right-0 bottom-full left-0 z-20 mb-2 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg" role="listbox" aria-label={slashSuggestions.length > 0 ? 'Slash commands' : 'Tag suggestions'}>
      {slashSuggestions.map((command, index) => (
        <button
          key={command.id}
          id={`${id}-option-${String(index)}`}
          type="button"
          role="option"
          aria-selected={index === selectedSuggestion}
          className={cn('grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-sm px-3 text-left text-xs hover:bg-muted', index === selectedSuggestion && 'bg-muted')}
          onMouseDown={event => { event.preventDefault(); onSelectSlash(command.name) }}
        ><strong>{command.name}</strong><span>{command.description}</span></button>
      ))}
      {referenceSuggestions.map((suggestion, index) => {
        const previousMembership = referenceSuggestions[index - 1]?.channelMembership
        const showMembershipHeading = suggestion.channelMembership !== undefined && suggestion.channelMembership !== previousMembership
        return (
          <Fragment key={`${suggestion.kind}-${suggestion.id}`}>
            {showMembershipHeading && (
              <div className="border-t px-3 py-2 text-[10px] font-semibold tracking-[0.05em] text-muted-foreground uppercase" role="presentation">
                {suggestion.channelMembership === 'member' ? 'In this channel' : 'Not in this channel · tagging adds them'}
              </div>
            )}
            <button
              id={`${id}-option-${String(index + slashSuggestions.length)}`}
              type="button"
              role="option"
              aria-selected={index + slashSuggestions.length === selectedSuggestion}
              className={cn('grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-sm px-3 text-left text-xs hover:bg-muted', index + slashSuggestions.length === selectedSuggestion && 'bg-muted')}
              onMouseDown={event => { event.preventDefault(); onSelectTag(suggestion) }}
            ><strong>{suggestion.token}</strong><span>{suggestionLabel(suggestion)}</span></button>
          </Fragment>
        )
      })}
    </div>
  )
}


function liveActivitiesFor(
  activities: readonly CommonspaceLiveAgentActivity[] | undefined,
  conversation: ConversationRef | null,
  threadId: string | undefined,
): CommonspaceLiveAgentActivity[] {
  if (conversation === null) return []
  return (activities ?? []).filter(activity =>
    activity.conversation.kind === conversation.kind &&
    activity.conversation.id === conversation.id &&
    activity.threadId === threadId)
}

function latestTraceEntry(entries: readonly CommonspaceTraceEntry[]): CommonspaceTraceEntry | undefined {
  return entries.reduce<CommonspaceTraceEntry | undefined>((latest, entry) =>
    latest === undefined || entry.updatedAt > latest.updatedAt ? entry : latest, undefined)
}

function liveActivityDetail(activity: CommonspaceLiveAgentActivity): { kind: string; text: string } {
  const entry = latestTraceEntry(activity.entries)
  if (entry === undefined) return { kind: 'Waiting', text: waitingActivityText(activity.adapter) }
  if (entry.type === 'reasoning') return { kind: 'Reasoning', text: entry.text }
  if (entry.type === 'plan') {
    const step = entry.steps.findLast(candidate => candidate.status === 'in_progress') ?? entry.steps.at(-1)
    return { kind: 'Plan', text: step?.text ?? entry.markdown ?? 'Updating plan…' }
  }
  if (entry.type === 'tool') return { kind: entry.status === 'in_progress' ? 'Tool running' : 'Tool', text: entry.title }
  return { kind: 'Context', text: `${entry.usedTokens.toLocaleString()} / ${entry.contextWindow.toLocaleString()} tokens` }
}

function LiveAgentActivity({
  activities,
  fallbackAgents,
  phase,
  onStop,
}: {
  activities: readonly CommonspaceLiveAgentActivity[]
  fallbackAgents: readonly CommonspaceAgentProfile[]
  phase: 'queued' | 'running'
  onStop: (activity: CommonspaceLiveAgentActivity) => void
}) {
  const panelIdPrefix = useId()
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  if (activities.length === 0 && fallbackAgents.length === 0) return null
  const expandedActivityId = activities.some(activity => activity.id === selectedActivityId)
    ? selectedActivityId
    : null
  return (
    <div className="mx-auto mb-3 grid w-[min(760px,calc(100%-48px))] gap-2" role="status" aria-label="Live agent activity" aria-live="polite">
      {activities.length > 0
        ? activities.map((activity, index) => {
            const detail = liveActivityDetail(activity)
            const expanded = activity.id === expandedActivityId
            const panelId = `${panelIdPrefix}-${String(index)}`
            return (
              <article key={activity.id} className={cn('overflow-hidden rounded-md border bg-background', expanded && 'border-primary/30 shadow-[inset_2px_0_0_var(--primary)]')} data-runtime={activity.adapter}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
                  <button
                    type="button"
                    className="grid min-h-[62px] w-full grid-cols-[34px_minmax(0,1fr)_20px] items-center gap-2.5 border-0 bg-transparent px-3 text-left hover:bg-muted"
                    aria-label={`${activity.agentName} activity`}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => { setSelectedActivityId(expanded ? null : activity.id) }}
                  >
                    <span
                      className="grid size-[34px] place-items-center rounded-full border border-primary/30 bg-primary text-xs font-semibold text-primary-foreground"
                      aria-label={`${activity.agentName} is responding`}
                    >{activity.agentName.slice(0, 1).toLocaleUpperCase()}</span>
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-2 text-xs"><strong>{activity.agentName}</strong><span className="text-muted-foreground">{runtimeLabel(activity.adapter)} · {detail.kind}</span></span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{detail.text}</span>
                    </span>
                    <span className={cn('transition-transform', expanded && 'rotate-180')} aria-hidden="true">⌄</span>
                  </button>
                  <button
                    type="button"
                    className="mr-2 min-h-11 rounded-sm border border-destructive/40 bg-background px-3 text-xs font-semibold text-destructive hover:bg-destructive/5"
                    aria-label={`Stop ${activity.agentName}`}
                    onClick={() => { onStop(activity) }}
                  ><span aria-hidden="true">■</span> Stop</button>
                </div>
                {expanded && (
                  <section id={panelId} className="border-t bg-muted p-3" role="region" aria-label={`${activity.agentName} live activity`}>
                    {activity.entries.length > 0
                      ? <AgentTraceTimeline entries={activity.entries} />
                      : <p className="text-xs text-muted-foreground">{waitingActivityText(activity.adapter)}</p>}
                  </section>
                )}
              </article>
            )
          })
        : fallbackAgents.map(agent => (
            <div key={agent.id} className="overflow-hidden rounded-md border bg-background" data-runtime={agent.adapter}>
              <div className="grid min-h-[62px] grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 px-3">
                <span
                  className="grid size-[34px] place-items-center rounded-full border border-primary/30 bg-primary text-xs font-semibold text-primary-foreground"
                  aria-label={`${agent.displayName} is ${phase === 'queued' ? 'queued' : 'responding'}`}
                >{agent.displayName.slice(0, 1).toLocaleUpperCase()}</span>
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-2 text-xs"><strong>{agent.displayName}</strong><span className="text-muted-foreground">{runtimeLabel(agent.adapter)} · {phase === 'queued' ? 'Queued' : 'Waiting'}</span></span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{phase === 'queued' ? 'Queued for provider run…' : waitingActivityText(agent.adapter)}</span>
                </span>
              </div>
            </div>
          ))}
    </div>
  )
}

function ThreadAgentActivity({
  thread,
  agents,
  respondingAgentIds = thread.agentIds,
}: {
  thread: CommonspaceThread
  agents: readonly CommonspaceAgentProfile[]
  respondingAgentIds?: readonly string[]
}) {
  return (
    <span className="inline-flex items-center pl-1">
      {respondingAgentIds.map((agentId, index) => {
        const agent = agents.find(candidate => candidate.id === agentId)
        const name = agent?.displayName ?? agentId
        return (
          <span
            key={agentId}
            className="-ml-1 grid size-6 place-items-center rounded-full border border-background bg-primary font-mono text-[10px] text-primary-foreground first:ml-0"
            data-runtime={agent?.adapter}
            aria-label={`${name} is responding`}
            style={{ zIndex: respondingAgentIds.length - index }}
          >{name.slice(0, 1).toLocaleUpperCase()}</span>
        )
      })}
    </span>
  )
}

function ThreadReplyAgents({
  replies,
  agents,
}: {
  replies: readonly CommonspaceMessage[]
  agents: readonly CommonspaceAgentProfile[]
}) {
  const replyingAgents = [...new Map(
    replies
      .filter(reply => reply.authorType === 'agent')
      .map(reply => [reply.authorId, reply] as const),
  ).values()]
  if (replyingAgents.length === 0) return null
  return (
    <span className="inline-flex items-center pl-1">
      {replyingAgents.map(reply => (
        <span
          key={reply.authorId}
          className="-ml-1 grid size-6 place-items-center rounded-full border border-background bg-muted font-mono text-[10px] first:ml-0"
          data-runtime={agents.find(agent => agent.id === reply.authorId)?.adapter}
          aria-label={`${reply.authorName} replied`}
        >{reply.authorName.slice(0, 1).toLocaleUpperCase()}</span>
      ))}
    </span>
  )
}

function PermissionRequests({
  permissions,
  agents,
  onRespond,
}: {
  permissions: readonly CommonspacePermissionRequest[]
  agents: readonly CommonspaceAgentProfile[]
  onRespond: (permissionId: string, optionId: string) => Promise<void>
}) {
  return <>{permissions.map((permission) => {
    const agentName = agents.find(agent => agent.id === permission.agentId)?.displayName ?? permission.agentId
    return (
      <section key={permission.id} className="mx-auto mb-3 w-[min(760px,calc(100%-48px))] rounded-md border border-[color-mix(in_oklch,var(--status-warning)_45%,var(--border))] bg-[color-mix(in_oklch,var(--status-warning)_7%,var(--background))] p-4" role="region" aria-label={`Permission request from ${agentName}`}>
        <header className="flex items-center justify-between gap-2 text-xs"><strong>{agentName} needs permission</strong><span className="text-muted-foreground">{permission.kind ?? 'native request'}</span></header>
        <p className="mt-2 text-[13px]">{permission.title}</p>
        <div className="mt-3 flex flex-wrap gap-2">{permission.options.map(option => (
          <button className="min-h-10 rounded-sm border bg-background px-3 text-xs font-semibold hover:bg-muted" key={option.optionId} type="button" data-kind={option.kind} onClick={() => { void onRespond(permission.id, option.optionId) }}>{option.name}</button>
        ))}</div>
      </section>
    )
  })}</>
}

export function CommonspaceConversation({ store, targetMessageId = null, onTargetMessageHandled, settingsRequest = null }: CommonspaceConversationProps) {
  const suggestionListId = useId()
  const threadSuggestionListId = useId()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const speech = useMessageSpeech(snapshot.activeConversation === null
    ? null
    : `${snapshot.activeConversation.kind}:${snapshot.activeConversation.id}`)
  const [draft, setDraft] = useState('')
  const [activeDelivery, setActiveDelivery] = useState<'queue' | 'steer' | 'stop-and-send'>('queue')
  const [threadDelivery, setThreadDelivery] = useState<'queue' | 'steer' | 'stop-and-send'>('queue')
  const [threadDraft, setThreadDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<SendImageAttachment[]>([])
  const [pendingThreadImages, setPendingThreadImages] = useState<SendImageAttachment[]>([])
  const [pendingFiles, setPendingFiles] = useState<SendFileAttachment[]>([])
  const [pendingThreadFiles, setPendingThreadFiles] = useState<SendFileAttachment[]>([])

  const [threadReplyTarget, setThreadReplyTarget] = useState<{ agentId: string; agentName: string } | null>(null)
  const [threadContextOpen, setThreadContextOpen] = useState(false)
  const [threadContextSummary, setThreadContextSummary] = useState('')
  const [threadContextDecisions, setThreadContextDecisions] = useState('')
  const [threadContextQuestions, setThreadContextQuestions] = useState('')
  const [threadContextSaving, setThreadContextSaving] = useState(false)
  const [threadContextCompacting, setThreadContextCompacting] = useState(false)
  const [threadPinNote, setThreadPinNote] = useState('')
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [selectedThreadSuggestion, setSelectedThreadSuggestion] = useState(0)
  const [commandFeedback, setCommandFeedback] = useState<CommandFeedback | null>(null)
  const [focusedRootMessageId, setFocusedRootMessageId] = useState<string | null>(targetMessageId ?? null)
  const [threadWidth, setThreadWidth] = useState(50)
  const [resizingThread, setResizingThread] = useState(false)
  const [contextSettingsOpen, setContextSettingsOpen] = useState(false)
  const conversationLayout = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const threadMessages = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const threadComposer = useRef<HTMLTextAreaElement>(null)
  const suppressThreadAutoScroll = useRef(false)
  const bootstrap = snapshot.bootstrap
  const messages = store.messages()
  const unreadMessageIds = new Set(bootstrap === null
    ? []
    : deriveCommonspaceInboxItems(bootstrap.state).filter(item => item.unread).map(item => item.messageId))
  const heading = conversationTitle(store, snapshot.activeConversation)
  const isChannel = snapshot.activeConversation?.kind === 'channel'
  const activeChannel = isChannel && bootstrap !== null
    ? bootstrap.state.channels.find(channel => channel.id === snapshot.activeConversation?.id)
    : undefined
  const slashSuggestions = snapshot.activeConversation === null || pendingImages.length > 0 || pendingFiles.length > 0 ? [] : slashCommandSuggestions(draft, snapshot.activeConversation.kind)
  const resolvedDraftCommand = snapshot.activeConversation === null || pendingImages.length > 0 || pendingFiles.length > 0 ? null : resolveSlashCommand(draft, snapshot.activeConversation.kind)
  const referenceSuggestions = bootstrap === null || draft.startsWith('/') ? [] : tagSuggestions(draft, bootstrap, activeChannel?.agentIds)
  const suggestionCount = slashSuggestions.length + referenceSuggestions.length
  const activeSuggestionId = suggestionCount > 0 ? `${suggestionListId}-option-${String(selectedSuggestion)}` : undefined
  const channelThreads = isChannel && bootstrap !== null
    ? bootstrap.state.threads.filter(thread => thread.channelId === snapshot.activeConversation?.id)
    : []
  const activeThread = channelThreads.find(thread => thread.id === snapshot.activeThreadId)
  const activeThreadProject = activeThread === undefined || bootstrap === null ? undefined : bootstrap.state.projects.find(project => project.id === activeThread.projectId)
  const sessions = bootstrap === null ? [] : deriveCommonspaceSessions(bootstrap.state, bootstrap.liveActivities ?? [])
  const activeThreadSessions = activeThread === undefined ? [] : sessions.filter(session => session.threadId === activeThread.id)
  const threadFollowing = activeThreadSessions.some(session => session.followed)

  const threadSlashSuggestions = activeThread === undefined || pendingThreadImages.length > 0 || pendingThreadFiles.length > 0 ? [] : slashCommandSuggestions(threadDraft, 'channel')
  const resolvedThreadCommand = activeThread === undefined || pendingThreadImages.length > 0 || pendingThreadFiles.length > 0 ? null : resolveSlashCommand(threadDraft, 'channel')
  const threadReferenceSuggestions = activeThread === undefined || bootstrap === null || threadDraft.startsWith('/') ? [] : tagSuggestions(threadDraft, bootstrap, activeChannel?.agentIds)
  const threadSuggestionCount = threadSlashSuggestions.length + threadReferenceSuggestions.length
  const activeThreadSuggestionId = threadSuggestionCount > 0 ? `${threadSuggestionListId}-option-${String(selectedThreadSuggestion)}` : undefined
  const roots = isChannel
    ? messages.filter(message => message.authorType === 'user' && message.parentMessageId === undefined)
    : messages
  const conversationUnreadMessages = messages.filter(message => unreadMessageIds.has(message.id))
  const firstUnreadRootId = isChannel
    ? roots.find(root => unreadMessageIds.has(root.id) || messages.some(message => message.parentMessageId === root.id && unreadMessageIds.has(message.id)))?.id
    : undefined
  const pendingDirectMessage = isChannel
    ? undefined
    : messages.findLast(message => message.authorType === 'user' && (message.replyStatus === 'queued' || message.replyStatus === 'running'))
  const directMessagePhase = pendingDirectMessage?.replyStatus === 'queued' || pendingDirectMessage?.replyStatus === 'running'
    ? pendingDirectMessage.replyStatus
    : null
  const directMessageActivities = liveActivitiesFor(bootstrap?.liveActivities, snapshot.activeConversation, undefined)
  const directMessageFollowups = snapshot.activeConversation?.kind === 'dm'
    ? (bootstrap?.queuedFollowups ?? []).filter(item => item.conversation.kind === 'dm' && item.conversation.id === snapshot.activeConversation?.id)
    : []
  const directMessagePermissions = snapshot.activeConversation?.kind === 'dm'
    ? (bootstrap?.state.permissions ?? []).filter(permission => permission.status === 'pending' && permission.conversation.kind === 'dm' && permission.conversation.id === snapshot.activeConversation?.id)
    : []
  const directMessageAgents = snapshot.activeConversation?.kind === 'dm' && bootstrap !== null
    ? bootstrap.agents.filter(agent => agent.id === snapshot.activeConversation?.id)
    : []
  const activeRoot = activeThread === undefined ? undefined : messages.find(message => message.id === activeThread.rootMessageId)
  const replies = activeThread === undefined
    ? []
    : messages.filter(message => message.threadId === activeThread.id && message.parentMessageId === activeThread.rootMessageId)
  const activeThreadActivities = liveActivitiesFor(bootstrap?.liveActivities, snapshot.activeConversation, activeThread?.id)
  const activeThreadFollowups = activeThread === undefined
    ? []
    : (bootstrap?.queuedFollowups ?? []).filter(item => item.threadId === activeThread.id)
  const activeThreadPermissions = activeThread === undefined
    ? []
    : (bootstrap?.state.permissions ?? []).filter(permission => permission.status === 'pending' && permission.threadId === activeThread.id)
  const activeThreadPins = activeThread === undefined || bootstrap === null
    ? []
    : (bootstrap.state.pins ?? []).filter(pin => pin.removedAt === null && (
        (pin.scope.kind === 'thread' && pin.scope.id === activeThread.id) ||
        (pin.scope.kind === 'channel' && pin.scope.id === activeThread.channelId)))
  const rootIsCommand = pendingImages.length === 0 && pendingFiles.length === 0 && draft.startsWith('/')
  const threadIsCommand = pendingThreadImages.length === 0 && pendingThreadFiles.length === 0 && threadDraft.startsWith('/')

  const scrollThreadToBottom = () => {
    const messagesViewport = threadMessages.current
    if (messagesViewport === null) return
    const bottomOffset = messagesViewport.scrollHeight
    messagesViewport.scrollTop = bottomOffset
    messagesViewport.scrollTo?.({ top: bottomOffset, behavior: 'auto' })
  }

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages.length, snapshot.sending, directMessagePhase])
  useEffect(() => {
    if (targetMessageId == null) return
    setFocusedRootMessageId(targetMessageId)
    const target = document.getElementById(`commonspace-message-${targetMessageId}`)
    if (target === null) return
    suppressThreadAutoScroll.current = true
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    onTargetMessageHandled?.()
  }, [messages.length, onTargetMessageHandled, snapshot.activeThreadId, targetMessageId])
  useEffect(() => {
    composer.current?.focus()
    setCommandFeedback(null)
    setPendingImages([])
    setPendingFiles([])
    setContextSettingsOpen(false)
  }, [snapshot.activeConversation?.id, snapshot.activeConversation?.kind])
  useEffect(() => {
    const conversation = snapshot.activeConversation
    if (settingsRequest === null || conversation === null) return
    const matches = settingsRequest.kind === 'channel'
      ? conversation.kind === 'channel' && conversation.id === settingsRequest.id
      : conversation.kind === 'dm' && conversation.id === settingsRequest.id
    if (!matches) return
    store.selectThread(null)
    setContextSettingsOpen(true)
  }, [settingsRequest?.token])
  useEffect(() => {
    if (activeThread !== undefined) setContextSettingsOpen(false)
  }, [activeThread?.id])
  useEffect(() => {
    setThreadReplyTarget(null)
    setPendingThreadImages([])
    setPendingThreadFiles([])
    setThreadContextOpen(false)
    setThreadPinNote('')
  }, [snapshot.activeConversation?.id, snapshot.activeConversation?.kind, snapshot.activeThreadId])
  useEffect(() => {
    const memory = activeThread?.context?.memory
    if (memory === undefined) return
    setThreadContextSummary(memory.summary)
    setThreadContextDecisions(memory.decisions.join('\n'))
    setThreadContextQuestions(memory.openQuestions.join('\n'))
  }, [activeThread?.context?.memory.updatedAt, activeThread?.id])
  useEffect(() => {
    if (snapshot.activeThreadId === null) return
    if (suppressThreadAutoScroll.current) {
      suppressThreadAutoScroll.current = false
      return
    }
    scrollThreadToBottom()
  }, [replies.length, snapshot.activeThreadId])
  useEffect(() => {
    if (!resizingThread) return

    const resize = (event: PointerEvent) => {
      const bounds = conversationLayout.current?.getBoundingClientRect()
      if (bounds === undefined || bounds.width === 0) return
      const nextWidth = ((bounds.right - event.clientX) / bounds.width) * 100
      setThreadWidth(Math.min(75, Math.max(25, Math.round(nextWidth))))
    }
    const stopResizing = () => { setResizingThread(false) }
    window.addEventListener('pointermove', resize)
    window.addEventListener('pointerup', stopResizing, { once: true })
    return () => {
      window.removeEventListener('pointermove', resize)
      window.removeEventListener('pointerup', stopResizing)
    }
  }, [resizingThread])

  const attachPastedImages = async (
    files: readonly File[],
    setImages: Dispatch<SetStateAction<SendImageAttachment[]>>,
  ) => {
    try {
      const images = await Promise.all(files.slice(0, MAX_PASTED_IMAGES).map(readPastedImage))
      setImages(current => [...current, ...images].slice(0, MAX_PASTED_IMAGES))
      setCommandFeedback(null)
    } catch (error) {
      setCommandFeedback({ tone: 'error', title: 'Could not attach image', body: error instanceof Error ? error.message : String(error) })
    }
  }

  const attachFiles = async (files: readonly File[], setFiles: Dispatch<SetStateAction<SendFileAttachment[]>>) => {
    try {
      const attached = await Promise.all(files.slice(0, MAX_ATTACHED_FILES).map(readAttachedFile))
      setFiles(current => [...current, ...attached].slice(0, MAX_ATTACHED_FILES))
      setCommandFeedback(null)
    } catch (error) {
      setCommandFeedback({ tone: 'error', title: 'Could not attach file', body: error instanceof Error ? error.message : String(error) })
    }
  }

  const selectSuggestion = (suggestion: TagSuggestion) => {
    setDraft(current => insertTag(current, suggestion.token))
    setSelectedSuggestion(0)
  }

  const selectSlashSuggestion = (name: string) => {
    setDraft(name)
    setSelectedSuggestion(0)
  }

  const selectThreadSuggestion = (suggestion: TagSuggestion) => {
    setThreadDraft(current => insertTag(current, suggestion.token))
    setSelectedThreadSuggestion(0)
  }

  const selectThreadSlashSuggestion = (name: string) => {
    setThreadDraft(name)
    setSelectedThreadSuggestion(0)
  }

  const resetDirectMessage = async () => {
    const conversation = snapshot.activeConversation
    if (conversation?.kind !== 'dm') return
    setCommandFeedback({ tone: 'info', title: 'Starting a new chat…', body: 'Clearing this transcript and rotating the agent session.' })
    try {
      await store.mutate({ action: 'reset-dm', agentId: conversation.id })
      setCommandFeedback({ tone: 'success', title: 'New chat started', body: 'Earlier messages remain visible, and your next message starts with fresh agent context.' })
      composer.current?.focus()
    } catch (error) {
      setCommandFeedback({ tone: 'error', title: 'Could not start a new chat', body: error instanceof Error ? error.message : String(error) })
    }
  }

  const executeSlashCommand = async (text: string, threadId?: string) => {
    const conversation = snapshot.activeConversation
    if (conversation === null || bootstrap === null) return
    const resolved = resolveSlashCommand(text, conversation.kind)
    if (resolved === null) {
      const token = text.split(/\s+/, 1)[0] ?? text
      setCommandFeedback({ tone: 'error', title: 'Unknown command', body: `${token} is not available here. Type /help to see Commonspace commands.` })
      return
    }

    if (resolved.command.id === 'help') {
      const commands = slashCommandSuggestions('/', conversation.kind)
      setCommandFeedback({
        tone: 'info',
        title: 'Commonspace commands',
        body: commands.map(command => `${command.name} — ${command.description}`).join('\n'),
      })
      return
    }

    if (resolved.command.id === 'stop') {
      const matchingActivities = (bootstrap.liveActivities ?? []).filter(activity =>
        activity.conversation.kind === conversation.kind && activity.conversation.id === conversation.id &&
        (threadId === undefined || activity.threadId === threadId))
      const targetMessageId = matchingActivities.at(-1)?.sourceMessageId ??
        [...messages].reverse().find(message => message.authorType === 'user' &&
          (threadId === undefined
            ? conversation.kind === 'dm' || message.parentMessageId === undefined
            : message.threadId === threadId))?.id
      if (targetMessageId === undefined) {
        setCommandFeedback({ tone: 'info', title: 'Nothing to stop', body: 'No agent is currently working in this conversation.' })
        return
      }
      try {
        const stopped = await store.stopAgentRuns(targetMessageId)
        setCommandFeedback(stopped.length === 0
          ? { tone: 'info', title: 'Nothing to stop', body: 'That agent work has already finished.' }
          : { tone: 'success', title: 'Agent work stopped', body: `Stopped ${stopped.length === 1 ? stopped[0] : `${String(stopped.length)} agents`}.` })
      } catch (error) {
        setCommandFeedback({ tone: 'error', title: 'Could not stop agent work', body: error instanceof Error ? error.message : String(error) })
      }
      return
    }

    if (resolved.command.id === 'status') {
      if (conversation.kind === 'dm') {
        const agent = bootstrap.agents.find(candidate => candidate.id === conversation.id)
        const project = bootstrap.state.projects.find(candidate => candidate.id === snapshot.activeProjectId)
        setCommandFeedback({
          tone: 'info',
          title: 'Direct-message status',
          body: `${agent?.displayName ?? conversation.id} · ${runtimeLabel(agent?.adapter)} · ${agent?.model ?? 'default model'} · ${agent?.status ?? 'unknown'}${project === undefined ? '' : `\nProject context: ${project.name}`}`,
        })
      } else {
        const channel = bootstrap.state.channels.find(candidate => candidate.id === conversation.id)
        const project = bootstrap.state.projects.find(candidate => candidate.id === snapshot.activeProjectId)
        setCommandFeedback({
          tone: 'info',
          title: 'Channel status',
          body: `${heading.title} · Global Channel · ${channel?.agentIds.length ?? 0} agents${project === undefined ? '' : `\nNext thread project context: ${project.name}`}\nModel: ${channel?.settings.model ?? bootstrap.state.defaults.model ?? 'agent defaults'} · Reasoning: ${channel?.settings.reasoning ?? bootstrap.state.defaults.reasoning}`,
        })
      }
      return
    }

    if (resolved.command.id === 'agents') {
      setCommandFeedback({
        tone: 'info',
        title: 'Available agents',
        body: bootstrap.agents.length === 0
          ? 'No agents are configured.'
          : bootstrap.agents.map(agent => `${agent.displayName} · ${runtimeLabel(agent.adapter)} · ${agent.model ?? 'default model'}`).join('\n'),
      })
      return
    }

    if (resolved.command.id === 'retry') {
      const previous = [...messages].reverse().find(message => message.authorType === 'user' &&
        (threadId === undefined
          ? conversation.kind === 'dm' || message.parentMessageId === undefined
          : message.threadId === threadId))
      if (previous === undefined) {
        setCommandFeedback({ tone: 'error', title: 'Nothing to retry', body: 'Send a message first, then use /retry.' })
        return
      }
      setCommandFeedback({ tone: 'info', title: 'Retrying message', body: previous.text })
      try {
        if (threadId === undefined) await store.send(previous.text, undefined, [], undefined, referencedProjectIds(previous))
        else await store.send(previous.text, threadId)
      } catch (error) {
        setCommandFeedback({ tone: 'error', title: 'Retry failed', body: error instanceof Error ? error.message : String(error) })
      }
      return
    }

    const skipConfirmation = ['now', '--yes', '-y'].includes(resolved.args.toLocaleLowerCase())
    if (skipConfirmation) {
      await resetDirectMessage()
    } else {
      setCommandFeedback({
        tone: 'info',
        title: 'Start a new chat?',
        body: 'This keeps earlier messages visible and starts a fresh native session for this agent.',
        action: 'reset-dm',
      })
    }
  }

  const stopActivity = async (activity: CommonspaceLiveAgentActivity) => {
    try {
      const stopped = await store.stopAgentRuns(activity.sourceMessageId, activity.agentId)
      setCommandFeedback(stopped.length === 0
        ? { tone: 'info', title: 'Nothing to stop', body: `${activity.agentName} has already finished.` }
        : { tone: 'success', title: `${activity.agentName} stopped`, body: 'No further work from this run will be posted.' })
    } catch (error) {
      setCommandFeedback({ tone: 'error', title: `Could not stop ${activity.agentName}`, body: error instanceof Error ? error.message : String(error) })
    }
  }

  const sendRoot = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (text === '' && pendingImages.length === 0 && pendingFiles.length === 0) return
    const attachments = pendingImages
    const files = pendingFiles
    setDraft('')
    if (rootIsCommand) {
      await executeSlashCommand(text)
      return
    }
    setPendingImages([])
    setPendingFiles([])
    setCommandFeedback(null)
    try {
      if (files.length > 0) await store.send(text, undefined, attachments, directMessageActivities.length > 0 && !isChannel ? activeDelivery : undefined, undefined, files)
      else if (directMessageActivities.length > 0 && !isChannel) await store.send(text, undefined, attachments, activeDelivery)
      else if (attachments.length > 0) await store.send(text, undefined, attachments)
      else await store.send(text)
    } catch {
      setDraft(text)
      setPendingImages(attachments)
      setPendingFiles(files)
    }
  }

  const sendThreadReply = async (event: FormEvent) => {
    event.preventDefault()
    const text = threadDraft.trim()
    if ((text === '' && pendingThreadImages.length === 0 && pendingThreadFiles.length === 0) || activeThread === undefined) return
    const attachments = pendingThreadImages
    const files = pendingThreadFiles
    setThreadDraft('')
    if (threadIsCommand) {
      setThreadReplyTarget(null)
      await executeSlashCommand(text, activeThread.id)
      return
    }
    setPendingThreadImages([])
    setPendingThreadFiles([])
    setCommandFeedback(null)
    scrollThreadToBottom()
    try {
      if (threadReplyTarget === null) {
        if (files.length > 0) await store.send(text, activeThread.id, attachments, activeThreadActivities.length > 0 ? threadDelivery : undefined, undefined, files)
        else if (activeThreadActivities.length > 0) await store.send(text, activeThread.id, attachments, threadDelivery)
        else await store.send(text, activeThread.id, attachments)
      } else {
        if (files.length > 0) await store.sendDirectReply(text, activeThread.id, threadReplyTarget.agentId, attachments, undefined, files)
        else await store.sendDirectReply(text, activeThread.id, threadReplyTarget.agentId, attachments)
      }
      setThreadReplyTarget(null)
    } catch {
      setThreadDraft(text)
      setPendingThreadImages(attachments)
      setPendingThreadFiles(files)
    }
  }

  const replyDirectlyToAgent = (message: CommonspaceMessage) => {
    setThreadReplyTarget({ agentId: message.authorId, agentName: message.authorName })
    threadComposer.current?.focus()
    scrollThreadToBottom()
  }

  const saveThreadContext = async (event: FormEvent) => {
    event.preventDefault()
    if (activeThread === undefined || threadContextSaving) return
    setThreadContextSaving(true)
    try {
      await store.updateThreadContext(activeThread.id, {
        summary: threadContextSummary,
        decisions: threadContextDecisions.split('\n').map(value => value.trim()).filter(Boolean),
        openQuestions: threadContextQuestions.split('\n').map(value => value.trim()).filter(Boolean),
      })
    } finally {
      setThreadContextSaving(false)
    }
  }

  const compactActiveThreadContext = async () => {
    if (activeThread === undefined || threadContextCompacting) return
    setThreadContextCompacting(true)
    try {
      await store.compactThreadContext(activeThread.id)
    } finally {
      setThreadContextCompacting(false)
    }
  }

  const addThreadNotePin = async (event: FormEvent) => {
    event.preventDefault()
    const note = threadPinNote.trim()
    if (activeThread === undefined || note === '') return
    await store.addPin({ scope: { kind: 'thread', id: activeThread.id }, kind: 'note', note })
    setThreadPinNote('')
  }

  const pinThreadMessage = async (message: CommonspaceMessage, attachmentId?: string) => {
    if (activeThread === undefined) return
    await store.addPin(attachmentId === undefined
      ? { scope: { kind: 'thread', id: activeThread.id }, kind: 'message', messageId: message.id }
      : { scope: { kind: 'thread', id: activeThread.id }, kind: 'attachment', messageId: message.id, attachmentId })
  }

  const editDeliveredMessage = async (message: CommonspaceMessage, text: string) => {
    await store.editMessage(message.id, { text })
  }

  const deleteDeliveredMessage = async (message: CommonspaceMessage) => {
    await store.deleteMessage(message.id)
  }

  const openMessageVersion = (messageId: string) => {
    const version = messages.find(message => message.id === messageId)
    if (version?.threadId !== undefined) store.selectThread(version.threadId)
    setFocusedRootMessageId(version?.parentMessageId ?? version?.id ?? messageId)
  }
  const markConversationRead = () => {
    for (const message of conversationUnreadMessages) {
      void store.mutate({ action: 'mark-inbox-item-read', messageId: message.id })
    }
  }
  const toggleThreadFollowing = () => {
    const followed = !threadFollowing
    for (const session of activeThreadSessions) {
      void store.mutate({ action: 'set-session-followed', sessionId: session.id, followed })
    }
  }
  const nextUnreadMessage = messages.find(message => unreadMessageIds.has(message.id))
  const dateLabel = conversationDateLabel(roots)

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground" aria-label="Commonspace conversation">
      <WorkspaceHeader title={heading.title} subtitle={heading.subtitle} mark={snapshot.activeConversation === null ? '✦' : isChannel ? '#' : '@'} actions={<div className="flex items-center gap-1">{nextUnreadMessage !== undefined && <button type="button" className="min-h-11 rounded-sm border-0 bg-transparent px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Jump to next unread message" onClick={() => { openMessageVersion(nextUnreadMessage.id) }}>Next unread</button>}{snapshot.activeConversation !== null && <button type="button" className="grid size-11 place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground" aria-label={isChannel ? 'Open channel settings' : 'Open agent profile'} aria-pressed={contextSettingsOpen} onClick={() => { if (activeThread !== undefined) store.selectThread(null); setContextSettingsOpen(open => !open) }}><SettingsIcon className="size-[18px]" aria-hidden="true" /></button>}</div>} />

      {snapshot.activeConversation === null ? (
        <div className="flex flex-1 flex-col items-start justify-start px-[clamp(24px,6vw,72px)] py-[clamp(44px,8vh,82px)]">
          <div className="mb-5 grid size-12 place-items-center rounded-lg border bg-muted font-mono text-primary" aria-hidden="true">C</div>
          <span className="mb-2 text-xs font-bold tracking-[0.075em] text-muted-foreground">YOUR LOCAL AGENT WORKSPACE</span>
          <h2 className="max-w-[600px] font-heading text-[clamp(25px,3vw,38px)] leading-[1.08] font-bold tracking-[-0.038em]">Make space for the whole team.</h2>
          <p className="mt-2 max-w-[560px] text-[13px] leading-6 text-muted-foreground">Projects set context. Channels gather agents. Threads keep work focused.</p>
          <div className="mt-7 grid w-[min(100%,760px)] grid-cols-3 gap-2.5 max-[640px]:grid-cols-1" aria-hidden="true">
            <span className="flex min-h-[88px] gap-2.5 rounded-lg border p-4"><b className="text-muted-foreground">01</b><span className="grid gap-1 text-xs font-semibold">Projects<small className="font-normal text-muted-foreground">Choose local context.</small></span></span>
            <span className="flex min-h-[88px] gap-2.5 rounded-lg border p-4"><b className="text-muted-foreground">02</b><span className="grid gap-1 text-xs font-semibold">Channels<small className="font-normal text-muted-foreground">Seat agents together.</small></span></span>
            <span className="flex min-h-[88px] gap-2.5 rounded-lg border p-4"><b className="text-muted-foreground">03</b><span className="grid gap-1 text-xs font-semibold">Threads<small className="font-normal text-muted-foreground">Keep native sessions exact.</small></span></span>
          </div>
        </div>
      ) : (
        <div
          ref={conversationLayout}
          className={cn('relative grid min-h-0 flex-1 overflow-hidden', resizingThread && 'select-none')}
          style={activeThread !== undefined
            ? { gridTemplateColumns: `${String(100 - threadWidth)}fr 8px ${String(threadWidth)}fr` } as CSSProperties
            : contextSettingsOpen
              ? { gridTemplateColumns: 'minmax(0,1fr) minmax(340px,420px)' } as CSSProperties
              : undefined}
        >
          <section className="flex min-h-0 min-w-0 flex-col bg-background" aria-label={isChannel ? `${heading.title} posts` : `${heading.title} messages`}>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-3 max-[640px]:px-3">
              {roots.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</div>}
              {dateLabel !== null && <div className="mx-auto mb-7 flex w-full max-w-[780px] items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"><span>{dateLabel}</span></div>}
              {isChannel
                ? roots.map(root => {
                    const thread = channelThreads.find(candidate => candidate.rootMessageId === root.id)
                    const threadIsFocused = thread?.id === activeThread?.id || root.id === focusedRootMessageId
                    const threadReplies = thread === undefined ? [] : messages.filter(message => message.threadId === thread.id && message.parentMessageId === root.id)
                    const replyCount = threadReplies.length
                    const unreadReplies = threadReplies.filter(reply => unreadMessageIds.has(reply.id))
                    const unreadCount = unreadReplies.length
                    const threadActivities = liveActivitiesFor(bootstrap?.liveActivities, snapshot.activeConversation, thread?.id)
                    return (
                      <Fragment key={root.id}>
                      {root.id === firstUnreadRootId && conversationUnreadMessages.length > 0 && (
                        <button
                          type="button"
                          className="mx-auto mb-3 grid min-h-11 w-[calc(100%+32px)] max-w-[812px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-0 bg-transparent px-4 text-xs font-semibold text-primary before:h-px before:bg-primary hover:[&>span:last-child]:text-foreground hover:[&>span:last-child]:underline"
                          aria-label={`${String(conversationUnreadMessages.length)} new messages, mark read`}
                          onClick={markConversationRead}
                        ><span>{String(conversationUnreadMessages.length)} new {conversationUnreadMessages.length === 1 ? 'message' : 'messages'}</span><span className="text-muted-foreground">Mark read</span></button>
                      )}
                      <article
                        id={`commonspace-message-${root.id}`}
                        className={cn('mx-auto mb-2 w-full max-w-[780px] rounded-md pb-1', threadIsFocused && 'bg-[color-mix(in_oklch,var(--primary)_7%,var(--background))] shadow-[inset_3px_0_0_var(--primary)]')}
                        aria-current={thread?.id === activeThread?.id ? 'true' : undefined}
                        data-focused={threadIsFocused || undefined}
                      >
                        <MessageRow message={root} bootstrap={bootstrap} onReroute={request => store.rerouteAssignment(request)} onEdit={editDeliveredMessage} onDelete={deleteDeliveredMessage} onOpenVersion={openMessageVersion} speech={speech} />
                        <button
                          type="button"
                          className={cn('relative ml-12 inline-flex min-h-11 max-w-[calc(100%-48px)] items-center gap-2 rounded-md border-0 bg-[color-mix(in_oklch,var(--primary)_8%,var(--background))] px-2 text-xs font-semibold text-primary hover:bg-[color-mix(in_oklch,var(--primary)_14%,var(--background))]', unreadCount > 0 && 'text-primary')}
                          aria-label={`${String(replyCount)} ${replyCount === 1 ? 'reply' : 'replies'}${unreadCount === 0 ? '' : `, ${String(unreadCount)} unread`}`}
                          onClick={() => {
                            if (thread === undefined) return
                            setContextSettingsOpen(false)
                            store.selectThread(thread.id)
                            for (const reply of unreadReplies) {
                              void store.mutate({ action: 'mark-inbox-item-read', messageId: reply.id })
                            }
                          }}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            {bootstrap !== null && <ThreadReplyAgents replies={threadReplies} agents={bootstrap.agents} />}
                            <span>{unreadCount > 0
                              ? `${String(unreadCount)} new ${unreadCount === 1 ? 'reply' : 'replies'}`
                              : `${String(replyCount)} ${replyCount === 1 ? 'reply' : 'replies'}`}</span>
                          </span>
                          {threadActivities.length > 0 && <span className="inline-flex items-center gap-2">
                            {thread !== undefined && bootstrap !== null && <ThreadAgentActivity
                              thread={thread}
                              agents={bootstrap.agents}
                              {...(threadActivities.length === 0 ? {} : { respondingAgentIds: threadActivities.map(activity => activity.agentId) })}
                            />}
                            <span className="rounded-full bg-[color-mix(in_oklch,var(--status-warning)_11%,var(--background))] px-2 py-1 text-[10px] text-[var(--status-warning)]">Agents working</span>
                          </span>}
                          {unreadCount > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-background bg-destructive" aria-hidden="true" />}
                        </button>
                      </article>
                      </Fragment>
                    )
                  })
                : roots.map(message => <MessageRow key={message.id} elementId={`commonspace-message-${message.id}`} message={message} bootstrap={bootstrap} onReroute={request => store.rerouteAssignment(request)} onEdit={editDeliveredMessage} onDelete={deleteDeliveredMessage} onOpenVersion={openMessageVersion} speech={speech} />)}
              {directMessagePhase !== null && <LiveAgentActivity
                activities={directMessageActivities}
                fallbackAgents={directMessageAgents}
                phase={directMessagePhase}
                onStop={(activity) => { void stopActivity(activity) }}
              />}
              <PermissionRequests permissions={directMessagePermissions} agents={bootstrap?.agents ?? []} onRespond={(permissionId, optionId) => store.respondPermission(permissionId, optionId)} />
              <div ref={bottom} />
            </div>

            {directMessageFollowups.length > 0 && (
              <section className="mx-auto mb-2 w-[min(760px,calc(100%-48px))] rounded-lg border bg-muted px-3 py-2.5" role="region" aria-label="Queued follow-ups">
                <header><strong>Up next</strong><span>{directMessageFollowups.length}</span></header>
                {directMessageFollowups.map((followup, index) => (
                  <div key={followup.messageId} className="flex items-center gap-2 border-t py-1.5 text-xs">
                    <span>{followup.delivery === 'steer' ? 'Steer' : 'Queued'}</span>
                    <p>{followup.text}</p>
                    <div>
                      <button type="button" aria-label="Move queued follow-up up" disabled={index === 0} onClick={() => { void store.reorderFollowup(followup.messageId, 'up') }}>↑</button>
                      <button type="button" aria-label="Move queued follow-up down" disabled={index === directMessageFollowups.length - 1} onClick={() => { void store.reorderFollowup(followup.messageId, 'down') }}>↓</button>
                      <button type="button" aria-label="Remove queued follow-up" onClick={() => { void store.removeFollowup(followup.messageId) }}>×</button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {commandFeedback !== null && (
              <section
                className={cn('mx-4 mb-2 rounded-md border bg-muted px-3 py-2 text-xs', commandFeedback.tone === 'error' && 'border-destructive/30 bg-destructive/5 text-destructive', commandFeedback.tone === 'success' && 'border-[color-mix(in_oklch,var(--status-success)_32%,var(--border))]')}
                role={commandFeedback.tone === 'error' ? 'alert' : 'status'}
                aria-label="Command result"
              >
                <header><strong>{commandFeedback.title}</strong><button type="button" aria-label="Dismiss command result" onClick={() => { setCommandFeedback(null); composer.current?.focus() }}>×</button></header>
                <p>{commandFeedback.body}</p>
                {commandFeedback.action === 'reset-dm' && (
                  <div><button type="button" onClick={() => { void resetDirectMessage() }}>Start new chat</button><button type="button" onClick={() => { setCommandFeedback(null); composer.current?.focus() }}>Cancel</button></div>
                )}
              </section>
            )}

            <form className="mx-auto mb-[18px] flex w-[calc(100%-48px)] max-w-[940px] flex-col gap-1 rounded-xl border bg-background px-3 pt-3 pb-2 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/10 max-[640px]:mb-3 max-[640px]:w-[calc(100%-24px)]" onSubmit={(event) => { void sendRoot(event) }}>
              <div className="relative w-full">
                <textarea
                  ref={composer}
                  aria-label={isChannel ? `Post in ${heading.title}` : `Message ${heading.title}`}
                  aria-autocomplete="list"
                  aria-controls={suggestionCount > 0 ? suggestionListId : undefined}
                  aria-activedescendant={activeSuggestionId}
                  className="block min-h-11 max-h-40 w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 outline-none"
                  placeholder={isChannel ? `Message #${heading.title}` : `Message ${heading.title}`}
                  value={draft}
                  disabled={snapshot.sending}
                  onChange={event => { setDraft(event.target.value); setSelectedSuggestion(0) }}
                  onPaste={event => {
                    const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'))
                    if (files.length > 0) void attachPastedImages(files, setPendingImages)
                  }}
                  onKeyDown={event => {
                    if (suggestionCount > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                      event.preventDefault()
                      setSelectedSuggestion(current => event.key === 'ArrowDown' ? (current + 1) % suggestionCount : (current - 1 + suggestionCount) % suggestionCount)
                    } else if (suggestionCount > 0 && event.key === 'Tab') {
                      event.preventDefault()
                      if (slashSuggestions.length > 0) selectSlashSuggestion((slashSuggestions[selectedSuggestion] ?? slashSuggestions[0]!).name)
                      else selectSuggestion(referenceSuggestions[selectedSuggestion] ?? referenceSuggestions[0]!)
                    } else if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      if (slashSuggestions.length > 0 && resolvedDraftCommand === null) {
                        selectSlashSuggestion((slashSuggestions[selectedSuggestion] ?? slashSuggestions[0]!).name)
                      } else if (referenceSuggestions.length > 0) {
                        selectSuggestion(referenceSuggestions[selectedSuggestion] ?? referenceSuggestions[0]!)
                      } else {
                        event.currentTarget.form?.requestSubmit()
                      }
                    }
                  }}
                />
                <PendingImageStrip
                  images={pendingImages}
                  onRemove={index => { setPendingImages(current => current.filter((_, candidate) => candidate !== index)) }}
                />
                <PendingFileStrip files={pendingFiles} onRemove={index => { setPendingFiles(current => current.filter((_, candidate) => candidate !== index)) }} />
                {suggestionCount > 0 && <SuggestionMenu
                  id={suggestionListId}
                  selectedSuggestion={selectedSuggestion}
                  slashSuggestions={slashSuggestions}
                  referenceSuggestions={referenceSuggestions}
                  onSelectSlash={selectSlashSuggestion}
                  onSelectTag={selectSuggestion}
                />}
              </div>
              <div className="flex min-h-[52px] items-center gap-2 pt-1">
                {directMessageActivities.length > 0 && !isChannel
                  ? <div className="flex flex-wrap items-center gap-1 [&_button]:min-h-9 [&_button]:rounded-sm [&_button]:border [&_button]:px-2 [&_button]:text-xs [&_button[aria-pressed=true]]:bg-muted" role="group" aria-label="Active run delivery">
                      <button type="button" aria-pressed={activeDelivery === 'queue'} onClick={() => { setActiveDelivery('queue') }}>Queue</button>
                      <button type="button" aria-pressed={activeDelivery === 'steer'} onClick={() => { setActiveDelivery('steer') }}>Steer</button>
                      <button type="button" aria-label="Stop and send" aria-pressed={activeDelivery === 'stop-and-send'} onClick={() => { setActiveDelivery('stop-and-send') }}>Stop + send</button>
                    </div>
                  : <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-hidden="true"><span>@</span><span>⌁</span><span>☺</span><span>Aa</span></div>}
                <label className="relative inline-flex min-h-9 items-center rounded-sm border px-2 text-xs font-semibold">Attach<input className="absolute inset-0 opacity-0" type="file" multiple aria-label="Attach files" onChange={event => {
                  const files = Array.from(event.target.files ?? [])
                  if (files.length > 0) void attachFiles(files, setPendingFiles)
                  event.target.value = ''
                }} /></label>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{isChannel ? '@ agent · @@ project · # channel · files · / commands' : 'Enter to send · files · / commands'}</span>
                <button
                  type="submit"
                  aria-label={rootIsCommand ? 'Run command' : isChannel ? 'Post message' : 'Send message'}
                  title={rootIsCommand ? 'Run command' : isChannel ? 'Post message' : 'Send message'}
                  className="inline-flex min-h-11 min-w-[76px] items-center justify-center rounded-md border-0 bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-45"
                  disabled={snapshot.sending || (draft.trim() === '' && pendingImages.length === 0 && pendingFiles.length === 0)}
                ><span className="sr-only" aria-hidden="true">↑</span><span>{rootIsCommand ? 'Run' : isChannel ? 'Post' : 'Send'}</span></button>
              </div>
            </form>
          </section>

          {activeThread !== undefined && (
            <div
              className="relative z-20 h-full w-2 cursor-col-resize border-0 bg-transparent after:absolute after:inset-y-0 after:left-[3px] after:w-px after:bg-border hover:after:w-0.5 hover:after:bg-primary"
              role="separator"
              aria-label="Resize thread"
              aria-orientation="vertical"
              aria-valuemin={25}
              aria-valuemax={75}
              aria-valuenow={threadWidth}
              tabIndex={0}
              onDoubleClick={() => { setThreadWidth(50) }}
              onPointerDown={event => { event.preventDefault(); setResizingThread(true) }}
              onKeyDown={event => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                setThreadWidth(current => Math.min(75, Math.max(25, current + (event.key === 'ArrowLeft' ? 5 : -5))))
              }}
            />
          )}

          {activeThread !== undefined && (
            <aside className="relative z-20 flex min-h-0 min-w-[360px] flex-col border-l bg-background" aria-label="Thread replies">
              <header className="flex min-h-[68px] items-center gap-2.5 border-b px-3 py-2.5 pl-5">
                <div className="min-w-0 flex-1"><strong className="font-heading text-xl">Thread</strong><p className="mt-0.5 flex gap-2 text-xs text-muted-foreground"><span>{activeThreadProject?.name ?? 'No project'}</span><span>·</span><span>#{activeChannel?.name ?? activeThread.channelId}</span>{activeThreadActivities.length > 0 && <span>· Agents working</span>}</p></div>
                <button type="button" className="min-h-10 min-w-[88px] rounded-sm border bg-background px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50" aria-label={threadFollowing ? 'Unfollow thread' : 'Follow thread'} aria-pressed={threadFollowing} disabled={activeThreadSessions.length === 0} onClick={toggleThreadFollowing}>{threadFollowing ? 'Following' : 'Follow'}</button>
                <div className="flex items-center gap-1 [&_button]:min-h-10 [&_button]:rounded-sm [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:text-xs [&_button]:text-muted-foreground [&_button]:hover:bg-muted">
                  <button type="button" aria-label="Open thread context" aria-pressed={threadContextOpen} onClick={() => { setThreadContextOpen(value => !value) }}>Context</button>
                  <button type="button" aria-label="Close thread" onClick={() => { store.selectThread(null) }}>×</button>
                </div>
              </header>
              {threadContextOpen && (
                <section className="max-h-[48%] overflow-y-auto border-b bg-muted p-4 text-xs [&_button]:min-h-10 [&_button]:rounded-sm [&_button]:border [&_button]:px-3 [&_details]:rounded-md [&_details]:border [&_details]:bg-background [&_details]:p-3 [&_form]:mt-3 [&_form]:grid [&_form]:gap-2 [&_input]:min-h-10 [&_input]:rounded-sm [&_input]:border [&_input]:bg-background [&_input]:px-2 [&_label]:grid [&_label]:gap-1 [&_textarea]:min-h-20 [&_textarea]:rounded-sm [&_textarea]:border [&_textarea]:bg-background [&_textarea]:p-2" role="region" aria-label="Thread context">
                  <details open>
                    <summary>Inherited Channel snapshot</summary>
                    <p>{activeThread.context.channelSnapshot.summary || 'No Channel summary existed when this Thread started.'}</p>
                    {activeThread.context.channelSnapshot.decisions.length > 0 && <ul>{activeThread.context.channelSnapshot.decisions.map(decision => <li key={decision}>{decision}</li>)}</ul>}
                  </details>
                  <form aria-label="Edit Thread context" onSubmit={(event) => { void saveThreadContext(event) }}>
                    <header><strong>Current Thread context</strong><span data-status={activeThread.context.memory.status}>{activeThread.context.memory.status}</span></header>
                    <label>Summary<textarea aria-label="Thread summary" value={threadContextSummary} onChange={event => { setThreadContextSummary(event.target.value) }} /></label>
                    <label>Decisions<textarea aria-label="Thread decisions" value={threadContextDecisions} onChange={event => { setThreadContextDecisions(event.target.value) }} /></label>
                    <label>Open questions<textarea aria-label="Thread open questions" value={threadContextQuestions} onChange={event => { setThreadContextQuestions(event.target.value) }} /></label>
                    <div>
                      <button type="submit" disabled={threadContextSaving}>{threadContextSaving ? 'Saving…' : 'Save context'}</button>
                      <button type="button" aria-label="Compact Thread context" disabled={threadContextCompacting} onClick={() => { void compactActiveThreadContext() }}>{threadContextCompacting ? 'Compacting…' : 'Compact'}</button>
                    </div>
                  </form>
                  <section className="mt-3 grid gap-2 rounded-md border bg-background p-3" aria-label="Thread pins">
                    <header><strong>Pins</strong><span>{activeThreadPins.length}</span></header>
                    {activeThreadPins.map((pin) => {
                      const source = pin.messageId === undefined
                        ? undefined
                        : messages.find(message => message.id === pin.messageId)
                      const attachment = pin.attachmentId === undefined
                        ? undefined
                        : source?.attachments?.find(candidate => candidate.id === pin.attachmentId)
                      const label = pin.kind === 'note'
                        ? pin.note ?? 'Pinned note'
                        : pin.kind === 'attachment'
                          ? attachment?.name ?? 'Pinned attachment'
                          : source?.text ?? 'Pinned message'
                      return (
                        <div key={pin.id}>
                          <span>{pin.scope.kind === 'channel' ? 'Channel' : pin.kind === 'note' ? 'Note' : pin.kind === 'attachment' ? 'File' : source?.authorName ?? 'Message'}</span>
                          <p>{label}</p>
                          <button type="button" aria-label={`Remove pin ${label}`} onClick={() => { void store.removePin(pin.id) }}>Remove</button>
                        </div>
                      )
                    })}
                    <form aria-label="Add Thread pin note" onSubmit={(event) => { void addThreadNotePin(event) }}>
                      <input aria-label="New Thread pin note" value={threadPinNote} onChange={event => { setThreadPinNote(event.target.value) }} placeholder="Pin a note to shared context" />
                      <button type="submit" disabled={threadPinNote.trim() === ''}>Pin note</button>
                    </form>
                  </section>
                </section>
              )}
              <div ref={threadMessages} className="min-h-0 flex-1 overflow-y-auto bg-background p-5" role="log" aria-label="Thread messages">
                {activeRoot !== undefined && <MessageRow message={activeRoot} bootstrap={bootstrap} onReroute={request => store.rerouteAssignment(request)} onPin={pinThreadMessage} onEdit={editDeliveredMessage} onDelete={deleteDeliveredMessage} onOpenVersion={openMessageVersion} speech={speech} />}
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground after:h-px after:flex-1 after:bg-border">Replies</div>
                {replies.map(reply => (
                  <MessageRow key={reply.id} elementId={`commonspace-message-${reply.id}`} message={reply} bootstrap={bootstrap} compact onReplyToAgent={replyDirectlyToAgent} onPin={pinThreadMessage} onEdit={editDeliveredMessage} onDelete={deleteDeliveredMessage} onOpenVersion={openMessageVersion} speech={speech} />
                ))}
                {activeThreadActivities.length > 0 && (
                  <LiveAgentActivity
                    activities={activeThreadActivities}
                    fallbackAgents={[]}
                    phase="running"
                    onStop={(activity) => { void stopActivity(activity) }}
                  />
                )}
                <PermissionRequests permissions={activeThreadPermissions} agents={bootstrap?.agents ?? []} onRespond={(permissionId, optionId) => store.respondPermission(permissionId, optionId)} />
              </div>
              {activeThreadFollowups.length > 0 && (
                <section className="mx-4 mb-2 rounded-lg border bg-muted px-3 py-2.5" role="region" aria-label="Queued thread follow-ups">
                  <header><strong>Up next</strong><span>{activeThreadFollowups.length}</span></header>
                  {activeThreadFollowups.map((followup, index) => (
                    <div key={followup.messageId} className="flex items-center gap-2 border-t py-1.5 text-xs">
                      <span>{followup.delivery === 'steer' ? 'Steer' : 'Queued'}</span>
                      <p>{followup.text}</p>
                      <div>
                        <button type="button" aria-label="Move queued thread follow-up up" disabled={index === 0} onClick={() => { void store.reorderFollowup(followup.messageId, 'up') }}>↑</button>
                        <button type="button" aria-label="Move queued thread follow-up down" disabled={index === activeThreadFollowups.length - 1} onClick={() => { void store.reorderFollowup(followup.messageId, 'down') }}>↓</button>
                        <button type="button" aria-label="Remove queued thread follow-up" onClick={() => { void store.removeFollowup(followup.messageId) }}>×</button>
                      </div>
                    </div>
                  ))}
                </section>
              )}
              <form className="relative mx-4 mb-4 grid gap-2 rounded-xl border bg-background p-3 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/10" onSubmit={(event) => { void sendThreadReply(event) }}>
                <div className="relative w-full">
                  {threadReplyTarget !== null && (
                    <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] rounded-sm border bg-muted p-2 text-xs" role="status">
                      <span>Replying to {threadReplyTarget.agentName}</span>
                      <small>Only this agent will respond</small>
                      <button
                        type="button"
                        aria-label="Cancel direct reply"
                        onClick={() => { setThreadReplyTarget(null); threadComposer.current?.focus() }}
                      >×</button>
                    </div>
                  )}
                  <textarea
                    ref={threadComposer}
                    aria-label="Reply in thread"
                    aria-autocomplete="list"
                    aria-controls={threadSuggestionCount > 0 ? threadSuggestionListId : undefined}
                    aria-activedescendant={activeThreadSuggestionId}
                    className="block min-h-[66px] max-h-40 w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 outline-none"
                    placeholder="Reply in thread, tag context, or type /"
                    value={threadDraft}
                    disabled={snapshot.sending}
                    onChange={event => { setThreadDraft(event.target.value); setSelectedThreadSuggestion(0) }}
                    onPaste={event => {
                      const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'))
                      if (files.length > 0) void attachPastedImages(files, setPendingThreadImages)
                    }}
                    onKeyDown={event => {
                      if (threadSuggestionCount > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                        event.preventDefault()
                        setSelectedThreadSuggestion(current => event.key === 'ArrowDown' ? (current + 1) % threadSuggestionCount : (current - 1 + threadSuggestionCount) % threadSuggestionCount)
                      } else if (threadSuggestionCount > 0 && event.key === 'Tab') {
                        event.preventDefault()
                        if (threadSlashSuggestions.length > 0) selectThreadSlashSuggestion((threadSlashSuggestions[selectedThreadSuggestion] ?? threadSlashSuggestions[0]!).name)
                        else selectThreadSuggestion(threadReferenceSuggestions[selectedThreadSuggestion] ?? threadReferenceSuggestions[0]!)
                      } else if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        if (threadSlashSuggestions.length > 0 && resolvedThreadCommand === null) {
                          selectThreadSlashSuggestion((threadSlashSuggestions[selectedThreadSuggestion] ?? threadSlashSuggestions[0]!).name)
                        } else if (threadReferenceSuggestions.length > 0) {
                          selectThreadSuggestion(threadReferenceSuggestions[selectedThreadSuggestion] ?? threadReferenceSuggestions[0]!)
                        } else {
                          event.currentTarget.form?.requestSubmit()
                        }
                      }
                    }}
                  />
                  <PendingImageStrip
                    images={pendingThreadImages}
                    onRemove={index => { setPendingThreadImages(current => current.filter((_, candidate) => candidate !== index)) }}
                  />
                  <PendingFileStrip files={pendingThreadFiles} onRemove={index => { setPendingThreadFiles(current => current.filter((_, candidate) => candidate !== index)) }} />
                  {threadSuggestionCount > 0 && <SuggestionMenu
                    id={threadSuggestionListId}
                    selectedSuggestion={selectedThreadSuggestion}
                    slashSuggestions={threadSlashSuggestions}
                    referenceSuggestions={threadReferenceSuggestions}
                    onSelectSlash={selectThreadSlashSuggestion}
                    onSelectTag={selectThreadSuggestion}
                  />}
                </div>
                {activeThreadActivities.length > 0 && threadReplyTarget === null && (
                  <div className="flex flex-wrap items-center gap-1 [&_button]:min-h-9 [&_button]:rounded-sm [&_button]:border [&_button]:px-2 [&_button]:text-xs" role="group" aria-label="Active thread run delivery">
                    <button type="button" aria-pressed={threadDelivery === 'queue'} onClick={() => { setThreadDelivery('queue') }}>Queue</button>
                    <button type="button" aria-pressed={threadDelivery === 'steer'} onClick={() => { setThreadDelivery('steer') }}>Steer</button>
                    <button type="button" aria-label="Stop and send thread follow-up" aria-pressed={threadDelivery === 'stop-and-send'} onClick={() => { setThreadDelivery('stop-and-send') }}>Stop + send</button>
                  </div>
                )}
                <label className="relative inline-flex min-h-9 w-fit items-center rounded-sm border px-2 text-xs font-semibold">Attach<input className="absolute inset-0 opacity-0" type="file" multiple aria-label="Attach files to Thread" onChange={event => {
                  const files = Array.from(event.target.files ?? [])
                  if (files.length > 0) void attachFiles(files, setPendingThreadFiles)
                  event.target.value = ''
                }} /></label>
                <button className="min-h-11 justify-self-end rounded-md border-0 bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-45" type="submit" disabled={snapshot.sending || (threadDraft.trim() === '' && pendingThreadImages.length === 0 && pendingThreadFiles.length === 0)}>{threadIsCommand ? 'Run' : 'Reply'}</button>
              </form>
            </aside>
          )}
          {contextSettingsOpen && bootstrap !== null && snapshot.activeConversation?.kind === 'channel' && (
            <ChannelSettingsPane bootstrap={bootstrap} id={snapshot.activeConversation.id} store={store} onClose={() => { setContextSettingsOpen(false) }} />
          )}
          {contextSettingsOpen && bootstrap !== null && snapshot.activeConversation?.kind === 'dm' && (
            <AgentSettingsPane bootstrap={bootstrap} id={snapshot.activeConversation.id} store={store} onClose={() => { setContextSettingsOpen(false) }} />
          )}
        </div>
      )}
    </main>
  )
}
