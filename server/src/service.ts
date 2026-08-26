import { execFile, spawn } from 'node:child_process'
import { chmod, mkdir, open, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, sep } from 'node:path'
import { promisify } from 'node:util'
import type {
  AgentAdapterKind,
  CommonspaceAgentDefinition,
  CommonspaceBootstrap,
  CommonspaceAgentProfile,
  CommonspaceMessage,
  CommonspaceMutation,
  CommonspaceState,
  CommonspaceThread,
  SendMessageRequest,
  SendMessageResponse,
} from '@commonspace/shared'
import { COMMONSPACE_STATE_VERSION, conversationKey } from '@commonspace/shared'
import {
  buildClaudeCodeInvocation,
  buildCodexInvocation,
  buildHermesInvocation,
  buildRoomPrompt,
  isAgentSessionId,
  parseClaudeCodeOutput,
  parseCodexOutput,
  parseHermesProfileList,
  routeChannelAgents,
  type AgentCommandInvocation,
} from '@commonspace/adapters'
import { projectChannelMemory } from './memory.js'
import { applyMutation, createInitialState, defaultCommonspaceDefaults, defaultRunSettings, emptyChannelMemory, isCommonspaceReasoning, managedAgentId } from './state.js'

const execFileAsync = promisify(execFile)
const MAX_MESSAGE_CHARS = 16_000
const MAX_CAPTURE_BYTES = 1024 * 1024
const MANAGED_AGENT_ID_PATTERN = /^(?:codex|claude-code)-[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u
const THREAD_SESSION_SCOPE_PATTERN = /^Commonspace Thread: [0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DM_SESSION_SCOPE_PATTERN = /^Commonspace DM: [0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface CommonspaceHostConfig {
  root?: string
  hermesPath?: string
  codexPath?: string
  claudePath?: string
  maxAgentsPerTurn?: number
  /** Legacy Hermes-only unsafe mode. */
  yolo?: boolean
  hermesYolo?: boolean
  externalAgentYolo?: boolean
  runBudgetSeconds?: number
  maxClaudeTurns?: number
}

export interface CommonspaceHostEnvironment {
  logger?: {
    warn(message: unknown): void
  }
}

export function unsafeModeForAdapter(config: CommonspaceHostConfig, adapter: AgentAdapterKind): boolean {
  return adapter === 'hermes'
    ? (config.hermesYolo ?? config.yolo ?? false)
    : config.externalAgentYolo === true
}

export interface AgentRunInput {
  agent: CommonspaceAgentProfile
  cwd: string
  additionalCwds: string[]
  sessionName: string
  prompt: string
  sessionId?: string
  model?: string
  reasoning?: CommonspaceState['defaults']['reasoning']
}

export interface AgentRunResult {
  text: string
  sessionId?: string
}

export interface CommonspaceHostDependencies {
  discoverAgents(): Promise<CommonspaceAgentProfile[]>
  runAgent(input: AgentRunInput): Promise<string | AgentRunResult>
  beforeAcceptSend?(prepared: PreparedSend): Promise<void>
}

interface PreparedSend {
  request: SendMessageRequest
  text: string
  agents: CommonspaceAgentProfile[]
  agentIds: string[]
  channel?: CommonspaceState['channels'][number]
  project?: CommonspaceState['projects'][number]
  thread?: CommonspaceThread
  dmSessionName?: string
}

function messageId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function sanitizeManagedAgents(value: unknown): CommonspaceState['agents'] {
  if (!Array.isArray(value)) return []
  const agents: CommonspaceState['agents'] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) continue
    const agent = candidate as Record<string, unknown>
    const adapter = agent.adapter
    if (adapter !== 'codex' && adapter !== 'claude-code') continue
    if (typeof agent.id !== 'string' || !MANAGED_AGENT_ID_PATTERN.test(agent.id)) continue
    if (typeof agent.displayName !== 'string' || agent.displayName.trim() === '') continue
    if (agent.model !== null && typeof agent.model !== 'string') continue
    if (typeof agent.createdAt !== 'string') continue
    const displayName = agent.displayName.normalize('NFKC').trim().slice(0, 80)
    try {
      if (managedAgentId(adapter, displayName) !== agent.id) continue
    } catch {
      continue
    }
    const model = typeof agent.model === 'string' ? agent.model.trim().slice(0, 200) : null
    agents.push({
      id: agent.id,
      displayName,
      adapter,
      model: model === '' ? null : model,
      createdAt: agent.createdAt.slice(0, 100),
    })
  }
  return [...new Map(agents.map(agent => [agent.id, agent])).values()]
}

function sanitizeDmSessions(value: unknown): CommonspaceState['dmSessions'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .filter((entry): entry is [string, string] => entry[0].length > 0 && entry[0].length <= 200 && typeof entry[1] === 'string' && DM_SESSION_SCOPE_PATTERN.test(entry[1]))
    .slice(-500))
}

function sanitizeAgentSessions(
  value: unknown,
  allowedAgentIds: ReadonlySet<string>,
  dmSessions: CommonspaceState['dmSessions'],
): CommonspaceState['agentSessions'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const sessions: CommonspaceState['agentSessions'] = {}
  for (const [agentId, rawScopes] of Object.entries(value)) {
    if (!allowedAgentIds.has(agentId)) continue
    if (typeof rawScopes !== 'object' || rawScopes === null || Array.isArray(rawScopes)) continue
    const scopes = Object.fromEntries(Object.entries(rawScopes)
      .filter((entry): entry is [string, string] => ((entry[0] === 'Bot Chat' && dmSessions[agentId] === undefined) || THREAD_SESSION_SCOPE_PATTERN.test(entry[0]) || dmSessions[agentId] === entry[0]) && isAgentSessionId(entry[1]))
      .slice(-500))
    if (Object.keys(scopes).length > 0) sessions[agentId] = scopes
  }
  return sessions
}

function isMissingNativeSession(error: unknown, adapter: AgentAdapterKind): boolean {
  if (adapter === 'hermes') return false
  const message = error instanceof Error ? error.message : String(error)
  return /(?:no (?:saved )?(?:session|conversation|thread)|no rollout found for thread id|(?:session|conversation|thread).*(?:not found|does not exist|unknown)|failed to (?:load|resume).*(?:session|conversation|thread))/i.test(message)
}

function pathContains(parent: string, candidate: string): boolean {
  const relation = relative(parent, candidate)
  return relation === '' || (relation !== '..' && !relation.startsWith(`..${sep}`) && !isAbsolute(relation))
}

function workspacePathsOverlap(first: string, second: string): boolean {
  return pathContains(first, second) || pathContains(second, first)
}

export async function readBoundedTextFile(path: string, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('output limit must be a positive integer')
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(maxBytes + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0)
    if (bytesRead > maxBytes) throw new Error('adapter output exceeded the Commonspace output limit')
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

async function executeAgentCommand(invocation: AgentCommandInvocation, timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const detached = process.platform !== 'win32'
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      detached,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let capturedBytes = 0
    let failure: Error | undefined
    let settled = false
    const terminate = (): void => {
      if (detached && child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGKILL')
          return
        } catch {
          // Fall through to direct-child termination.
        }
      }
      child.kill('SIGKILL')
    }
    const timer = setTimeout(() => {
      failure = new Error(`${invocation.command} timed out after ${String(Math.ceil(timeoutMs / 1000))} seconds`)
      terminate()
    }, timeoutMs)

    const capture = (target: Buffer[], chunk: Buffer | string): void => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      capturedBytes += buffer.byteLength
      if (capturedBytes > MAX_CAPTURE_BYTES) {
        failure = new Error(`${invocation.command} exceeded the Commonspace output limit`)
        terminate()
        return
      }
      target.push(buffer)
    }
    child.stdout.on('data', (chunk: Buffer | string) => { capture(stdout, chunk) })
    child.stderr.on('data', (chunk: Buffer | string) => { capture(stderr, chunk) })
    child.stdin.on('error', () => undefined)
    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const output = Buffer.concat(stdout).toString('utf8')
      const errors = Buffer.concat(stderr).toString('utf8')
      if (failure !== undefined) {
        const detail = errors.trim() || output.trim()
        return reject(detail === '' ? failure : new Error(`${failure.message}: ${detail.slice(0, 4_000)}`))
      }
      if (code !== 0) {
        return reject(new Error(errors.trim() || output.trim() || `${invocation.command} exited with ${code === null ? signal ?? 'an unknown signal' : `code ${String(code)}`}`))
      }
      resolve({ stdout: output, stderr: errors })
    })
    child.stdin.end(invocation.input)
  })
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function loadedId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim().slice(0, 200)
  return id === '' ? null : id
}

function loadedString(value: unknown, maximum: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, maximum) : fallback
}

function loadedStringArray(value: unknown, maximumItems = 64, maximumLength = 2_000): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((candidate) => {
    if (typeof candidate !== 'string') return []
    const normalized = candidate.trim().slice(0, maximumLength)
    return normalized === '' ? [] : [normalized]
  }))].slice(0, maximumItems)
}

function loadedBoundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.trunc(value)))
    : fallback
}

function loadedModel(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') return null
  const model = value.trim().slice(0, 200)
  return model === '' ? null : model
}

function sanitizeRunSettings(value: unknown): CommonspaceState['channels'][number]['settings'] {
  const settings = plainRecord(value)
  if (settings === null) return defaultRunSettings()
  return {
    model: loadedModel(settings.model),
    reasoning: settings.reasoning === null || !isCommonspaceReasoning(settings.reasoning) ? null : settings.reasoning,
  }
}

function sanitizeChannelMemory(value: unknown): CommonspaceState['channels'][number]['memory'] {
  const memory = plainRecord(value)
  if (memory === null) return emptyChannelMemory()
  return {
    summary: loadedString(memory.summary, 16_000),
    decisions: loadedStringArray(memory.decisions, 50, 2_000),
    openQuestions: loadedStringArray(memory.openQuestions, 50, 2_000),
    threadIds: loadedStringArray(memory.threadIds, 50, 200),
    updatedAt: typeof memory.updatedAt === 'string' ? memory.updatedAt.slice(0, 100) : null,
  }
}

function sanitizeProjects(value: unknown): CommonspaceState['projects'] {
  if (!Array.isArray(value)) return []
  const projects: CommonspaceState['projects'] = []
  const ids = new Set<string>()
  for (const candidate of value) {
    const project = plainRecord(candidate)
    const id = loadedId(project?.id)
    if (project === null || id === null || ids.has(id)) continue
    const name = loadedString(project.name, 80).normalize('NFKC').trim()
    const paths = [...new Set(loadedStringArray(project.paths, 32, 4_096).filter(isAbsolute))]
    if (name === '' || paths.length === 0) continue
    ids.add(id)
    projects.push({ id, name, paths, createdAt: loadedString(project.createdAt, 100) })
  }
  return projects
}

function sanitizeChannels(value: unknown, projectIds: ReadonlySet<string>): CommonspaceState['channels'] {
  if (!Array.isArray(value)) return []
  const channels: CommonspaceState['channels'] = []
  const ids = new Set<string>()
  for (const candidate of value) {
    const channel = plainRecord(candidate)
    const id = loadedId(channel?.id)
    if (channel === null || id === null || ids.has(id)) continue
    const name = loadedString(channel.name, 80).normalize('NFKC').trim().replace(/^#+/, '')
    if (name === '') continue
    const rawProjectId = loadedId(channel.projectId)
    ids.add(id)
    channels.push({
      id,
      name,
      projectId: rawProjectId !== null && projectIds.has(rawProjectId) ? rawProjectId : null,
      agentIds: loadedStringArray(channel.agentIds, 64, 200),
      instructions: loadedString(channel.instructions, 8_000),
      memory: sanitizeChannelMemory(channel.memory),
      settings: sanitizeRunSettings(channel.settings),
      createdAt: loadedString(channel.createdAt, 100),
    })
  }
  return channels
}

function sanitizeThreads(value: unknown, channels: readonly CommonspaceState['channels'][number][]): CommonspaceState['threads'] {
  if (!Array.isArray(value)) return []
  const channelById = new Map(channels.map(channel => [channel.id, channel]))
  const threads: CommonspaceState['threads'] = []
  const ids = new Set<string>()
  for (const candidate of value) {
    const thread = plainRecord(candidate)
    const id = loadedId(thread?.id)
    const channelId = loadedId(thread?.channelId)
    const rootMessageId = loadedId(thread?.rootMessageId)
    if (thread === null || id === null || ids.has(id) || channelId === null || rootMessageId === null) continue
    const channel = channelById.get(channelId)
    if (channel === undefined) continue
    if (thread.status !== 'queued' && thread.status !== 'running' && thread.status !== 'complete' && thread.status !== 'error') continue
    ids.add(id)
    threads.push({
      id,
      channelId,
      projectId: channel.projectId,
      rootMessageId,
      agentIds: loadedStringArray(thread.agentIds, 64, 200),
      status: thread.status,
      createdAt: loadedString(thread.createdAt, 100),
      updatedAt: loadedString(thread.updatedAt, 100),
      ...(typeof thread.error === 'string' ? { error: thread.error.slice(0, 4_000) } : {}),
    })
  }
  return threads
}

function sanitizeMessages(
  value: unknown,
  channelIds: ReadonlySet<string>,
  threads: readonly CommonspaceThread[],
): CommonspaceState['messages'] {
  const record = plainRecord(value)
  if (record === null) return {}
  const threadIds = new Set(threads.map(thread => thread.id))
  const messages: CommonspaceState['messages'] = {}
  for (const [key, rawMessages] of Object.entries(record)) {
    if (!Array.isArray(rawMessages)) continue
    const separator = key.indexOf(':')
    const kind = key.slice(0, separator)
    const conversationId = separator < 1 ? '' : key.slice(separator + 1)
    if ((kind !== 'channel' && kind !== 'dm') || conversationId === '') continue
    if (kind === 'channel' && !channelIds.has(conversationId)) continue
    const seen = new Set<string>()
    const sanitized: CommonspaceMessage[] = []
    for (const candidate of rawMessages.slice(-500)) {
      const message = plainRecord(candidate)
      const conversation = plainRecord(message?.conversation)
      const id = loadedId(message?.id)
      const authorId = loadedId(message?.authorId)
      const authorName = loadedString(message?.authorName, 200).trim()
      if (message === null || conversation === null || id === null || seen.has(id) || authorId === null || authorName === '') continue
      if (conversation.kind !== kind || conversation.id !== conversationId) continue
      if (message.authorType !== 'user' && message.authorType !== 'agent' && message.authorType !== 'system') continue
      if (typeof message.text !== 'string') continue
      const threadId = loadedId(message.threadId)
      if (message.threadId !== undefined && (threadId === null || !threadIds.has(threadId))) continue
      const parentMessageId = loadedId(message.parentMessageId)
      if (message.parentMessageId !== undefined && parentMessageId === null) continue
      seen.add(id)
      sanitized.push({
        id,
        conversation: { kind, id: conversationId },
        authorType: message.authorType,
        authorId,
        authorName,
        text: message.text.slice(0, 64_000),
        createdAt: loadedString(message.createdAt, 100),
        ...(threadId === null ? {} : { threadId }),
        ...(parentMessageId === null ? {} : { parentMessageId }),
        ...(kind === 'dm' && message.authorType === 'user' &&
          (message.replyStatus === 'queued' || message.replyStatus === 'running' || message.replyStatus === 'complete' || message.replyStatus === 'error')
          ? {
              replyStatus: message.replyStatus,
              ...(typeof message.replyError === 'string' ? { replyError: message.replyError.slice(0, 4_000) } : {}),
            }
          : {}),
      })
    }
    messages[key] = sanitized
  }
  return messages
}

function sanitizeLoadedState(value: unknown): CommonspaceState {
  const record = plainRecord(value)
  if (record === null || (record.version !== 1 && record.version !== 2 && record.version !== 3 && record.version !== 4 && record.version !== 5 && record.version !== COMMONSPACE_STATE_VERSION)) {
    return createInitialState()
  }
  const fallbackDefaults = defaultCommonspaceDefaults()
  const rawDefaults = plainRecord(record.defaults) ?? {}
  const defaults: CommonspaceState['defaults'] = {
    model: loadedModel(rawDefaults.model),
    reasoning: isCommonspaceReasoning(rawDefaults.reasoning) ? rawDefaults.reasoning : fallbackDefaults.reasoning,
    maxAgentsPerTurn: loadedBoundedInteger(rawDefaults.maxAgentsPerTurn, fallbackDefaults.maxAgentsPerTurn, 1, 8),
    memoryThreads: loadedBoundedInteger(rawDefaults.memoryThreads, fallbackDefaults.memoryThreads, 1, 50),
  }
  const projects = sanitizeProjects(record.projects)
  let channels = sanitizeChannels(record.channels, new Set(projects.map(project => project.id)))
  const threads = sanitizeThreads(record.threads, channels)
  const threadIds = new Set(threads.map(thread => thread.id))
  channels = channels.map(channel => ({
    ...channel,
    memory: { ...channel.memory, threadIds: channel.memory.threadIds.filter(id => threadIds.has(id)) },
  }))
  const agents = sanitizeManagedAgents(record.agents)
  const dmSessions = sanitizeDmSessions(record.dmSessions)
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: loadedBoundedInteger(record.revision, 0, 0, Number.MAX_SAFE_INTEGER),
    defaults,
    agents,
    dmSessions,
    agentSessions: sanitizeAgentSessions(record.agentSessions, new Set(agents.map(agent => agent.id)), dmSessions),
    projects,
    channels,
    threads,
    messages: sanitizeMessages(record.messages, new Set(channels.map(channel => channel.id)), threads),
  }
}

export class CommonspaceHostService {
  readonly root: string
  private readonly statePath: string
  private state: CommonspaceState = createInitialState()
  private writeTail = Promise.resolve()
  private readonly conversationTails = new Map<string, Promise<unknown>>()
  private readonly workspaceTails = new Map<string, Promise<unknown>>()
  private readonly revisionListeners = new Set<(revision: number) => void>()
  private readonly backgroundRuns = new Set<Promise<void>>()
  private readonly hermesPath: string
  private readonly codexPath: string
  private readonly claudePath: string
  private readonly maxAgentsPerTurn: number
  private readonly hermesYolo: boolean
  private readonly externalAgentYolo: boolean
  private readonly runBudgetSeconds: number
  private readonly maxClaudeTurns: number

  constructor(
    private readonly environment: CommonspaceHostEnvironment,
    config: CommonspaceHostConfig = {},
    private readonly overrides: Partial<CommonspaceHostDependencies> = {},
  ) {
    this.root = config.root ?? join(homedir(), '.commonspace')
    this.statePath = join(this.root, 'state.json')
    this.hermesPath = config.hermesPath ?? 'hermes'
    this.codexPath = config.codexPath ?? 'codex'
    this.claudePath = config.claudePath ?? 'claude'
    this.maxAgentsPerTurn = Math.max(1, Math.min(8, config.maxAgentsPerTurn ?? 6))
    this.hermesYolo = unsafeModeForAdapter(config, 'hermes')
    this.externalAgentYolo = unsafeModeForAdapter(config, 'codex')
    this.runBudgetSeconds = Math.min(600, Math.max(30, config.runBudgetSeconds ?? 180))
    this.maxClaudeTurns = Math.min(100, Math.max(1, Math.trunc(config.maxClaudeTurns ?? 40)))
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    try {
      this.state = sanitizeLoadedState(JSON.parse(await readFile(this.statePath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.environment.logger?.warn(error)
      this.state = createInitialState()
    }
    this.state = await this.canonicalizeLoadedProjectPaths(this.state)
    let memoryChanged = false
    const channels = this.state.channels.map(channel => {
      const memory = projectChannelMemory(this.state, channel.id, this.state.defaults.memoryThreads)
      const changed = JSON.stringify(memory) !== JSON.stringify(channel.memory)
      if (changed) memoryChanged = true
      return changed ? { ...channel, memory } : channel
    })
    if (memoryChanged) {
      this.state = { ...this.state, revision: this.state.revision + 1, channels }
    }
    await this.persist()
  }

  private async canonicalizeLoadedProjectPaths(state: CommonspaceState): Promise<CommonspaceState> {
    const projects: CommonspaceState['projects'] = []
    for (const project of state.projects) {
      const paths: string[] = []
      for (const path of project.paths) {
        try {
          const canonical = await this.validDirectory(path)
          if (!paths.includes(canonical)) paths.push(canonical)
        } catch {
          // Invalid persisted paths are dropped before they can reach an adapter invocation.
        }
      }
      if (paths.length > 0) projects.push({ ...project, paths })
    }
    const projectIds = new Set(projects.map(project => project.id))
    const channels = state.channels.map(channel => ({
      ...channel,
      projectId: channel.projectId !== null && projectIds.has(channel.projectId) ? channel.projectId : null,
    }))
    const channelById = new Map(channels.map(channel => [channel.id, channel]))
    const threads = state.threads.flatMap((thread) => {
      const channel = channelById.get(thread.channelId)
      return channel === undefined ? [] : [{ ...thread, projectId: channel.projectId }]
    })
    return { ...state, projects, channels, threads }
  }

  snapshot(): CommonspaceState {
    return structuredClone(this.state)
  }

  private publicSnapshot(): CommonspaceState {
    return { ...this.snapshot(), dmSessions: {}, agentSessions: {} }
  }

  async whenIdle(): Promise<void> {
    while (this.backgroundRuns.size > 0) {
      await Promise.all([...this.backgroundRuns].map(operation => operation.catch(() => undefined)))
    }
  }

  async bootstrap(): Promise<CommonspaceBootstrap> {
    return {
      agents: await this.discoverAgents(),
      state: this.publicSnapshot(),
    }
  }

  async mutate(mutation: CommonspaceMutation): Promise<CommonspaceState> {
    const normalized = await this.normalizeMutation(mutation)
    this.state = applyMutation(this.state, normalized)
    await this.persist()
    this.broadcastRevision()
    return this.publicSnapshot()
  }

  async send(request: SendMessageRequest): Promise<SendMessageResponse> {
    const prepared = await this.prepareSend(request)
    await this.overrides.beforeAcceptSend?.(prepared)
    const response = await this.acceptSend(prepared)
    const executionKey = response.thread === undefined
      ? conversationKey(request.conversation)
      : `thread:${response.thread.id}`
    const previous = this.conversationTails.get(executionKey) ?? Promise.resolve()
    const operation = previous.catch(() => undefined).then(() => this.processReplies(prepared, response))
    this.conversationTails.set(executionKey, operation)
    this.backgroundRuns.add(operation)
    void operation.finally(() => {
      this.backgroundRuns.delete(operation)
      if (this.conversationTails.get(executionKey) === operation) this.conversationTails.delete(executionKey)
    }).catch(() => undefined)
    return response
  }

  subscribeToRevisions(listener: (revision: number) => void): () => void {
    this.revisionListeners.add(listener)
    return () => { this.revisionListeners.delete(listener) }
  }

  private async prepareSend(request: SendMessageRequest): Promise<PreparedSend> {
    const text = request.text.normalize('NFKC').trim().slice(0, MAX_MESSAGE_CHARS)
    if (text === '') throw new Error('message text is required')
    const agents = await this.discoverAgents()
    let channel = undefined as PreparedSend['channel']
    let project = undefined as PreparedSend['project']
    let thread = undefined as PreparedSend['thread']
    let dmSessionName = undefined as PreparedSend['dmSessionName']
    let agentIds: string[]

    if (request.conversation.kind === 'channel') {
      channel = this.state.channels.find(candidate => candidate.id === request.conversation.id)
      if (channel === undefined) throw new Error('unknown channel')
      if (request.projectId !== undefined && request.projectId !== channel.projectId) throw new Error('channel project cannot be overridden')
      if (channel.projectId !== null) {
        project = this.state.projects.find(candidate => candidate.id === channel?.projectId)
        if (project === undefined) throw new Error('channel references an unknown project')
      }
      if (request.threadId !== undefined) {
        thread = this.state.threads.find(candidate => candidate.id === request.threadId)
        if (thread === undefined || thread.channelId !== channel.id) throw new Error('unknown channel thread')
      }
      agentIds = routeChannelAgents(thread?.agentIds ?? channel.agentIds, text, agents)
    } else {
      if (request.threadId !== undefined) throw new Error('direct messages do not use channel threads')
      if (!agents.some(agent => agent.id === request.conversation.id)) throw new Error('unknown agent')
      if (request.projectId !== undefined) {
        project = this.state.projects.find(candidate => candidate.id === request.projectId)
        if (project === undefined) throw new Error('unknown project')
      }
      agentIds = [request.conversation.id]
      dmSessionName = this.state.dmSessions[request.conversation.id] ?? 'Bot Chat'
    }
    return { request, text, agents, agentIds, ...(channel === undefined ? {} : { channel }), ...(project === undefined ? {} : { project }), ...(thread === undefined ? {} : { thread }), ...(dmSessionName === undefined ? {} : { dmSessionName }) }
  }

  private async acceptSend(prepared: PreparedSend): Promise<SendMessageResponse> {
    if (!this.conversationIsCurrent(prepared, prepared.thread)) {
      throw new Error('conversation changed before message acceptance')
    }
    const createdAt = now()
    const acceptedId = messageId()
    let thread = prepared.thread
    if (prepared.request.conversation.kind === 'channel' && thread === undefined) {
      const id = crypto.randomUUID()
      thread = {
        id,
        channelId: prepared.request.conversation.id,
        projectId: prepared.channel?.projectId ?? null,
        rootMessageId: acceptedId,
        agentIds: prepared.agentIds,
        status: 'queued',
        createdAt,
        updatedAt: createdAt,
      }
    }
    const accepted: CommonspaceMessage = {
      id: acceptedId,
      conversation: prepared.request.conversation,
      authorType: 'user',
      authorId: 'user',
      authorName: 'Ralph',
      text: prepared.text,
      createdAt,
      ...(thread === undefined ? {} : { threadId: thread.id }),
      ...(prepared.thread === undefined ? {} : { parentMessageId: prepared.thread.rootMessageId }),
      ...(prepared.request.conversation.kind === 'dm' ? { replyStatus: 'queued' } : {}),
    }
    const key = conversationKey(prepared.request.conversation)
    const currentMessages = this.state.messages[key] ?? []
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      messages: { ...this.state.messages, [key]: [...currentMessages, accepted].slice(-500) },
      threads: prepared.thread === undefined && thread !== undefined
        ? [...this.state.threads, thread]
        : this.state.threads.map(existing => {
            if (existing.id !== thread?.id) return existing
            const updated: CommonspaceThread = { ...existing, status: 'queued', updatedAt: createdAt }
            delete updated.error
            return updated
          }),
    }
    await this.persist()
    this.broadcastRevision()
    return { accepted, ...(thread === undefined ? {} : { thread }), state: this.publicSnapshot() }
  }

  private async processReplies(prepared: PreparedSend, response: SendMessageResponse): Promise<void> {
    const thread = response.thread
    if (thread !== undefined) await this.setThreadStatus(thread.id, 'running')
    const cwd = prepared.project?.paths[0] ?? process.cwd()
    const projectContext = prepared.project?.paths.length
      ? `Project workspaces:\n${prepared.project.paths.map(path => `- ${path}`).join('\n')}\n\n`
      : ''
    try {
      const effectiveLimit = Math.min(this.maxAgentsPerTurn, this.state.defaults.maxAgentsPerTurn)
      const effectiveModel = prepared.channel?.settings.model ?? this.state.defaults.model ?? undefined
      const effectiveReasoning = prepared.channel?.settings.reasoning ?? this.state.defaults.reasoning
      for (const agentId of prepared.agentIds.slice(0, effectiveLimit)) {
        const agent = prepared.agents.find(candidate => candidate.id === agentId)
        if (agent === undefined) continue
        const authority = this.managedAgentAuthority(agent)
        if (agent.adapter !== 'hermes' && authority === undefined) continue
        const executionIsCurrent = () => this.agentAuthorityIsCurrent(agent, authority) && this.conversationIsCurrent(prepared, thread)
        const prompt = prepared.request.conversation.kind === 'dm'
          ? `${projectContext}Message from Ralph in Commonspace:\n\n${prepared.text}`
          : buildRoomPrompt({
              channel: prepared.channel?.name ?? 'channel',
              agent: agent.id,
              userText: prepared.text,
              ...(prepared.project === undefined ? {} : { projectPaths: prepared.project.paths }),
              ...(prepared.channel?.instructions ? { instructions: prepared.channel.instructions } : {}),
              ...(prepared.channel?.memory.summary ? { memorySummary: prepared.channel.memory.summary } : {}),
              ...(prepared.channel?.memory.decisions.length ? { decisions: prepared.channel.memory.decisions } : {}),
              ...(prepared.channel?.memory.openQuestions.length ? { openQuestions: prepared.channel.memory.openQuestions } : {}),
              recent: (this.state.messages[conversationKey(prepared.request.conversation)] ?? []).slice(-30),
            })
        const sessionName = prepared.request.conversation.kind === 'dm'
          ? prepared.dmSessionName ?? 'Bot Chat'
          : `Commonspace Thread: ${thread?.id ?? crypto.randomUUID()}`
        const sessionId = this.state.agentSessions[agent.id]?.[sessionName]
        const agentModel = effectiveModel ?? (agent.adapter === 'hermes' ? undefined : agent.model ?? undefined)
        const workspaces = prepared.project?.paths ?? [cwd]
        let agentResponse: AgentRunResult | null
        try {
          agentResponse = await this.withWorkspaceLocks(workspaces, async () => {
            if (!executionIsCurrent()) return null
            if (prepared.request.conversation.kind === 'dm' &&
              this.updateMessageReplyStatus(prepared.request.conversation, response.accepted.id, 'running')) {
              await this.persist()
              this.broadcastRevision()
            }
            return this.runAgentWithSessionRecovery({
              agent,
              cwd,
              additionalCwds: prepared.project?.paths.slice(1) ?? [],
              sessionName,
              prompt,
              ...(sessionId === undefined ? {} : { sessionId }),
              ...(agentModel === undefined ? {} : { model: agentModel }),
              reasoning: effectiveReasoning,
            }, executionIsCurrent)
          })
        } catch (error) {
          if (!executionIsCurrent()) continue
          throw error
        }
        if (agentResponse === null || !executionIsCurrent()) continue
        if (agentResponse.sessionId !== undefined) this.rememberAgentSession(agent.id, sessionName, agentResponse.sessionId)
        if (prepared.request.conversation.kind === 'dm') {
          this.updateMessageReplyStatus(prepared.request.conversation, response.accepted.id, 'complete')
        }
        this.append({
          id: messageId(),
          conversation: prepared.request.conversation,
          authorType: 'agent',
          authorId: agent.id,
          authorName: agent.displayName,
          text: agentResponse.text,
          createdAt: now(),
          ...(thread === undefined ? {} : { threadId: thread.id, parentMessageId: thread.rootMessageId }),
        })
        await this.persist()
        this.broadcastRevision()
      }
      if (thread !== undefined) {
        if (!this.conversationIsCurrent(prepared, thread)) return
        await this.setThreadStatus(thread.id, 'complete')
        await this.updateChannelMemory(thread.channelId)
      }
    } catch (error) {
      if (!this.conversationIsCurrent(prepared, thread)) return
      const message = error instanceof Error ? error.message : String(error)
      if (prepared.request.conversation.kind === 'dm') {
        this.updateMessageReplyStatus(prepared.request.conversation, response.accepted.id, 'error', message)
      }
      this.append({
        id: messageId(),
        conversation: prepared.request.conversation,
        authorType: 'system',
        authorId: 'system',
        authorName: 'Commonspace',
        text: `Agent run failed: ${message}`,
        createdAt: now(),
        ...(thread === undefined ? {} : { threadId: thread.id, parentMessageId: thread.rootMessageId }),
      })
      await this.persist()
      this.broadcastRevision()
      if (thread !== undefined) {
        await this.setThreadStatus(thread.id, 'error', message)
        await this.updateChannelMemory(thread.channelId)
      }
    }
  }

  private managedAgentAuthority(agent: CommonspaceAgentProfile): CommonspaceAgentDefinition | null | undefined {
    return agent.adapter === 'hermes' ? null : this.state.agents.find(candidate => candidate.id === agent.id)
  }

  private conversationIsCurrent(prepared: PreparedSend, thread: CommonspaceThread | undefined): boolean {
    if (prepared.request.conversation.kind === 'dm') {
      return (this.state.dmSessions[prepared.request.conversation.id] ?? 'Bot Chat') === (prepared.dmSessionName ?? 'Bot Chat')
    }
    if (!this.state.channels.some(channel => channel.id === prepared.request.conversation.id)) return false
    return thread === undefined || this.state.threads.some(candidate => candidate.id === thread.id)
  }

  private agentAuthorityIsCurrent(
    agent: CommonspaceAgentProfile,
    authority: CommonspaceAgentDefinition | null | undefined,
  ): boolean {
    return agent.adapter === 'hermes'
      ? authority === null
      : authority !== undefined && this.state.agents.find(candidate => candidate.id === agent.id) === authority
  }

  private async withWorkspaceLocks<T>(paths: readonly string[], task: () => Promise<T>): Promise<T> {
    const keys = [...new Set(paths)].sort()
    const predecessors = new Set<Promise<unknown>>()
    for (const [activePath, tail] of this.workspaceTails) {
      if (keys.some(key => workspacePathsOverlap(activePath, key))) predecessors.add(tail)
    }
    const operation = Promise.all([...predecessors].map(predecessor => predecessor.catch(() => undefined))).then(task)
    for (const key of keys) this.workspaceTails.set(key, operation)
    void operation.finally(() => {
      for (const key of keys) {
        if (this.workspaceTails.get(key) === operation) this.workspaceTails.delete(key)
      }
    }).catch(() => undefined)
    return operation
  }

  private rememberAgentSession(agentId: string, sessionName: string, sessionId: string): void {
    if (!isAgentSessionId(sessionId)) throw new Error('agent returned an invalid session id')
    const current = this.state.agentSessions[agentId] ?? {}
    if (current[sessionName] === sessionId) return
    const bounded = Object.fromEntries([...Object.entries(current), [sessionName, sessionId]].slice(-500))
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      agentSessions: { ...this.state.agentSessions, [agentId]: bounded },
    }
  }

  private forgetAgentSession(agentId: string, sessionName: string, expectedSessionId: string): void {
    const current = this.state.agentSessions[agentId]
    if (current?.[sessionName] !== expectedSessionId) return
    const remaining = { ...current }
    delete remaining[sessionName]
    const agentSessions = { ...this.state.agentSessions }
    if (Object.keys(remaining).length === 0) delete agentSessions[agentId]
    else agentSessions[agentId] = remaining
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      agentSessions,
    }
  }

  private async updateChannelMemory(channelId: string): Promise<void> {
    const memory = projectChannelMemory(this.state, channelId, this.state.defaults.memoryThreads)
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      channels: this.state.channels.map(channel => channel.id === channelId ? { ...channel, memory } : channel),
    }
    await this.persist()
    this.broadcastRevision()
  }

  private async setThreadStatus(id: string, status: CommonspaceThread['status'], error?: string): Promise<void> {
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      threads: this.state.threads.map(thread => {
        if (thread.id !== id) return thread
        const updated: CommonspaceThread = { ...thread, status, updatedAt: now(), ...(error === undefined ? {} : { error }) }
        if (error === undefined) delete updated.error
        return updated
      }),
    }
    await this.persist()
    this.broadcastRevision()
  }

  private broadcastRevision(): void {
    for (const listener of this.revisionListeners) {
      try {
        listener(this.state.revision)
      } catch {
        this.revisionListeners.delete(listener)
      }
    }
  }

  private append(message: CommonspaceMessage): void {
    const key = conversationKey(message.conversation)
    const current = this.state.messages[key] ?? []
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      messages: { ...this.state.messages, [key]: [...current, message].slice(-500) },
    }
  }

  private updateMessageReplyStatus(
    conversation: SendMessageRequest['conversation'],
    messageId: string,
    replyStatus: NonNullable<CommonspaceMessage['replyStatus']>,
    replyError?: string,
  ): boolean {
    const key = conversationKey(conversation)
    const current = this.state.messages[key]
    if (current === undefined || !current.some(message => message.id === messageId)) return false
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      messages: {
        ...this.state.messages,
        [key]: current.map((message) => {
          if (message.id !== messageId) return message
          const updated: CommonspaceMessage = { ...message, replyStatus, ...(replyError === undefined ? {} : { replyError }) }
          if (replyError === undefined) delete updated.replyError
          return updated
        }),
      },
    }
    return true
  }

  private async normalizeMutation(mutation: CommonspaceMutation): Promise<CommonspaceMutation> {
    if (mutation.action === 'create-project') {
      const paths = await Promise.all(mutation.paths.map(path => this.validDirectory(path)))
      return { ...mutation, paths }
    }
    if (mutation.action === 'add-project-path') {
      return { ...mutation, path: await this.validDirectory(mutation.path) }
    }
    if (mutation.action === 'add-agent') {
      const id = managedAgentId(mutation.adapter, mutation.displayName)
      const conflict = (await this.discoverAgents()).some(agent => agent.id === id && agent.adapter === 'hermes')
      if (conflict) throw new Error(`agent ${mutation.displayName.trim()} conflicts with a Hermes profile`)
    }
    if (mutation.action === 'reset-dm') {
      if (typeof mutation.agentId !== 'string' || !(await this.discoverAgents()).some(agent => agent.id === mutation.agentId)) {
        throw new Error('unknown agent')
      }
    }
    return mutation
  }

  private async validDirectory(path: string): Promise<string> {
    if (!isAbsolute(path)) throw new Error('project path must be absolute')
    const resolved = await realpath(path)
    if (!(await stat(resolved)).isDirectory()) throw new Error('project path must be a directory')
    return resolved
  }

  private async discoverAgents(): Promise<CommonspaceAgentProfile[]> {
    let discovered: CommonspaceAgentProfile[] = []
    if (this.overrides.discoverAgents !== undefined) {
      discovered = await this.overrides.discoverAgents()
    } else {
      try {
        const { stdout } = await execFileAsync(this.hermesPath, ['profile', 'list'], {
          maxBuffer: MAX_CAPTURE_BYTES,
          timeout: 30_000,
          encoding: 'utf8',
        })
        discovered = parseHermesProfileList(stdout)
      } catch (error) {
        this.environment.logger?.warn(`Commonspace could not discover Hermes profiles: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const managed = this.state.agents.map<CommonspaceAgentProfile>(agent => ({
      id: agent.id,
      displayName: agent.displayName,
      adapter: agent.adapter,
      model: agent.model,
      status: 'unknown',
    }))
    const unique = new Map<string, CommonspaceAgentProfile>()
    for (const agent of [...discovered, ...managed]) {
      if (!unique.has(agent.id)) unique.set(agent.id, agent)
    }
    return [...unique.values()]
  }

  private async runAgent(input: AgentRunInput): Promise<AgentRunResult> {
    if (this.overrides.runAgent !== undefined) {
      const result = await this.overrides.runAgent(input)
      return typeof result === 'string' ? { text: result } : result
    }
    if (input.agent.adapter === 'hermes') return this.runHermesAgent(input)
    if (input.agent.adapter === 'codex') return this.runCodexAgent(input)
    if (input.agent.adapter === 'claude-code') return this.runClaudeCodeAgent(input)
    throw new Error(`unsupported agent adapter ${String(input.agent.adapter)}`)
  }

  private async runAgentWithSessionRecovery(
    input: AgentRunInput,
    shouldContinue: () => boolean,
  ): Promise<AgentRunResult | null> {
    try {
      return await this.runAgent(input)
    } catch (error) {
      if (input.sessionId === undefined || !isMissingNativeSession(error, input.agent.adapter)) throw error
      if (!shouldContinue()) return null
      this.forgetAgentSession(input.agent.id, input.sessionName, input.sessionId)
      if (!shouldContinue()) return null
      const replacement = { ...input }
      delete replacement.sessionId
      return this.runAgent(replacement)
    }
  }

  private async ensureTempRoot(): Promise<string> {
    const tempRoot = join(this.root, 'tmp')
    await mkdir(tempRoot, { recursive: true, mode: 0o700 })
    await chmod(tempRoot, 0o700)
    return tempRoot
  }

  private async runHermesAgent(input: AgentRunInput): Promise<AgentRunResult> {
    const tempRoot = await this.ensureTempRoot()
    const queryFile = join(tempRoot, `${crypto.randomUUID()}.txt`)
    try {
      await writeFile(queryFile, input.prompt, { encoding: 'utf8', mode: 0o600 })
      const invocation = buildHermesInvocation({
        profile: input.agent.id,
        cwd: input.cwd,
        sessionName: input.sessionName,
        queryFile,
        hermesPath: this.hermesPath,
        yolo: this.hermesYolo,
        ...(input.model === undefined ? {} : { model: input.model }),
        ...(input.reasoning === undefined ? {} : { reasoning: input.reasoning }),
      })
      const { stdout, stderr } = await executeAgentCommand({
        command: invocation.command,
        args: [...invocation.args, '--run-budget', String(this.runBudgetSeconds)],
        cwd: input.cwd,
        input: '',
      }, (this.runBudgetSeconds + 30) * 1000)
      const response = stdout.trim()
      if (response === '') throw new Error(stderr.trim() || `Hermes profile ${input.agent.id} returned no response`)
      return { text: response.slice(0, 64_000) }
    } finally {
      await rm(queryFile, { force: true })
    }
  }

  private async runCodexAgent(input: AgentRunInput): Promise<AgentRunResult> {
    const tempRoot = await this.ensureTempRoot()
    const outputFile = join(tempRoot, `${crypto.randomUUID()}.txt`)
    try {
      await writeFile(outputFile, '', { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      const invocation = buildCodexInvocation({
        cwd: input.cwd,
        additionalCwds: input.additionalCwds,
        prompt: input.prompt,
        outputFile,
        unsafe: this.externalAgentYolo,
        codexPath: this.codexPath,
        ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
        ...(input.model === undefined ? {} : { model: input.model }),
        ...(input.reasoning === undefined ? {} : { reasoning: input.reasoning }),
      })
      const { stdout } = await executeAgentCommand(invocation, (this.runBudgetSeconds + 30) * 1000)
      let lastMessage = ''
      try {
        lastMessage = await readBoundedTextFile(outputFile, MAX_CAPTURE_BYTES)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      const result = parseCodexOutput(stdout, lastMessage, input.sessionId)
      return { text: result.text.slice(0, 64_000), sessionId: result.sessionId }
    } finally {
      await rm(outputFile, { force: true })
    }
  }

  private async runClaudeCodeAgent(input: AgentRunInput): Promise<AgentRunResult> {
    const invocation = buildClaudeCodeInvocation({
      cwd: input.cwd,
      additionalCwds: input.additionalCwds,
      prompt: input.prompt,
      sessionName: input.sessionName,
      newSessionId: crypto.randomUUID(),
      unsafe: this.externalAgentYolo,
      maxTurns: this.maxClaudeTurns,
      claudePath: this.claudePath,
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      ...(input.model === undefined ? {} : { model: input.model }),
      ...(input.reasoning === undefined ? {} : { reasoning: input.reasoning }),
    })
    const { stdout } = await executeAgentCommand(invocation, (this.runBudgetSeconds + 30) * 1000)
    const result = parseClaudeCodeOutput(stdout)
    return { text: result.text.slice(0, 64_000), sessionId: result.sessionId }
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.state, null, 2)
    const task = this.writeTail.catch(() => undefined).then(async () => {
      const temporary = join(this.root, `state-${process.pid}-${crypto.randomUUID()}.tmp`)
      try {
        await writeFile(temporary, snapshot, { encoding: 'utf8', mode: 0o600 })
        await rename(temporary, this.statePath)
      } finally {
        await rm(temporary, { force: true })
      }
    })
    this.writeTail = task.catch(() => undefined)
    return task
  }
}

export async function createCommonspaceHost(environment: CommonspaceHostEnvironment, config: CommonspaceHostConfig = {}): Promise<CommonspaceHostService> {
  const service = new CommonspaceHostService(environment, config)
  await service.initialize()
  return service
}
