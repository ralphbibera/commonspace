import type {
  AgentAdapterKind,
  CommonspaceApiError,
  CommonspaceBootstrap,

  CommonspaceLiveAgentActivity,
  CommonspaceQueuedFollowup,
  CommonspaceMessage,
  CommonspaceMutation,
  CommonspaceRoutingConfiguration,
  ConversationRef,
  SelectDirectoryResponse,
  SendImageAttachment,
  SendMessageRequest,
  SendMessageResponse,
  FollowupQueueResponse,
  StopAgentRunsResponse,
  UpdateRoutingConfigurationRequest,
} from '@commonspace/shared'
import { conversationKey } from '@commonspace/shared'

export interface CommonspaceClientSnapshot {
  bootstrap: CommonspaceBootstrap | null
  loading: boolean
  sending: boolean
  error: string | null
  activeConversation: ConversationRef | null
  activeProjectId: string | null
  activeThreadId: string | null
}

type Listener = () => void
const LIVE_UPDATES_DISCONNECTED = 'Commonspace live updates disconnected; retrying…'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
  const value = await response.json() as T | CommonspaceApiError
  if (!response.ok) {
    const error = value as CommonspaceApiError
    throw new Error(error.error || `Commonspace request failed (${String(response.status)})`)
  }
  return value as T
}

export class CommonspaceClientStore {
  private snapshot: CommonspaceClientSnapshot = {
    bootstrap: null,
    loading: false,
    sending: false,
    error: null,
    activeConversation: null,
    activeProjectId: null,
    activeThreadId: null,
  }
  private readonly listeners = new Set<Listener>()
  private refreshPromise: Promise<void> | null = null
  private discoveryRequest = 0
  private pendingRevision = -1
  private pendingLiveActivities: CommonspaceLiveAgentActivity[] | null = null
  private events: EventSource | null = null

  getSnapshot = (): CommonspaceClientSnapshot => this.snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async refresh(): Promise<void> {
    if (this.refreshPromise !== null) return this.refreshPromise
    this.set({ ...this.snapshot, loading: true, error: null })
    let refreshSucceeded = false
    const task = requestJson<CommonspaceBootstrap>('/api/bootstrap')
      .then((bootstrap) => {
        refreshSucceeded = true
        const liveActivities = this.pendingLiveActivities
        this.pendingLiveActivities = null
        const merged = this.mergeBootstrap(liveActivities === null ? bootstrap : { ...bootstrap, liveActivities })
        this.set({ ...this.snapshot, bootstrap: merged, loading: false, activeProjectId: this.resolveActiveProject(merged) })
      })
      .catch((error: unknown) => {
        this.set({ ...this.snapshot, loading: false, error: error instanceof Error ? error.message : String(error) })
      })
      .finally(() => {
        this.refreshPromise = null
        const currentRevision = this.snapshot.bootstrap?.state.revision ?? -1
        if (this.pendingRevision <= currentRevision) this.pendingRevision = -1
        else if (refreshSucceeded) void this.refresh()
      })
    this.refreshPromise = task
    return task
  }

  connectEvents(): void {
    if (this.events !== null || typeof EventSource === 'undefined') return
    const events = new EventSource('/api/events')
    events.addEventListener('revision', (event) => {
      try {
        const value = JSON.parse((event as MessageEvent<string>).data) as { revision?: number }
        if (typeof value.revision === 'number' && value.revision > (this.snapshot.bootstrap?.state.revision ?? -1)) {
          this.pendingRevision = Math.max(this.pendingRevision, value.revision)
          void this.refresh()
        }
      } catch {
        // Ignore malformed event frames; EventSource will continue.
      }
    })
    events.addEventListener('activity', (event) => {
      try {
        const value = JSON.parse((event as MessageEvent<string>).data) as { activities?: unknown; queuedFollowups?: unknown }
        if (!Array.isArray(value.activities)) return
        const activities = value.activities as CommonspaceLiveAgentActivity[]
        this.pendingLiveActivities = activities
        const bootstrap = this.snapshot.bootstrap
        if (bootstrap === null) return
        const queuedFollowups = Array.isArray(value.queuedFollowups)
          ? value.queuedFollowups as CommonspaceQueuedFollowup[]
          : bootstrap.queuedFollowups
        this.set({
          ...this.snapshot,
          bootstrap: {
            ...bootstrap,
            liveActivities: activities,
            ...(queuedFollowups === undefined ? {} : { queuedFollowups }),
          },
        })
      } catch {
        // Ignore malformed event frames; EventSource will continue.
      }
    })
    events.onerror = () => { this.set({ ...this.snapshot, error: LIVE_UPDATES_DISCONNECTED }) }
    events.onopen = () => {
      if (this.snapshot.error === LIVE_UPDATES_DISCONNECTED) this.set({ ...this.snapshot, error: null })
    }
    this.events = events
  }

  disconnectEvents(): void {
    this.events?.close()
    this.events = null
  }

  async mutate(mutation: CommonspaceMutation): Promise<void> {
    try {
      const result = await requestJson<CommonspaceBootstrap>('/api/mutate', {
        method: 'POST',
        body: JSON.stringify(mutation),
      })
      const merged = this.mergeBootstrap(result)
      this.set({ ...this.snapshot, bootstrap: merged, activeProjectId: this.resolveActiveProject(merged), error: null })
    } catch (error) {
      this.set({ ...this.snapshot, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  async updateRoutingConfiguration(request: UpdateRoutingConfigurationRequest): Promise<void> {
    try {
      const routing = await requestJson<CommonspaceRoutingConfiguration>('/api/routing', {
        method: 'PUT',
        body: JSON.stringify(request),
      })
      const bootstrap = this.snapshot.bootstrap
      this.set({
        ...this.snapshot,
        ...(bootstrap === null ? {} : { bootstrap: { ...bootstrap, routing } }),
        error: null,
      })
    } catch (error) {
      this.set({ ...this.snapshot, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  async discoverAgents(adapter: AgentAdapterKind): Promise<void> {
    const request = ++this.discoveryRequest
    this.set({ ...this.snapshot, loading: true, error: null })
    try {
      const result = await requestJson<CommonspaceBootstrap>('/api/discover-agents', {
        method: 'POST',
        body: JSON.stringify({ adapter }),
      })
      if (request !== this.discoveryRequest) return
      const merged = this.mergeBootstrap(result)
      this.set({ ...this.snapshot, bootstrap: merged, loading: false, error: null })
    } catch (error) {
      if (request !== this.discoveryRequest) return
      this.set({ ...this.snapshot, loading: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  async selectDirectory(): Promise<string | null> {
    try {
      const result = await requestJson<SelectDirectoryResponse>('/api/select-directory', { method: 'POST' })
      if (result.path !== null && typeof result.path !== 'string') throw new Error('folder picker returned an invalid path')
      this.set({ ...this.snapshot, error: null })
      return result.path
    } catch (error) {
      this.set({ ...this.snapshot, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  selectConversation(conversation: ConversationRef): void {
    this.set({ ...this.snapshot, activeConversation: conversation, activeThreadId: null, error: null })
  }

  selectThread(threadId: string | null): void {
    this.set({ ...this.snapshot, activeThreadId: threadId, error: null })
  }

  selectProject(projectId: string): void {
    this.set({ ...this.snapshot, activeProjectId: projectId, error: null })
  }

  messages(conversation: ConversationRef | null = this.snapshot.activeConversation): CommonspaceMessage[] {
    if (conversation === null) return []
    return this.snapshot.bootstrap?.state.messages[conversationKey(conversation)] ?? []
  }

  async send(text: string, threadId?: string, attachments: readonly SendImageAttachment[] = [], delivery?: SendMessageRequest['delivery']): Promise<void> {
    return this.sendMessage(text, threadId, undefined, attachments, delivery)
  }

  async sendDirectReply(text: string, threadId: string, targetAgentId: string, attachments: readonly SendImageAttachment[] = []): Promise<void> {
    return this.sendMessage(text, threadId, targetAgentId, attachments)
  }

  async stopAgentRuns(messageId: string, agentId?: string): Promise<string[]> {
    try {
      const result = await requestJson<StopAgentRunsResponse>('/api/stop', {
        method: 'POST',
        body: JSON.stringify({ messageId, ...(agentId === undefined ? {} : { agentId }) }),
      })
      this.set({ ...this.snapshot, error: null })
      return result.stoppedAgentIds
    } catch (error) {
      this.set({ ...this.snapshot, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  async reorderFollowup(messageId: string, direction: 'up' | 'down'): Promise<void> {
    await this.updateFollowupQueue('/api/followups/reorder', { messageId, direction })
  }

  async removeFollowup(messageId: string): Promise<void> {
    await this.updateFollowupQueue('/api/followups/remove', { messageId })
  }

  private async updateFollowupQueue(path: string, body: object): Promise<void> {
    try {
      const result = await requestJson<FollowupQueueResponse>(path, { method: 'POST', body: JSON.stringify(body) })
      const bootstrap = this.snapshot.bootstrap
      this.set({
        ...this.snapshot,
        ...(bootstrap === null ? {} : { bootstrap: { ...bootstrap, queuedFollowups: result.queuedFollowups } }),
        error: null,
      })
    } catch (error) {
      this.set({ ...this.snapshot, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  private async sendMessage(text: string, threadId?: string, targetAgentId?: string, attachments: readonly SendImageAttachment[] = [], delivery?: SendMessageRequest['delivery']): Promise<void> {
    const conversation = this.snapshot.activeConversation
    if (conversation === null || this.snapshot.sending) return
    // A thread already owns its complete Project scope. The singular selection is
    // only a compatibility input for new roots and DMs, not a thread mutation.
    const projectId = threadId === undefined ? this.snapshot.activeProjectId ?? undefined : undefined
    const request: SendMessageRequest = {
      conversation,
      text,
      ...(projectId === undefined ? {} : { projectId }),
      ...(threadId === undefined ? {} : { threadId }),
      ...(targetAgentId === undefined ? {} : { targetAgentId }),
      ...(attachments.length === 0 ? {} : { attachments: [...attachments] }),

      ...(delivery === undefined ? {} : { delivery }),
    }
    this.set({ ...this.snapshot, sending: true, error: null })
    try {
      const result = await requestJson<SendMessageResponse>('/api/send', {
        method: 'POST',
        body: JSON.stringify(request),
      })
      const bootstrap = this.snapshot.bootstrap
      if (bootstrap !== null) {
        const merged = this.mergeBootstrap({ ...bootstrap, state: result.state })
        this.set({
          ...this.snapshot,
          sending: false,
          bootstrap: merged,
          activeProjectId: this.resolveActiveProject(merged),
          activeThreadId: result.thread?.id ?? this.snapshot.activeThreadId,
        })
      } else {
        await this.refresh()
        this.set({ ...this.snapshot, sending: false })
      }
    } catch (error) {
      this.set({ ...this.snapshot, sending: false, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  private set(snapshot: CommonspaceClientSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }

  private mergeBootstrap(candidate: CommonspaceBootstrap): CommonspaceBootstrap {
    const current = this.snapshot.bootstrap
    if (current !== null && candidate.state.revision < current.state.revision) return current
    if (candidate.liveActivities === undefined && current?.liveActivities !== undefined) {
      return { ...candidate, liveActivities: current.liveActivities }
    }
    return candidate
  }

  private resolveActiveProject(bootstrap: CommonspaceBootstrap): string | null {
    const current = this.snapshot.activeProjectId
    if (current !== null && bootstrap.state.projects.some(project => project.id === current)) return current
    return bootstrap.state.projects[0]?.id ?? null
  }
}
