import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { Readable, Transform, Writable, type TransformCallback } from 'node:stream'
import {
  PROTOCOL_VERSION,
  client,
  methods,
  ndJsonStream,
  type ClientConnection,
  type ContentBlock,
  type InitializeResponse,
  type LoadSessionResponse,
  type McpServer,
  type SessionConfigOption,
  type SessionModeState,
  type SessionNotification,
} from '@agentclientprotocol/sdk'
import type { CommonspaceTraceEntry, CommonspaceTracePlanStep, CommonspaceTraceToolStatus } from '@commonspace/shared'

const DEFAULT_REQUEST_TIMEOUT_MS = 3_630_000
const DEFAULT_MAX_RESPONSE_CHARS = 1024 * 1024
const DEFAULT_MAX_PROTOCOL_FRAME_BYTES = 1024 * 1024
const CANCEL_SETTLE_GRACE_MS = 5_000
const MAX_STDERR_CHARS = 16_000
const MAX_TRACE_ENTRIES = 128
const MAX_REASONING_CHARS = 64_000
const MAX_PLAN_STEPS = 64
const MAX_PLAN_STEP_CHARS = 2_000
const MAX_TOOL_DETAIL_CHARS = 16_000

export interface AcpAgentProcessOptions {
  command: string
  args?: readonly string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  requestTimeoutMs?: number
  maxResponseChars?: number
  maxProtocolFrameBytes?: number
  clientName?: string
}

export interface AcpRunInput {
  cwd: string
  additionalCwds?: readonly string[]
  message: string
  images?: readonly AcpImageInput[]
  files?: readonly AcpFileInput[]
  sessionId?: string
  mcpServers?: readonly McpServer[]
  modeId?: string
  /** Provider-native model selector exposed by ACP's session model extension. */
  modelId?: string
  configOptions?: Readonly<Record<string, string | boolean>>
  onSessionReady?(sessionId: string): void
  onTraceUpdate?(entries: readonly CommonspaceTraceEntry[]): void
  onPermissionRequest?(request: AcpPermissionRequest): Promise<AcpPermissionOutcome>
}

export interface AcpPermissionRequest {
  toolCallId: string
  title: string
  kind?: string
  options: Array<{ optionId: string; name: string; kind: string }>
}

export interface AcpPermissionOutcome {
  optionId?: string
}

export interface AcpImageInput {
  name: string
  mimeType: string
  data: string
}

export interface AcpFileInput {
  name: string
  mimeType: string
  size: number
  uri: string
}

export interface AcpRunTrace {
  startedAt: string
  completedAt: string
  entries: CommonspaceTraceEntry[]
}

export interface AcpRunResult {
  sessionId: string
  text: string
  trace?: AcpRunTrace
  resources?: AcpResourceLink[]
}

export interface AcpResourceLink {
  name: string
  uri: string
  mimeType?: string
  size?: number
}

interface ActiveTurn {
  chunks: string[]
  resources: AcpResourceLink[]
  chars: number
  exceededLimit: boolean
  settled: Promise<void>
  resolveSettled(): void
  traceStartedAt: string
  traceEntries: CommonspaceTraceEntry[]
  onTraceUpdate?: AcpRunInput['onTraceUpdate']
  onPermissionRequest?: AcpRunInput['onPermissionRequest']
}

interface SessionSetup {
  sessionId: string
  modes: SessionModeState | null | undefined
  models: SessionModelStateCompat | null | undefined
  configOptions: SessionConfigOption[] | null | undefined
}

interface SessionModelStateCompat {
  currentModelId: string
  availableModels: Array<{ modelId: string }>
}

type SessionResponseWithModels<T> = T & { models?: SessionModelStateCompat | null }

export class AcpSessionLoadError extends Error {
  readonly sessionId: string
  readonly missing: boolean

  constructor(sessionId: string, cause: unknown) {
    super(`ACP failed to load the native session: ${errorMessage(cause)}`, { cause })
    this.name = 'AcpSessionLoadError'
    this.sessionId = sessionId
    this.missing = /(?:no (?:saved )?(?:session|conversation|thread)|no rollout found for thread id|(?:session|conversation|thread).*(?:not found|does not exist|unknown))/i.test(errorMessage(cause))
  }
}

export class AcpSessionRunError extends Error {
  readonly sessionId: string

  constructor(sessionId: string, cause: unknown) {
    super(`ACP native session turn failed: ${errorMessage(cause)}`, { cause })
    this.name = 'AcpSessionRunError'
    this.sessionId = sessionId
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function positiveInteger(value: number | undefined, defaultValue: number, name: string): number {
  const resolved = value ?? defaultValue
  if (!Number.isSafeInteger(resolved) || resolved < 1) throw new Error(`${name} must be a positive integer`)
  return resolved
}

function timestamp(): string {
  return new Date().toISOString()
}

function boundedText(value: string, limit: number): string {
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 14))}\n…[truncated]`
}

function displayValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return boundedText(value, MAX_TOOL_DETAIL_CHARS)
  try {
    return boundedText(JSON.stringify(value, null, 2), MAX_TOOL_DETAIL_CHARS)
  } catch {
    return boundedText(String(value), MAX_TOOL_DETAIL_CHARS)
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toolContentText(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined
  const parts: string[] = []
  for (const candidate of value) {
    const item = recordValue(candidate)
    if (item === null) continue
    if (item.type === 'content') {
      const content = recordValue(item.content)
      if (content?.type === 'text' && typeof content.text === 'string') parts.push(content.text)
      else if (content?.type === 'resource_link' && typeof content.name === 'string') parts.push(`Resource: ${content.name}`)
      else if (content?.type === 'image') parts.push('Image output')
      else if (content?.type === 'audio') parts.push('Audio output')
      continue
    }
    if (item.type === 'diff') {
      const path = typeof item.path === 'string' ? item.path : 'file'
      const oldText = typeof item.oldText === 'string' ? item.oldText : ''
      const newText = typeof item.newText === 'string' ? item.newText : ''
      parts.push(`Changed ${path}\n--- before\n${oldText}\n+++ after\n${newText}`)
      continue
    }
    if (item.type === 'terminal') parts.push('Terminal output attached')
  }
  const joined = parts.filter(Boolean).join('\n')
  return joined === '' ? undefined : boundedText(joined, MAX_TOOL_DETAIL_CHARS)
}

function combinedToolOutput(content: unknown, rawOutput: unknown): string | undefined {
  const parts = [toolContentText(content), displayValue(rawOutput)].filter((value): value is string => value !== undefined && value !== '')
  return parts.length === 0 ? undefined : boundedText(parts.join('\n'), MAX_TOOL_DETAIL_CHARS)
}

function toolStatus(value: unknown, fallback: CommonspaceTraceToolStatus = 'pending'): CommonspaceTraceToolStatus {
  return value === 'pending' || value === 'in_progress' || value === 'completed' || value === 'failed' ? value : fallback
}

function planSteps(value: unknown): CommonspaceTracePlanStep[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_PLAN_STEPS).flatMap((candidate) => {
    const entry = recordValue(candidate)
    if (entry === null || typeof entry.content !== 'string') return []
    const priority = entry.priority === 'high' || entry.priority === 'low' ? entry.priority : 'medium'
    const status = entry.status === 'in_progress' || entry.status === 'completed' ? entry.status : 'pending'
    return [{ text: boundedText(entry.content, MAX_PLAN_STEP_CHARS), priority, status }]
  })
}

class BoundedProtocolFrames extends Transform {
  #pendingBytes = 0

  constructor(private readonly maxFrameBytes: number) {
    super()
  }

  override _transform(chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
    let segmentStart = 0
    for (let index = 0; index < buffer.length; index += 1) {
      if (buffer[index] !== 0x0a) continue
      this.#pendingBytes += index - segmentStart
      if (this.#pendingBytes > this.maxFrameBytes) {
        callback(new Error('ACP protocol frame exceeded the Commonspace frame limit'))
        return
      }
      this.#pendingBytes = 0
      segmentStart = index + 1
    }
    this.#pendingBytes += buffer.length - segmentStart
    if (this.#pendingBytes > this.maxFrameBytes) {
      callback(new Error('ACP protocol frame exceeded the Commonspace frame limit'))
      return
    }
    callback(null, buffer)
  }
}

/**
 * Owns one long-lived ACP stdio process. Commonspace persists only the opaque
 * native session ID; the agent process remains the authority for conversation
 * history and reloads that history when this process is restarted.
 */
export class AcpAgentProcess {
  readonly #options: AcpAgentProcessOptions
  readonly #requestTimeoutMs: number
  readonly #maxResponseChars: number
  readonly #maxProtocolFrameBytes: number
  readonly #loadedSessions = new Set<string>()
  readonly #sessionBindings = new Map<string, string>()
  readonly #activeTurns = new Map<string, ActiveTurn>()
  readonly #appliedSettings = new Map<string, string>()
  readonly #availableConfigIds = new Map<string, Set<string>>()
  readonly #availableModeIds = new Map<string, Set<string>>()
  readonly #modelStates = new Map<string, SessionModelStateCompat>()
  #child: ChildProcessWithoutNullStreams | undefined
  #connection: ClientConnection | undefined
  #initializeResponse: InitializeResponse | undefined
  #starting: Promise<void> | undefined
  #closing = false
  #stderr = ''

  constructor(options: AcpAgentProcessOptions) {
    if (options.command.trim() === '') throw new Error('ACP command is required')
    this.#options = options
    this.#requestTimeoutMs = positiveInteger(options.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, 'ACP request timeout')
    this.#maxResponseChars = positiveInteger(options.maxResponseChars, DEFAULT_MAX_RESPONSE_CHARS, 'ACP response limit')
    this.#maxProtocolFrameBytes = positiveInteger(options.maxProtocolFrameBytes, DEFAULT_MAX_PROTOCOL_FRAME_BYTES, 'ACP protocol frame limit')
  }

  async run(input: AcpRunInput): Promise<AcpRunResult> {
    if (this.#closing) throw new Error('ACP process is closed')
    if (input.message === '' && (input.images?.length ?? 0) === 0 && (input.files?.length ?? 0) === 0) throw new Error('ACP message, image, or file is required')
    await this.#ensureStarted()
    const connection = this.#connection
    if (connection === undefined || connection.signal.aborted) throw new Error('ACP process is not connected')

    const setup = await this.#ensureSession(connection, input)
    const sessionId = setup.sessionId
    try {
      await this.#configureSession(connection, setup, input)
      if (this.#activeTurns.has(sessionId)) throw new Error('ACP native session already has an active turn')

      let resolveSettled = (): void => {}
      const settled = new Promise<void>(resolve => { resolveSettled = resolve })
      const turn: ActiveTurn = {
        chunks: [],
        resources: [],
        chars: 0,
        exceededLimit: false,
        settled,
        resolveSettled,
        traceStartedAt: timestamp(),
        traceEntries: [],
        ...(input.onTraceUpdate === undefined ? {} : { onTraceUpdate: input.onTraceUpdate }),
        ...(input.onPermissionRequest === undefined ? {} : { onPermissionRequest: input.onPermissionRequest }),
      }
      this.#activeTurns.set(sessionId, turn)
      try {
        input.onSessionReady?.(sessionId)
        const prompt: ContentBlock[] = [
          ...(input.message === '' ? [] : [{ type: 'text' as const, text: input.message }]),
          ...(input.images ?? []).map(image => ({ type: 'image' as const, mimeType: image.mimeType, data: image.data })),
          ...(input.files ?? []).map(file => ({
            type: 'resource_link' as const,
            name: file.name,
            uri: file.uri,
            mimeType: file.mimeType,
            size: file.size,
          })),
        ]
        await this.#request('session/prompt', signal => connection.agent.request(methods.agent.session.prompt, {
          sessionId,
          prompt,
        }, { cancellationSignal: signal }))
        if (turn.exceededLimit) throw new Error('ACP agent response exceeded the Commonspace output limit')
        const trace = turn.traceEntries.length === 0
          ? undefined
          : { startedAt: turn.traceStartedAt, completedAt: timestamp(), entries: structuredClone(turn.traceEntries) }
        return {
          sessionId,
          text: turn.chunks.join(''),
          ...(trace === undefined ? {} : { trace }),
          ...(turn.resources.length === 0 ? {} : { resources: structuredClone(turn.resources) }),
        }
      } finally {
        this.#activeTurns.delete(sessionId)
        turn.resolveSettled()
      }
    } catch (error) {
      if (error instanceof AcpSessionRunError) throw error
      throw new AcpSessionRunError(sessionId, error)
    }
  }

  async cancelSession(sessionId: string): Promise<boolean> {
    const connection = this.#connection
    const turn = this.#activeTurns.get(sessionId)
    if (connection === undefined || connection.signal.aborted || turn === undefined) return false
    await connection.agent.notify(methods.agent.session.cancel, { sessionId })
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        turn.settled,
        new Promise<void>(resolve => { timer = setTimeout(resolve, CANCEL_SETTLE_GRACE_MS) }),
      ])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
    return true
  }

  async close(): Promise<void> {
    if (this.#closing) return
    this.#closing = true
    const connection = this.#connection
    const child = this.#child
    connection?.close(new Error('ACP process closed by Commonspace'))
    if (child !== undefined) await this.#terminateChild(child, 'SIGTERM')
    await this.#starting?.catch(() => undefined)
    this.#connection = undefined
    this.#initializeResponse = undefined
    this.#loadedSessions.clear()
    this.#sessionBindings.clear()
    this.#appliedSettings.clear()
    this.#availableConfigIds.clear()
    this.#availableModeIds.clear()
    this.#modelStates.clear()
  }

  async #ensureStarted(): Promise<void> {
    if (this.#connection !== undefined && !this.#connection.signal.aborted) return
    this.#starting ??= this.#start().finally(() => {
      this.#starting = undefined
    })
    await this.#starting
  }

  async #start(): Promise<void> {
    const detached = process.platform !== 'win32'
    const child = spawn(this.#options.command, [...(this.#options.args ?? [])], {
      cwd: this.#options.cwd,
      env: this.#options.env ?? process.env,
      detached,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.#child = child
    this.#stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      if (this.#stderr.length < MAX_STDERR_CHARS) {
        this.#stderr = (this.#stderr + chunk).slice(0, MAX_STDERR_CHARS)
      }
    })
    child.stdin.on('error', () => undefined)
    child.once('exit', (code, signal) => {
      if (this.#child !== child) return
      const detail = this.#stderr.trim()
      const reason = new Error(detail === ''
        ? `${this.#options.command} exited with ${code === null ? signal ?? 'an unknown signal' : `code ${String(code)}`}`
        : `${this.#options.command} exited: ${detail.slice(0, 4_000)}`)
      this.#connection?.close(reason)
      this.#child = undefined
      this.#connection = undefined
      this.#initializeResponse = undefined
      this.#loadedSessions.clear()
      this.#sessionBindings.clear()
      this.#appliedSettings.clear()
      this.#availableConfigIds.clear()
      this.#availableModeIds.clear()
      this.#modelStates.clear()
    })

    try {
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', reject)
      })
      const app = client({ name: this.#options.clientName ?? 'commonspace' })
        .onRequest(methods.client.session.requestPermission, async ({ params }) => {
          const turn = this.#activeTurns.get(params.sessionId)
          if (turn?.onPermissionRequest !== undefined) {
            const outcome = await turn.onPermissionRequest({
              toolCallId: params.toolCall.toolCallId,
              title: typeof params.toolCall.title === 'string' ? params.toolCall.title : 'Permission requested',
              ...(typeof params.toolCall.kind === 'string' ? { kind: params.toolCall.kind } : {}),
              options: params.options.map(option => ({ optionId: option.optionId, name: option.name, kind: option.kind })),
            })
            if (outcome.optionId !== undefined && params.options.some(option => option.optionId === outcome.optionId)) {
              return { outcome: { outcome: 'selected', optionId: outcome.optionId } }
            }
            return { outcome: { outcome: 'cancelled' } }
          }
          const rejection = params.options.find(option => option.kind === 'reject_once' || option.kind === 'reject_always')
          return rejection === undefined
            ? { outcome: { outcome: 'cancelled' } }
            : { outcome: { outcome: 'selected', optionId: rejection.optionId } }
        })
        .onNotification(methods.client.session.update, ({ params, agent }) => {
          this.#recordSessionUpdate(params, agent)
        })
      const protocolFrames = new BoundedProtocolFrames(this.#maxProtocolFrameBytes)
      protocolFrames.once('error', error => {
        this.#connection?.close(error)
        void this.#terminateChild(child, 'SIGKILL')
      })
      child.stdout.pipe(protocolFrames)
      const stream = ndJsonStream(
        Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
        Readable.toWeb(protocolFrames) as ReadableStream<Uint8Array>,
      )
      const connection = app.connect(stream)
      this.#connection = connection
      const initializeResponse = await this.#request('initialize', signal => connection.agent.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { session: { configOptions: { boolean: {} } }, plan: {} },
        clientInfo: { name: 'Commonspace', version: '0.1.0' },
      }, { cancellationSignal: signal }))
      if (initializeResponse.protocolVersion !== PROTOCOL_VERSION) {
        throw new Error(`ACP protocol version ${String(initializeResponse.protocolVersion)} is not supported`)
      }
      this.#initializeResponse = initializeResponse
    } catch (error) {
      this.#connection?.close(error)
      await this.#terminateChild(child, 'SIGKILL')
      throw error
    }
  }

  async #ensureSession(connection: ClientConnection, input: AcpRunInput): Promise<SessionSetup> {
    const additionalDirectories = [...(input.additionalCwds ?? [])]
    const mcpServers = [...(input.mcpServers ?? [])]
    const binding = JSON.stringify({ cwd: input.cwd, additionalDirectories, mcpServers })
    if (input.sessionId !== undefined) {
      if (!this.#loadedSessions.has(input.sessionId) || this.#sessionBindings.get(input.sessionId) !== binding) {
        if (this.#initializeResponse?.agentCapabilities?.loadSession !== true) {
          throw new Error(`${this.#options.command} does not support ACP session/load`)
        }
        try {
          const response = await this.#request<SessionResponseWithModels<LoadSessionResponse>>('session/load', signal => connection.agent.request(methods.agent.session.load, {
            sessionId: input.sessionId,
            cwd: input.cwd,
            additionalDirectories,
            mcpServers,
          }, { cancellationSignal: signal }))
          this.#loadedSessions.add(input.sessionId)
          this.#sessionBindings.set(input.sessionId, binding)
          this.#appliedSettings.delete(input.sessionId)
          this.#availableConfigIds.delete(input.sessionId)
          this.#availableModeIds.delete(input.sessionId)
          this.#modelStates.delete(input.sessionId)
          return {
            sessionId: input.sessionId,
            modes: response.modes,
            models: response.models,
            configOptions: response.configOptions,
          }
        } catch (error) {
          throw new AcpSessionLoadError(input.sessionId, error)
        }
      }
      return { sessionId: input.sessionId, modes: undefined, models: undefined, configOptions: undefined }
    }

    const response = await this.#request('session/new', signal => connection.agent.request(methods.agent.session.new, {
      cwd: input.cwd,
      additionalDirectories,
      mcpServers,
    }, { cancellationSignal: signal }))
    const responseWithModels = response as SessionResponseWithModels<typeof response>
    this.#loadedSessions.add(response.sessionId)
    this.#sessionBindings.set(response.sessionId, binding)
    this.#appliedSettings.delete(response.sessionId)
    this.#availableConfigIds.delete(response.sessionId)
    this.#availableModeIds.delete(response.sessionId)
    this.#modelStates.delete(response.sessionId)
    return {
      sessionId: response.sessionId,
      modes: response.modes,
      models: responseWithModels.models,
      configOptions: response.configOptions,
    }
  }

  async #configureSession(connection: ClientConnection, setup: SessionSetup, input: AcpRunInput): Promise<void> {
    if (setup.modes !== undefined && setup.modes !== null) {
      this.#availableModeIds.set(setup.sessionId, new Set(setup.modes.availableModes.map(mode => mode.id)))
    }
    if (setup.configOptions !== undefined && setup.configOptions !== null) {
      this.#availableConfigIds.set(setup.sessionId, new Set(setup.configOptions.map(option => option.id)))
    }
    if (setup.models !== undefined && setup.models !== null) {
      this.#modelStates.set(setup.sessionId, setup.models)
    }
    const desiredConfig = Object.fromEntries(
      Object.entries(input.configOptions ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    )
    const fingerprint = JSON.stringify({ modeId: input.modeId ?? null, modelId: input.modelId ?? null, configOptions: desiredConfig })
    if (this.#appliedSettings.get(setup.sessionId) === fingerprint) return

    const modeId = input.modeId
    if (modeId !== undefined && this.#availableModeIds.get(setup.sessionId)?.has(modeId) === true && setup.modes?.currentModeId !== modeId) {
      await this.#request('session/set_mode', signal => connection.agent.request(methods.agent.session.setMode, {
        sessionId: setup.sessionId,
        modeId,
      }, { cancellationSignal: signal }))
    }

    const modelId = input.modelId
    const modelState = this.#modelStates.get(setup.sessionId)
    if (modelId !== undefined && modelState !== undefined && modelState.currentModelId !== modelId) {
      await this.#request('session/set_model', signal => connection.agent.request('session/set_model', {
        sessionId: setup.sessionId,
        modelId,
      }, { cancellationSignal: signal }))
      modelState.currentModelId = modelId
    }

    const availableConfigIds = this.#availableConfigIds.get(setup.sessionId)
    for (const [configId, value] of Object.entries(desiredConfig)) {
      if (availableConfigIds?.has(configId) !== true) continue
      const current = setup.configOptions?.find(option => option.id === configId)?.currentValue
      if (current === value) continue
      await this.#request('session/set_config_option', signal => connection.agent.request(methods.agent.session.setConfigOption,
        typeof value === 'boolean'
          ? { sessionId: setup.sessionId, configId, type: 'boolean', value }
          : { sessionId: setup.sessionId, configId, value },
        { cancellationSignal: signal }))
    }
    this.#appliedSettings.set(setup.sessionId, fingerprint)
  }

  #recordSessionUpdate(notification: SessionNotification, connection: ClientConnection['agent']): void {
    const turn = this.#activeTurns.get(notification.sessionId)
    if (turn === undefined) return
    const update = notification.update
    if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
      const nextChars = turn.chars + update.content.text.length
      if (nextChars > this.#maxResponseChars) {
        if (!turn.exceededLimit) {
          turn.exceededLimit = true
          void connection.notify(methods.agent.session.cancel, { sessionId: notification.sessionId }).catch(() => undefined)
        }
        return
      }
      turn.chars = nextChars
      turn.chunks.push(update.content.text)
      return
    }
    if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'resource_link') {
      const resource = update.content
      if (turn.resources.length >= 8 || turn.resources.some(candidate => candidate.uri === resource.uri)) return
      turn.resources.push({
        name: resource.name,
        uri: resource.uri,
        ...(typeof resource.mimeType === 'string' ? { mimeType: resource.mimeType } : {}),
        ...(typeof resource.size === 'number' ? { size: resource.size } : {}),
      })
      return
    }

    const changedAt = timestamp()
    if (update.sessionUpdate === 'agent_thought_chunk' && update.content.type === 'text') {
      const messageId = 'messageId' in update && typeof update.messageId === 'string' ? update.messageId : 'reasoning'
      const existing = turn.traceEntries.find((entry): entry is Extract<CommonspaceTraceEntry, { type: 'reasoning' }> => entry.type === 'reasoning' && entry.id === messageId)
      this.#setTraceEntry(turn, existing === undefined
        ? { type: 'reasoning', id: messageId, text: boundedText(update.content.text, MAX_REASONING_CHARS), createdAt: changedAt, updatedAt: changedAt }
        : { ...existing, text: boundedText(existing.text + update.content.text, MAX_REASONING_CHARS), updatedAt: changedAt })
      return
    }

    if (update.sessionUpdate === 'plan') {
      const existing = turn.traceEntries.find((entry): entry is Extract<CommonspaceTraceEntry, { type: 'plan' }> => entry.type === 'plan' && entry.id === 'plan')
      this.#setTraceEntry(turn, {
        type: 'plan',
        id: 'plan',
        steps: planSteps(update.entries),
        createdAt: existing?.createdAt ?? changedAt,
        updatedAt: changedAt,
      })
      return
    }

    if (update.sessionUpdate === 'plan_update') {
      const plan = update.plan
      const id = plan.planId
      const existing = turn.traceEntries.find((entry): entry is Extract<CommonspaceTraceEntry, { type: 'plan' }> => entry.type === 'plan' && entry.id === id)
      this.#setTraceEntry(turn, {
        type: 'plan',
        id,
        steps: plan.type === 'items' ? planSteps(plan.entries) : existing?.steps ?? [],
        ...(plan.type === 'markdown' ? { markdown: boundedText(plan.content, MAX_REASONING_CHARS) } : existing?.markdown === undefined ? {} : { markdown: existing.markdown }),
        createdAt: existing?.createdAt ?? changedAt,
        updatedAt: changedAt,
      })
      return
    }

    if (update.sessionUpdate === 'plan_removed') {
      const index = turn.traceEntries.findIndex(entry => entry.type === 'plan' && entry.id === update.planId)
      if (index >= 0) {
        turn.traceEntries.splice(index, 1)
        this.#publishTrace(turn)
      }
      return
    }

    if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
      const existing = turn.traceEntries.find((entry): entry is Extract<CommonspaceTraceEntry, { type: 'tool' }> => entry.type === 'tool' && entry.id === update.toolCallId)
      const contentOutput = combinedToolOutput(update.content, update.rawOutput)
      const next: Extract<CommonspaceTraceEntry, { type: 'tool' }> = {
        type: 'tool',
        id: update.toolCallId,
        title: typeof update.title === 'string' ? boundedText(update.title, 1_000) : existing?.title ?? 'Tool call',
        ...(typeof update.name === 'string' ? { toolName: boundedText(update.name, 200) } : existing?.toolName === undefined ? {} : { toolName: existing.toolName }),
        ...(typeof update.kind === 'string' ? { toolKind: boundedText(update.kind, 100) } : existing?.toolKind === undefined ? {} : { toolKind: existing.toolKind }),
        status: toolStatus(update.status, existing?.status),
        ...(update.rawInput === undefined ? existing?.input === undefined ? {} : { input: existing.input } : { input: displayValue(update.rawInput) ?? '' }),
        ...(contentOutput === undefined ? existing?.output === undefined ? {} : { output: existing.output } : { output: contentOutput }),
        createdAt: existing?.createdAt ?? changedAt,
        updatedAt: changedAt,
      }
      this.#setTraceEntry(turn, next)
      return
    }

    if (update.sessionUpdate === 'usage_update') {
      const existing = turn.traceEntries.find((entry): entry is Extract<CommonspaceTraceEntry, { type: 'usage' }> => entry.type === 'usage')
      this.#setTraceEntry(turn, {
        type: 'usage',
        id: 'usage',
        usedTokens: Number(update.used),
        contextWindow: Number(update.size),
        ...(update.cost === undefined || update.cost === null
          ? {}
          : { costAmount: update.cost.amount, costCurrency: update.cost.currency }),
        createdAt: existing?.createdAt ?? changedAt,
        updatedAt: changedAt,
      })
    }
  }

  #setTraceEntry(turn: ActiveTurn, entry: CommonspaceTraceEntry): void {
    const index = turn.traceEntries.findIndex(candidate => candidate.type === entry.type && candidate.id === entry.id)
    if (index >= 0) turn.traceEntries[index] = entry
    else if (turn.traceEntries.length < MAX_TRACE_ENTRIES) turn.traceEntries.push(entry)
    else return
    this.#publishTrace(turn)
  }

  #publishTrace(turn: ActiveTurn): void {
    if (turn.onTraceUpdate === undefined) return
    try {
      turn.onTraceUpdate(structuredClone(turn.traceEntries))
    } catch {
      // Trace presentation must never interrupt the provider-native turn.
    }
  }

  async #request<T>(label: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController()
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        const error = new Error(`${this.#options.command} ACP ${label} timed out after ${String(Math.ceil(this.#requestTimeoutMs / 1000))} seconds`)
        this.#connection?.close(error)
        const child = this.#child
        if (child !== undefined) void this.#terminateChild(child, 'SIGKILL')
        reject(error)
      }, this.#requestTimeoutMs)
    })
    try {
      return await Promise.race([operation(controller.signal), timeout])
    } catch (error) {
      const detail = this.#stderr.trim()
      if (detail === '' || error instanceof AcpSessionLoadError) throw error
      throw new Error(`${errorMessage(error)}: ${detail.slice(0, 4_000)}`, { cause: error })
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }

  async #terminateChild(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return
    const exited = new Promise<void>(resolve => child.once('exit', () => resolve()))
    const detached = process.platform !== 'win32'
    if (detached && child.pid !== undefined) {
      try {
        process.kill(-child.pid, signal)
      } catch {
        child.kill(signal)
      }
    } else {
      child.kill(signal)
    }
    const didExit = await Promise.race([
      exited.then(() => true),
      new Promise<false>(resolve => setTimeout(() => resolve(false), 1_000)),
    ])
    if (!didExit && signal !== 'SIGKILL') {
      if (detached && child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          child.kill('SIGKILL')
        }
      } else {
        child.kill('SIGKILL')
      }
      await Promise.race([
        exited,
        new Promise<void>(resolve => setTimeout(resolve, 1_000)),
      ])
    }
  }
}
