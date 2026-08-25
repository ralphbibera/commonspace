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
  }
  private readonly listeners = new Set<Listener>()
  private refreshPromise: Promise<void> | null = null

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
        const activeProjectId = this.snapshot.activeProjectId
          ?? bootstrap.state.projects[0]?.id
          ?? null
        this.set({ ...this.snapshot, bootstrap, loading: false, activeProjectId })
      })
      .catch((error: unknown) => {
        this.set({ ...this.snapshot, loading: false, error: error instanceof Error ? error.message : String(error) })
      })
      .finally(() => { this.refreshPromise = null })
    this.refreshPromise = task
    return task
  }

  async mutate(mutation: CommonspaceMutation): Promise<void> {
    try {
      const result = await requestJson<{ state: CommonspaceBootstrap['state'] }>('/commonspace/api/mutate', {
        method: 'POST',
        body: JSON.stringify(mutation),
      })
      const bootstrap = this.snapshot.bootstrap
      if (bootstrap === null) await this.refresh()
      else this.set({ ...this.snapshot, bootstrap: { ...bootstrap, state: result.state }, error: null })
    } catch (error) {
      this.set({ ...this.snapshot, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  selectConversation(conversation: ConversationRef): void {
    this.set({ ...this.snapshot, activeConversation: conversation, error: null })
  }

  selectProject(projectId: string): void {
    this.set({ ...this.snapshot, activeProjectId: projectId, error: null })
  }

  messages(conversation: ConversationRef | null = this.snapshot.activeConversation): CommonspaceMessage[] {
    if (conversation === null) return []
    return this.snapshot.bootstrap?.state.messages[conversationKey(conversation)] ?? []
  }

  async send(text: string): Promise<void> {
    const conversation = this.snapshot.activeConversation
    if (conversation === null || this.snapshot.sending) return
    const projectId = conversation.kind === 'channel'
      ? this.snapshot.bootstrap?.state.channels.find(channel => channel.id === conversation.id)?.projectId ?? undefined
      : this.snapshot.activeProjectId ?? undefined
    const request: SendMessageRequest = {
      conversation,
      text,
      ...(projectId === undefined ? {} : { projectId }),
    }
    this.set({ ...this.snapshot, sending: true, error: null })
    try {
      const result = await requestJson<SendMessageResponse>('/commonspace/api/send', {
        method: 'POST',
        body: JSON.stringify(request),
      })
      const bootstrap = this.snapshot.bootstrap
      if (bootstrap !== null) {
        this.set({ ...this.snapshot, sending: false, bootstrap: { ...bootstrap, state: result.state } })
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
}
