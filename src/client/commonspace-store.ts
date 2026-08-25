import type {
  CommonspaceApiError,
  CommonspaceBootstrap,
  CommonspaceMessage,
  CommonspaceMutation,
  ConversationRef,
  SendMessageRequest,
  SendMessageResponse,
} from '../contracts.ts'
import { conversationKey } from '../contracts.ts'

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
  private events: EventSource | null = null

  getSnapshot = (): CommonspaceClientSnapshot => this.snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async refresh(): Promise<void> {
    if (this.refreshPromise !== null) return this.refreshPromise
    this.set({ ...this.snapshot, loading: true, error: null })
    const task = requestJson<CommonspaceBootstrap>('/commonspace/api/bootstrap')
      .then((bootstrap) => {
        const merged = this.mergeBootstrap(bootstrap)
        this.set({ ...this.snapshot, bootstrap: merged, loading: false, activeProjectId: this.resolveActiveProject(merged) })
      })
      .catch((error: unknown) => {
        this.set({ ...this.snapshot, loading: false, error: error instanceof Error ? error.message : String(error) })
      })
      .finally(() => { this.refreshPromise = null })
    this.refreshPromise = task
    return task
  }

  connectEvents(): void {
    if (this.events !== null || typeof EventSource === 'undefined') return
    const events = new EventSource('/commonspace/api/events')
    events.addEventListener('revision', (event) => {
      try {
        const value = JSON.parse((event as MessageEvent<string>).data) as { revision?: number }
        if (typeof value.revision === 'number' && value.revision > (this.snapshot.bootstrap?.state.revision ?? -1)) void this.refresh()
      } catch {
        // Ignore malformed event frames; EventSource will continue.
      }
    })
    events.onerror = () => { this.set({ ...this.snapshot, error: 'Commonspace live updates disconnected; retrying…' }) }
    this.events = events
  }

  disconnectEvents(): void {
    this.events?.close()
    this.events = null
  }

  async mutate(mutation: CommonspaceMutation): Promise<void> {
    try {
      const result = await requestJson<{ state: CommonspaceBootstrap['state'] }>('/commonspace/api/mutate', {
        method: 'POST',
        body: JSON.stringify(mutation),
      })
      const bootstrap = this.snapshot.bootstrap
      if (bootstrap === null) await this.refresh()
      else {
        const merged = this.mergeBootstrap({ ...bootstrap, state: result.state })
        this.set({ ...this.snapshot, bootstrap: merged, activeProjectId: this.resolveActiveProject(merged), error: null })
      }
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

  async send(text: string, threadId?: string): Promise<void> {
    const conversation = this.snapshot.activeConversation
    if (conversation === null || this.snapshot.sending) return
    const projectId = conversation.kind === 'channel'
      ? this.snapshot.bootstrap?.state.channels.find(channel => channel.id === conversation.id)?.projectId ?? undefined
      : this.snapshot.activeProjectId ?? undefined
    const request: SendMessageRequest = {
      conversation,
      text,
      ...(projectId === undefined ? {} : { projectId }),
      ...(threadId === undefined ? {} : { threadId }),
    }
    this.set({ ...this.snapshot, sending: true, error: null })
    try {
      const result = await requestJson<SendMessageResponse>('/commonspace/api/send', {
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
    return candidate
  }

  private resolveActiveProject(bootstrap: CommonspaceBootstrap): string | null {
    const current = this.snapshot.activeProjectId
    if (current !== null && bootstrap.state.projects.some(project => project.id === current)) return current
    return bootstrap.state.projects[0]?.id ?? null
  }
}
