import { execFile } from 'node:child_process'
import { chmod, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import type {
  AgentAdapterKind,
  CommonspaceAgentTrace,
  CommonspaceAgentDefinition,
  CommonspaceBootstrap,
  CommonspaceAgentProfile,
  CommonspaceMessage,
  CommonspaceMutation,
  CommonspaceState,
  CommonspaceTraceEntry,
  CommonspaceTracePlanStep,
  CommonspaceThread,
  SendMessageRequest,
  SendMessageResponse,
} from '@commonspace/shared'
import type { McpServer as AcpMcpServer } from '@agentclientprotocol/sdk'
import { COMMONSPACE_STATE_VERSION, conversationKey } from '@commonspace/shared'
import { projectChannelMemory } from './memory.js'
import { mentionedChannelAgents, parseHermesProfileList, routeChannelAgents } from './relay.js'
import { addDiscoveredAgent, applyMutation, createInitialState, defaultCommonspaceDefaults, defaultRunSettings, DM_SESSION_BOUNDARY_AUTHOR_ID, emptyChannelMemory, isCommonspaceReasoning, managedAgentId } from './state.js'
import { AcpAgentProcess, AcpSessionLoadError, AcpSessionRunError } from './acp-runtime.js'
import type { CommonspaceMcpGateway, CommonspaceMcpProvider, CommonspaceMcpScope } from './commonspace-mcp.js'

const execFileAsync = promisify(execFile)
const moduleRequire = createRequire(import.meta.url)
const MAX_MESSAGE_CHARS = 16_000
const MAX_PROFILE_LIST_BYTES = 1024 * 1024
const MAX_AGENT_RESPONSE_CHARS = 64_000
const MAX_MCP_CONTEXT_CHARS = 64_000
const MAX_MCP_CONTEXT_MESSAGES = 30
const MAX_MCP_CREDENTIALS = 10_000
const MAX_TRACE_ENTRIES = 128
const MAX_TRACE_CHARS = 256_000
const MANAGED_AGENT_ID_PATTERN = /^codex-[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u
const THREAD_SESSION_SCOPE_PATTERN = /^Commonspace Thread: [0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DM_SESSION_SCOPE_PATTERN = /^Commonspace DM: [0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface CommonspaceHostConfig {
  root?: string
  defaultCwd?: string
  hermesPath?: string
  codexPath?: string
  maxAgentsPerTurn?: number
  hermesYolo?: boolean
  externalAgentYolo?: boolean
  runBudgetSeconds?: number
  hermesAcpCommand?: string
  hermesAcpArgs?: readonly string[]
  codexAcpCommand?: string
  codexAcpArgs?: readonly string[]
}

export interface CommonspaceHostEnvironment {
  logger?: {
    warn(message: unknown): void
  }
}

export function unsafeModeForAdapter(config: CommonspaceHostConfig, adapter: AgentAdapterKind): boolean {
  return adapter === 'hermes'
    ? config.hermesYolo === true
    : config.externalAgentYolo === true
}

export interface AgentRunInput {
  agent: CommonspaceAgentProfile
  cwd: string
  additionalCwds: string[]
  sessionName: string
  /** The one newly delivered Commonspace message, without replayed context. */
  message: string
  commonspaceScope?: CommonspaceMcpScope
  sessionId?: string
  model?: string
  reasoning?: CommonspaceState['defaults']['reasoning']
}

export interface AgentRunResult {
  text: string
  sessionId?: string
  trace?: CommonspaceAgentTrace
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

interface AgentDelivery {
  authorType: 'user' | 'agent'
  authorId: string
  authorName: string
  text: string
}

function messageId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function isNativeSessionId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512) return false
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint <= 31 || codePoint === 127) return false
  }
  return true
}

function acpReasoningValue(adapter: AgentAdapterKind, reasoning: CommonspaceState['defaults']['reasoning'] | undefined): string | undefined {
  if (reasoning === undefined) return undefined
  if (adapter === 'codex') return reasoning === 'none' || reasoning === 'minimal' ? 'low' : reasoning
  return undefined
}

function sanitizeAgents(value: unknown): CommonspaceState['agents'] {
  if (!Array.isArray(value)) return []
  const agents: CommonspaceState['agents'] = []
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) continue
    const agent = candidate as Record<string, unknown>
    const adapter = agent.adapter
    if (adapter !== 'hermes' && adapter !== 'codex') continue
    if (typeof agent.id !== 'string') continue
    if (adapter === 'hermes') {
      if (agent.id.trim() !== agent.id || agent.id === '' || agent.id.length > 200 || /\s/u.test(agent.id)) continue
    } else if (!MANAGED_AGENT_ID_PATTERN.test(agent.id)) continue
    if (typeof agent.displayName !== 'string' || agent.displayName.trim() === '') continue
    if (agent.model !== null && typeof agent.model !== 'string') continue
    if (typeof agent.createdAt !== 'string') continue
    const displayName = agent.displayName.normalize('NFKC').trim().slice(0, 80)
    try {
      if (adapter !== 'hermes' && managedAgentId(adapter, displayName) !== agent.id) continue
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

function sanitizeDmSessions(value: unknown, allowedAgentIds: ReadonlySet<string>): CommonspaceState['dmSessions'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .filter((entry): entry is [string, string] => allowedAgentIds.has(entry[0]) && typeof entry[1] === 'string' && DM_SESSION_SCOPE_PATTERN.test(entry[1]))
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
      .filter((entry): entry is [string, string] => ((entry[0] === 'Bot Chat' && dmSessions[agentId] === undefined) || THREAD_SESSION_SCOPE_PATTERN.test(entry[0]) || dmSessions[agentId] === entry[0]) && isNativeSessionId(entry[1]))
      .slice(-500))
    if (Object.keys(scopes).length > 0) sessions[agentId] = scopes
  }
  return sessions
}

function isMissingNativeSession(error: unknown): boolean {
  if (error instanceof AcpSessionLoadError) return error.missing
  const message = error instanceof Error ? error.message : String(error)
  return /(?:invalid agent session id|no (?:saved )?(?:session|conversation|thread)|no rollout found for thread id|(?:session|conversation|thread).*(?:not found|does not exist|unknown)|failed to (?:load|resume).*(?:session|conversation|thread))/i.test(message)
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

function loadedString(value: unknown, maximum: number, defaultValue = ''): string {
  return typeof value === 'string' ? value.slice(0, maximum) : defaultValue
}

function loadedStringArray(value: unknown, maximumItems = 64, maximumLength = 2_000): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((candidate) => {
    if (typeof candidate !== 'string') return []
    const normalized = candidate.trim().slice(0, maximumLength)
    return normalized === '' ? [] : [normalized]
  }))].slice(0, maximumItems)
}

function loadedBoundedInteger(value: unknown, defaultValue: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.trunc(value)))
    : defaultValue
}

function loadedModel(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') return null
  const model = value.trim().slice(0, 200)
  return model === '' ? null : model
}

function sanitizeAgentTrace(value: unknown): CommonspaceAgentTrace | undefined {
  const trace = plainRecord(value)
  if (trace === null || (trace.adapter !== 'hermes' && trace.adapter !== 'codex')) return undefined
  const startedAt = loadedString(trace.startedAt, 100)
  const completedAt = loadedString(trace.completedAt, 100)
  if (startedAt === '' || completedAt === '' || !Array.isArray(trace.entries)) return undefined
  let remainingChars = MAX_TRACE_CHARS
  const take = (candidate: unknown, maximum: number): string => {
    if (remainingChars <= 0 || typeof candidate !== 'string') return ''
    const text = candidate.slice(0, Math.min(maximum, remainingChars))
    remainingChars -= text.length
    return text
  }
  const entries: CommonspaceTraceEntry[] = []
  const seen = new Set<string>()
  for (const candidate of trace.entries.slice(0, MAX_TRACE_ENTRIES)) {
    const entry = plainRecord(candidate)
    const type = entry?.type
    const id = loadedId(entry?.id)
    if (entry === null || id === null || (type !== 'reasoning' && type !== 'plan' && type !== 'tool' && type !== 'usage')) continue
    const normalizedId = type === 'usage' ? 'usage' : id
    const key = `${type}:${normalizedId}`
    if (seen.has(key)) continue
    const createdAt = loadedString(entry.createdAt, 100, startedAt)
    const updatedAt = loadedString(entry.updatedAt, 100, createdAt)
    if (type === 'reasoning') {
      const text = take(entry.text, 64_000)
      if (text === '') continue
      entries.push({ type, id: normalizedId, text, createdAt, updatedAt })
    } else if (type === 'plan') {
      const steps = Array.isArray(entry.steps)
        ? entry.steps.slice(0, 64).flatMap((rawStep) => {
            const step = plainRecord(rawStep)
            if (step === null || typeof step.text !== 'string') return []
            const text = take(step.text, 2_000)
            if (text === '') return []
            const priority: CommonspaceTracePlanStep['priority'] = step.priority === 'high' || step.priority === 'low' ? step.priority : 'medium'
            const status: CommonspaceTracePlanStep['status'] = step.status === 'in_progress' || step.status === 'completed' ? step.status : 'pending'
            return [{ text, priority, status }]
          })
        : []
      const markdown = take(entry.markdown, 64_000)
      entries.push({ type, id: normalizedId, steps, ...(markdown === '' ? {} : { markdown }), createdAt, updatedAt })
    } else if (type === 'tool') {
      const title = take(entry.title, 1_000).trim()
      const toolName = take(entry.toolName, 200).trim()
      const toolKind = take(entry.toolKind, 100).trim()
      const input = take(entry.input, 16_000)
      const output = take(entry.output, 32_000)
      const status = entry.status === 'in_progress' || entry.status === 'completed' || entry.status === 'failed'
        ? entry.status
        : 'pending'
      entries.push({
        type,
        id: normalizedId,
        title: title === '' ? 'Tool call' : title,
        ...(toolName === '' ? {} : { toolName }),
        ...(toolKind === '' ? {} : { toolKind }),
        status,
        ...(input === '' ? {} : { input }),
        ...(output === '' ? {} : { output }),
        createdAt,
        updatedAt,
      })
    } else {
      const usedTokens = loadedBoundedInteger(entry.usedTokens, 0, 0, Number.MAX_SAFE_INTEGER)
      const contextWindow = loadedBoundedInteger(entry.contextWindow, 0, 0, Number.MAX_SAFE_INTEGER)
      const costAmount = typeof entry.costAmount === 'number' && Number.isFinite(entry.costAmount) ? entry.costAmount : undefined
      const costCurrency = take(entry.costCurrency, 20).trim()
      entries.push({
        type: 'usage',
        id: 'usage',
        usedTokens,
        contextWindow,
        ...(costAmount === undefined ? {} : { costAmount }),
        ...(costCurrency === '' ? {} : { costCurrency }),
        createdAt,
        updatedAt,
      })
    }
    seen.add(key)
    if (remainingChars <= 0) break
  }
  return { adapter: trace.adapter, startedAt, completedAt, entries }
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
  agentIds: ReadonlySet<string>,
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
    if (kind === 'dm' && !agentIds.has(conversationId)) continue
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
      const trace = message.authorType === 'agent' ? sanitizeAgentTrace(message.trace) : undefined
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
        ...(trace === undefined ? {} : { trace }),
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
  if (record === null || (record.version !== 1 && record.version !== 2 && record.version !== 3 && record.version !== 4 && record.version !== 5 && record.version !== 6 && record.version !== 7 && record.version !== 8 && record.version !== COMMONSPACE_STATE_VERSION)) {
    return createInitialState()
  }
  const stateDefaults = defaultCommonspaceDefaults()
  const rawDefaults = plainRecord(record.defaults) ?? {}
  const defaults: CommonspaceState['defaults'] = {
    model: loadedModel(rawDefaults.model),
    reasoning: isCommonspaceReasoning(rawDefaults.reasoning) ? rawDefaults.reasoning : stateDefaults.reasoning,
    maxAgentsPerTurn: loadedBoundedInteger(rawDefaults.maxAgentsPerTurn, stateDefaults.maxAgentsPerTurn, 1, 8),
    memoryThreads: loadedBoundedInteger(rawDefaults.memoryThreads, stateDefaults.memoryThreads, 1, 50),
  }
  const projects = sanitizeProjects(record.projects)
  const agents = sanitizeAgents(record.agents)
  const agentIds = new Set(agents.map(agent => agent.id))
  let channels = sanitizeChannels(record.channels, new Set(projects.map(project => project.id)))
    .map(channel => ({ ...channel, agentIds: channel.agentIds.filter(agentId => agentIds.has(agentId)) }))
  const threads = sanitizeThreads(record.threads, channels)
    .map(thread => ({ ...thread, agentIds: thread.agentIds.filter(agentId => agentIds.has(agentId)) }))
  const threadIds = new Set(threads.map(thread => thread.id))
  channels = channels.map(channel => ({
    ...channel,
    memory: { ...channel.memory, threadIds: channel.memory.threadIds.filter(id => threadIds.has(id)) },
  }))
  const dmSessions = sanitizeDmSessions(record.dmSessions, agentIds)
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: loadedBoundedInteger(record.revision, 0, 0, Number.MAX_SAFE_INTEGER),
    defaults,
    agents,
    dmSessions,
    agentSessions: sanitizeAgentSessions(record.agentSessions, agentIds, dmSessions),
    projects,
    channels,
    threads,
    messages: sanitizeMessages(record.messages, new Set(channels.map(channel => channel.id)), agentIds, threads),
  }
}

export class CommonspaceHostService implements CommonspaceMcpProvider {
  readonly root: string
  private readonly statePath: string
  private readonly defaultCwd: string
  private state: CommonspaceState = createInitialState()
  private writeTail = Promise.resolve()
  private readonly agentSessionTails = new Map<string, Promise<unknown>>()
  private readonly revisionListeners = new Set<(revision: number) => void>()
  private readonly backgroundRuns = new Set<Promise<void>>()
  private activeAdmissions = 0
  private readonly admissionIdleWaiters = new Set<() => void>()
  private readonly acpProcesses = new Map<string, AcpAgentProcess>()
  private readonly activeAcpSessions = new Map<string, string>()
  private readonly mcpCredentials = new Map<string, { fingerprint: string; scope: CommonspaceMcpScope; token: string }>()
  private readonly hermesPath: string
  private readonly codexPath: string
  private readonly maxAgentsPerTurn: number
  private readonly hermesYolo: boolean
  private readonly externalAgentYolo: boolean
  private readonly runBudgetSeconds: number | undefined
  private readonly hermesAcpCommand: string
  private readonly hermesAcpArgs: string[]
  private readonly codexAcpCommand: string
  private readonly codexAcpArgs: string[]
  private closeOperation: Promise<void> | undefined
  private drainOperation: Promise<void> | undefined
  private closing = false
  private draining = false
  private mcpGateway: CommonspaceMcpGateway | undefined
  private mcpEndpoint: string | undefined

  constructor(
    private readonly environment: CommonspaceHostEnvironment,
    config: CommonspaceHostConfig = {},
    private readonly overrides: Partial<CommonspaceHostDependencies> = {},
  ) {
    this.root = config.root ?? join(homedir(), '.commonspace')
    this.statePath = join(this.root, 'state.json')
    this.defaultCwd = config.defaultCwd ?? process.cwd()
    this.hermesPath = config.hermesPath ?? 'hermes'
    this.codexPath = config.codexPath ?? 'codex'
    this.maxAgentsPerTurn = Math.max(1, Math.min(8, config.maxAgentsPerTurn ?? 6))
    this.hermesYolo = unsafeModeForAdapter(config, 'hermes')
    this.externalAgentYolo = unsafeModeForAdapter(config, 'codex')
    this.runBudgetSeconds = config.runBudgetSeconds === undefined
      ? undefined
      : Math.min(3_600, Math.max(30, config.runBudgetSeconds))
    this.hermesAcpCommand = config.hermesAcpCommand ?? this.hermesPath
    this.hermesAcpArgs = [...(config.hermesAcpArgs ?? [])]
    const defaultCodexAcp = moduleRequire.resolve('@agentclientprotocol/codex-acp')
    this.codexAcpCommand = config.codexAcpCommand ?? process.execPath
    this.codexAcpArgs = config.codexAcpArgs === undefined
      ? (config.codexAcpCommand === undefined ? [defaultCodexAcp] : [])
      : [...config.codexAcpArgs]
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    await chmod(this.root, 0o700)
    try {
      this.state = sanitizeLoadedState(JSON.parse(await readFile(this.statePath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.environment.logger?.warn(error)
      this.state = createInitialState()
    }
    this.state = await this.canonicalizeLoadedProjectPaths(this.state)
    this.state = this.redactLoadedTraces(this.state)
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
    this.markInterruptedRuns('The previous Commonspace process ended before the agent completed.')
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
          // Invalid persisted paths are dropped before they can reach an agent process.
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

  private async withAdmission<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closing) throw new Error('Commonspace is shutting down')
    if (this.draining) throw new Error('Commonspace is restarting')
    this.activeAdmissions += 1
    try {
      return await operation()
    } finally {
      this.activeAdmissions -= 1
      if (this.activeAdmissions === 0) {
        for (const resolveIdle of this.admissionIdleWaiters) resolveIdle()
        this.admissionIdleWaiters.clear()
      }
    }
  }

  private async whenAdmissionsIdle(): Promise<void> {
    if (this.activeAdmissions === 0) return
    await new Promise<void>(resolveIdle => { this.admissionIdleWaiters.add(resolveIdle) })
  }

  async whenIdle(): Promise<void> {
    while (this.backgroundRuns.size > 0) {
      await Promise.all([...this.backgroundRuns].map(operation => operation.catch(() => undefined)))
    }
  }

  async drainAndClose(): Promise<void> {
    this.drainOperation ??= (async () => {
      await this.whenIdle()
      this.draining = true
      await this.whenAdmissionsIdle()
      await this.whenIdle()
      await this.close()
    })()
    await this.drainOperation
  }

  async close(): Promise<void> {
    this.closing = true
    this.closeOperation ??= (async () => {
      const processes = [...this.acpProcesses.values()]
      this.acpProcesses.clear()
      this.activeAcpSessions.clear()
      await Promise.all(processes.map(processClient => processClient.close().catch(error => {
        this.environment.logger?.warn(error)
      })))
      await this.whenIdle()
      if (this.markInterruptedRuns('Commonspace shut down before the agent completed.')) {
        await this.persist()
        this.broadcastRevision()
      }
      await this.writeTail
      this.mcpCredentials.clear()
      await this.mcpGateway?.close()
    })()
    await this.closeOperation
  }

  attachMcpGateway(gateway: CommonspaceMcpGateway, endpoint: string): void {
    if (this.closing) throw new Error('Commonspace is shutting down')
    const url = new URL(endpoint)
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') {
      throw new Error('Commonspace MCP endpoint must use loopback HTTP')
    }
    if (this.mcpGateway !== undefined && (this.mcpGateway !== gateway || this.mcpEndpoint !== url.href)) {
      throw new Error('Commonspace MCP gateway is already attached')
    }
    this.mcpGateway = gateway
    this.mcpEndpoint = url.href
  }

  async readContext(scope: CommonspaceMcpScope): Promise<Record<string, unknown>> {
    const scoped = this.resolveMcpScope(scope)
    const messages = this.boundedMcpMessages(this.messagesForMcpScope(scope), MAX_MCP_CONTEXT_MESSAGES)
    const conversation = scoped.channel === undefined
      ? { kind: 'dm', id: scope.conversation.id, name: `Direct message with ${scoped.agent.displayName}` }
      : { kind: 'channel', id: scoped.channel.id, name: scoped.channel.name }
    return {
      agent: {
        id: scoped.agent.id,
        displayName: scoped.agent.displayName,
        adapter: scoped.agent.adapter,
      },
      conversation,
      ...(scoped.project === undefined ? {} : { project: { id: scoped.project.id, name: scoped.project.name } }),
      ...(scoped.thread === undefined
        ? {}
        : {
            thread: {
              id: scoped.thread.id,
              rootMessageId: scoped.thread.rootMessageId,
              status: scoped.thread.status,
            },
          }),
      instructions: scoped.channel?.instructions ?? '',
      memory: scoped.channel?.memory ?? { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
      participants: scoped.channel === undefined
        ? [{ id: scoped.agent.id, displayName: scoped.agent.displayName }]
        : scoped.channel.agentIds.flatMap(id => {
            const agent = this.state.agents.find(candidate => candidate.id === id)
            return agent === undefined ? [] : [{ id: agent.id, displayName: agent.displayName, adapter: agent.adapter }]
          }),
      messages,
    }
  }

  async readMessages(scope: CommonspaceMcpScope, input: { before?: string; limit: number }): Promise<Record<string, unknown>> {
    this.resolveMcpScope(scope)
    const source = this.messagesForMcpScope(scope)
    const end = input.before === undefined ? source.length : source.findIndex(message => message.id === input.before)
    if (end < 0) throw new Error('message cursor is not in this Commonspace scope')
    const limit = Math.max(1, Math.min(100, Math.trunc(input.limit)))
    const pageSource = source.slice(Math.max(0, end - limit), end)
    const messages = this.boundedMcpMessages(pageSource, limit)
    const firstId = messages[0]?.id
    const firstIndex = firstId === undefined ? end : source.findIndex(message => message.id === firstId)
    return { messages, nextBefore: firstIndex > 0 ? firstId : null }
  }

  async postProgress(scope: CommonspaceMcpScope, rawText: string): Promise<{ messageId: string }> {
    if (this.closing) throw new Error('Commonspace is shutting down')
    const scoped = this.resolveMcpScope(scope)
    const text = rawText.normalize('NFKC').trim().slice(0, 4_000)
    if (text === '') throw new Error('progress text is required')
    if (scoped.channel !== undefined) {
      const peerMentions = mentionedChannelAgents(scoped.channel.agentIds, text, this.configuredAgents())
        .filter(agentId => agentId !== scoped.agent.id)
      if (peerMentions.length > 0) throw new Error('post progress cannot address peers; use the final reply for a routed handoff')
    }
    const message: CommonspaceMessage = {
      id: messageId(),
      conversation: scope.conversation,
      authorType: 'agent',
      authorId: scoped.agent.id,
      authorName: scoped.agent.displayName,
      text,
      createdAt: now(),
      ...(scoped.thread === undefined ? {} : { threadId: scoped.thread.id, parentMessageId: scoped.thread.rootMessageId }),
    }
    this.append(message)
    await this.persist()
    this.broadcastRevision()
    return { messageId: message.id }
  }

  async bootstrap(): Promise<CommonspaceBootstrap> {
    const discoveredAgents = await this.discoverAgentCandidates()
    return {
      agents: this.configuredAgents(discoveredAgents),
      discoveredAgents,
      state: this.publicSnapshot(),
    }
  }

  private resolveMcpScope(scope: CommonspaceMcpScope): {
    agent: CommonspaceAgentDefinition
    channel?: CommonspaceState['channels'][number]
    thread?: CommonspaceThread
    project?: CommonspaceState['projects'][number]
  } {
    const agent = this.state.agents.find(candidate => candidate.id === scope.agentId)
    if (agent === undefined) throw new Error('Commonspace MCP agent scope expired')
    if (scope.conversation.kind === 'dm') {
      if (scope.conversation.id !== agent.id || scope.threadId !== undefined) throw new Error('invalid Commonspace MCP direct-message scope')
      const currentSessionName = this.state.dmSessions[agent.id] ?? 'Bot Chat'
      if (scope.sessionName !== currentSessionName) throw new Error('Commonspace MCP direct-message generation expired')
      const project = scope.projectId === undefined
        ? undefined
        : this.state.projects.find(candidate => candidate.id === scope.projectId)
      if (scope.projectId !== undefined && project === undefined) throw new Error('Commonspace MCP project scope expired')
      return { agent, ...(project === undefined ? {} : { project }) }
    }

    const channel = this.state.channels.find(candidate => candidate.id === scope.conversation.id)
    if (channel === undefined || scope.threadId === undefined) throw new Error('Commonspace MCP channel scope expired')
    const thread = this.state.threads.find(candidate => candidate.id === scope.threadId && candidate.channelId === channel.id)
    if (thread === undefined || !thread.agentIds.includes(agent.id)) throw new Error('Commonspace MCP thread scope expired')
    if (scope.sessionName !== `Commonspace Thread: ${thread.id}`) throw new Error('invalid Commonspace MCP native-session scope')
    if (scope.projectId !== undefined && scope.projectId !== channel.projectId) throw new Error('invalid Commonspace MCP project scope')
    const project = channel.projectId === null
      ? undefined
      : this.state.projects.find(candidate => candidate.id === channel.projectId)
    if (channel.projectId !== null && project === undefined) throw new Error('Commonspace MCP project scope expired')
    return { agent, channel, thread, ...(project === undefined ? {} : { project }) }
  }

  private revokeInvalidMcpCredentials(): void {
    if (this.mcpGateway === undefined) return
    for (const [key, credential] of this.mcpCredentials) {
      try {
        this.resolveMcpScope(credential.scope)
      } catch {
        this.mcpGateway.revoke(credential.token)
        this.mcpCredentials.delete(key)
      }
    }
  }

  private messagesForMcpScope(scope: CommonspaceMcpScope): CommonspaceMessage[] {
    const messages = this.state.messages[conversationKey(scope.conversation)] ?? []
    const boundedToNativeSession = scope.conversation.kind === 'dm'
      ? messages.slice(messages.findLastIndex(message => message.authorId === DM_SESSION_BOUNDARY_AUTHOR_ID) + 1)
      : messages
    return scope.threadId === undefined ? boundedToNativeSession : boundedToNativeSession.filter(message => message.threadId === scope.threadId)
  }

  private boundedMcpMessages(source: readonly CommonspaceMessage[], limit: number): Array<Record<string, unknown> & { id: string }> {
    const selected: CommonspaceMessage[] = []
    let chars = 0
    for (let index = source.length - 1; index >= 0 && selected.length < limit; index -= 1) {
      const message = source[index]
      if (message === undefined) continue
      const nextChars = chars + message.text.length
      if (nextChars > MAX_MCP_CONTEXT_CHARS && selected.length > 0) break
      selected.push(message)
      chars = nextChars
    }
    return selected.reverse().map(message => ({
      id: message.id,
      authorType: message.authorType,
      authorId: message.authorId,
      authorName: message.authorName,
      text: message.text.slice(0, MAX_MCP_CONTEXT_CHARS),
      createdAt: message.createdAt,
      ...(message.parentMessageId === undefined ? {} : { parentMessageId: message.parentMessageId }),
    }))
  }

  private redactHostDetails(value: string, maximum: number): string {
    let message = value
    const redactions = new Map<string, string>()
    const hostPaths = [
      this.root,
      homedir(),
      process.cwd(),
      this.defaultCwd,
      this.hermesPath,
      this.codexPath,
      this.hermesAcpCommand,
      this.codexAcpCommand,
      ...this.hermesAcpArgs,
      ...this.codexAcpArgs,
      ...this.state.projects.flatMap(project => project.paths),
    ]
    for (const path of hostPaths) {
      if (isAbsolute(path)) redactions.set(path, '[host path]')
    }
    for (const sessions of Object.values(this.state.agentSessions)) {
      for (const sessionId of Object.values(sessions)) redactions.set(sessionId, '[native session]')
    }
    for (const credential of this.mcpCredentials.values()) {
      redactions.set(credential.token, '[MCP capability]')
    }
    for (const [privateValue, replacement] of [...redactions].sort(([left], [right]) => right.length - left.length)) {
      message = message.replaceAll(privateValue, replacement)
    }
    return message.slice(0, maximum)
  }

  private publicAgentFailure(error: unknown): string {
    let message = error instanceof Error ? error.message : String(error)
    if (error instanceof AcpSessionLoadError || error instanceof AcpSessionRunError) {
      message = message.replaceAll(error.sessionId, '[native session]')
    }
    return this.redactHostDetails(message, 8_000)
  }

  private publicAgentTrace(value: unknown, adapter: AgentAdapterKind): CommonspaceAgentTrace | undefined {
    const trace = sanitizeAgentTrace({ ...(plainRecord(value) ?? {}), adapter })
    if (trace === undefined) return undefined
    const entries = trace.entries.map((entry): CommonspaceTraceEntry => {
      if (entry.type === 'reasoning') {
        return { ...entry, text: this.redactHostDetails(entry.text, 64_000) }
      }
      if (entry.type === 'plan') {
        return {
          ...entry,
          steps: entry.steps.map(step => ({ ...step, text: this.redactHostDetails(step.text, 2_000) })),
          ...(entry.markdown === undefined ? {} : { markdown: this.redactHostDetails(entry.markdown, 64_000) }),
        }
      }
      if (entry.type === 'tool') {
        return {
          ...entry,
          title: this.redactHostDetails(entry.title, 1_000),
          ...(entry.toolName === undefined ? {} : { toolName: this.redactHostDetails(entry.toolName, 200) }),
          ...(entry.toolKind === undefined ? {} : { toolKind: this.redactHostDetails(entry.toolKind, 100) }),
          ...(entry.input === undefined ? {} : { input: this.redactHostDetails(entry.input, 16_000) }),
          ...(entry.output === undefined ? {} : { output: this.redactHostDetails(entry.output, 32_000) }),
        }
      }
      return entry
    })
    return { ...trace, entries }
  }

  private redactLoadedTraces(state: CommonspaceState): CommonspaceState {
    const messages = Object.fromEntries(Object.entries(state.messages).map(([key, conversationMessages]) => [
      key,
      conversationMessages.map((message) => {
        if (message.trace === undefined) return message
        const trace = this.publicAgentTrace(message.trace, message.trace.adapter)
        const sanitized: CommonspaceMessage = { ...message }
        if (trace === undefined) delete sanitized.trace
        else sanitized.trace = trace
        return sanitized
      }),
    ]))
    return { ...state, messages }
  }

  private markInterruptedRuns(replyError: string): boolean {
    let changed = false
    const messages = Object.fromEntries(Object.entries(this.state.messages).map(([key, conversationMessages]) => [
      key,
      conversationMessages.map((message) => {
        if (message.replyStatus !== 'queued' && message.replyStatus !== 'running') return message
        changed = true
        return { ...message, replyStatus: 'error' as const, replyError }
      }),
    ]))
    const threads = this.state.threads.map((thread) => {
      if (thread.status !== 'queued' && thread.status !== 'running') return thread
      changed = true
      return { ...thread, status: 'error' as const, error: replyError, updatedAt: now() }
    })
    if (changed) {
      this.state = { ...this.state, revision: this.state.revision + 1, messages, threads }
    }
    return changed
  }

  async mutate(mutation: CommonspaceMutation): Promise<CommonspaceState> {
    return this.withAdmission(async () => {
      const resetScope = mutation.action === 'reset-dm' && typeof mutation.agentId === 'string'
        ? `${mutation.agentId}\u0000${this.state.dmSessions[mutation.agentId] ?? 'Bot Chat'}`
        : undefined
      const activeResetSession = resetScope === undefined ? undefined : this.activeAcpSessions.get(resetScope)
      const removedChannelSessionNames = mutation.action === 'remove-channel'
        ? new Set(this.state.threads
            .filter(thread => thread.channelId === mutation.channelId)
            .map(thread => `Commonspace Thread: ${thread.id}`))
        : undefined
      const activeRemovedChannelSessions = removedChannelSessionNames === undefined
        ? []
        : [...this.activeAcpSessions.entries()].flatMap(([key, sessionId]) => {
            const separator = key.indexOf('\u0000')
            if (separator < 1 || !removedChannelSessionNames.has(key.slice(separator + 1))) return []
            return [{ key, agentId: key.slice(0, separator), sessionId }]
          })
      if (mutation.action === 'add-discovered-agent') {
        if (typeof mutation.agentId !== 'string') throw new Error('discovered agent id is required')
        const agent = (await this.discoverAgentCandidates()).find(candidate => candidate.id === mutation.agentId)
        if (agent === undefined) throw new Error('unknown discovered agent')
        this.state = addDiscoveredAgent(this.state, agent)
      } else {
        const normalized = await this.normalizeMutation(mutation)
        this.state = applyMutation(this.state, normalized)
      }
      this.revokeInvalidMcpCredentials()
      if (mutation.action === 'remove-agent') {
        const processClient = this.acpProcesses.get(mutation.agentId)
        this.acpProcesses.delete(mutation.agentId)
        for (const key of this.activeAcpSessions.keys()) {
          if (key.startsWith(`${mutation.agentId}\u0000`)) this.activeAcpSessions.delete(key)
        }
        await processClient?.close()
      } else if (mutation.action === 'reset-dm' && activeResetSession !== undefined) {
        await this.acpProcesses.get(mutation.agentId)?.cancelSession(activeResetSession)
      } else if (mutation.action === 'remove-channel') {
        await Promise.all(activeRemovedChannelSessions.map(async ({ key, agentId, sessionId }) => {
          if (this.activeAcpSessions.get(key) === sessionId) this.activeAcpSessions.delete(key)
          await this.acpProcesses.get(agentId)?.cancelSession(sessionId)
        }))
      }
      await this.persist()
      this.broadcastRevision()
      return this.publicSnapshot()
    })
  }

  async send(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.withAdmission(async () => {
      const prepared = await this.prepareSend(request)
      await this.overrides.beforeAcceptSend?.(prepared)
      const response = await this.acceptSend(prepared)
      const operation = this.processReplies(prepared, response)
      this.backgroundRuns.add(operation)
      void operation.finally(() => {
        this.backgroundRuns.delete(operation)
      }).catch(() => undefined)
      return response
    })
  }

  subscribeToRevisions(listener: (revision: number) => void): () => void {
    this.revisionListeners.add(listener)
    return () => { this.revisionListeners.delete(listener) }
  }

  private async prepareSend(request: SendMessageRequest): Promise<PreparedSend> {
    const text = request.text.normalize('NFKC').trim().slice(0, MAX_MESSAGE_CHARS)
    if (text === '') throw new Error('message text is required')
    const agents = this.configuredAgents(await this.discoverAgentCandidates())
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
    const cwd = prepared.project?.paths[0] ?? this.defaultCwd
    const effectiveLimit = Math.min(this.maxAgentsPerTurn, this.state.defaults.maxAgentsPerTurn)
    const effectiveModel = prepared.channel?.settings.model ?? this.state.defaults.model ?? undefined
    const effectiveReasoning = prepared.channel?.settings.reasoning ?? this.state.defaults.reasoning
    const memberIds = prepared.channel?.agentIds ?? thread?.agentIds ?? prepared.agentIds
    const delivered = new Set<string>()
    const rootDelivery: AgentDelivery = {
      authorType: 'user',
      authorId: response.accepted.authorId,
      authorName: response.accepted.authorName,
      text: response.accepted.text,
    }

    const deliver = async (agentId: string, delivery: AgentDelivery): Promise<void> => {
      if (delivered.has(agentId) || delivered.size >= effectiveLimit) return
      delivered.add(agentId)
      const agent = prepared.agents.find(candidate => candidate.id === agentId)
      if (agent === undefined) return
      const authority = this.agentAuthority(agent)
      if (authority === undefined) return
      const executionIsCurrent = () => !this.closing && this.agentAuthorityIsCurrent(agent, authority) && this.conversationIsCurrent(prepared, thread)
      const sessionName = prepared.request.conversation.kind === 'dm'
        ? prepared.dmSessionName ?? 'Bot Chat'
        : `Commonspace Thread: ${thread?.id ?? crypto.randomUUID()}`
      const sessionId = this.state.agentSessions[agent.id]?.[sessionName]
      const agentModel = effectiveModel ?? (agent.adapter === 'hermes' ? undefined : agent.model ?? undefined)
      let agentResponse: AgentRunResult | null
      try {
        agentResponse = await this.withAgentSessionLock(agent.id, sessionName, async () => {
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
            message: delivery.text,
            commonspaceScope: {
              agentId: agent.id,
              conversation: prepared.request.conversation,
              sessionName,
              ...(thread === undefined ? {} : { threadId: thread.id }),
              ...(prepared.project === undefined ? {} : { projectId: prepared.project.id }),
            },
            ...(sessionId === undefined ? {} : { sessionId }),
            ...(agentModel === undefined ? {} : { model: agentModel }),
            reasoning: effectiveReasoning,
          }, executionIsCurrent)
        })
      } catch (error) {
        if (!executionIsCurrent()) return
        const message = this.publicAgentFailure(error)
        if (prepared.request.conversation.kind === 'dm') {
          this.updateMessageReplyStatus(prepared.request.conversation, response.accepted.id, 'error', message)
        }
        this.append({
          id: messageId(),
          conversation: prepared.request.conversation,
          authorType: 'system',
          authorId: 'system',
          authorName: 'Commonspace',
          text: `@${agent.id} run failed: ${message}`,
          createdAt: now(),
          ...(thread === undefined ? {} : { threadId: thread.id, parentMessageId: thread.rootMessageId }),
        })
        await this.persist()
        this.broadcastRevision()
        return
      }
      if (agentResponse === null || !executionIsCurrent()) return
      if (agentResponse.sessionId !== undefined) this.rememberAgentSession(agent.id, sessionName, agentResponse.sessionId)
      if (prepared.request.conversation.kind === 'dm') {
        this.updateMessageReplyStatus(prepared.request.conversation, response.accepted.id, 'complete')
      }
      const trace = agentResponse.trace === undefined
        ? undefined
        : this.publicAgentTrace(agentResponse.trace, agent.adapter)
      const reply: CommonspaceMessage = {
        id: messageId(),
        conversation: prepared.request.conversation,
        authorType: 'agent',
        authorId: agent.id,
        authorName: agent.displayName,
        text: agentResponse.text,
        createdAt: now(),
        ...(trace === undefined ? {} : { trace }),
        ...(thread === undefined ? {} : { threadId: thread.id, parentMessageId: thread.rootMessageId }),
      }
      this.append(reply)
      await this.persist()
      this.broadcastRevision()
      if (prepared.request.conversation.kind === 'channel') {
        const handoffs = mentionedChannelAgents(memberIds, reply.text, prepared.agents)
          .filter(id => !delivered.has(id))
        await Promise.all(handoffs.map(id => deliver(id, {
          authorType: 'agent',
          authorId: agent.id,
          authorName: agent.displayName,
          text: reply.text,
        })))
      }
    }

    await Promise.all(prepared.agentIds.slice(0, effectiveLimit).map(agentId => deliver(agentId, rootDelivery)))
    if (!this.closing && thread !== undefined && this.conversationIsCurrent(prepared, thread)) {
      await this.setThreadStatus(thread.id, 'complete')
      await this.updateChannelMemory(thread.channelId)
    }
  }

  private agentAuthority(agent: CommonspaceAgentProfile): CommonspaceAgentDefinition | undefined {
    return this.state.agents.find(candidate => candidate.id === agent.id && candidate.adapter === agent.adapter)
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
    authority: CommonspaceAgentDefinition | undefined,
  ): boolean {
    return authority !== undefined && this.state.agents.find(candidate => candidate.id === agent.id) === authority
  }

  private async withAgentSessionLock<T>(agentId: string, sessionName: string, task: () => Promise<T>): Promise<T> {
    const key = `${agentId}\u0000${sessionName}`
    const previous = this.agentSessionTails.get(key) ?? Promise.resolve()
    const operation = previous.catch(() => undefined).then(task)
    this.agentSessionTails.set(key, operation)
    void operation.finally(() => {
      if (this.agentSessionTails.get(key) === operation) this.agentSessionTails.delete(key)
    }).catch(() => undefined)
    return operation
  }

  private rememberAgentSession(agentId: string, sessionName: string, sessionId: string): void {
    if (!isNativeSessionId(sessionId)) throw new Error('agent returned an invalid session id')
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
      const conflict = (await this.discoverAgentCandidates()).some(agent => agent.id === id)
      if (conflict) throw new Error(`agent ${mutation.displayName.trim()} conflicts with a Hermes profile`)
    }
    if (mutation.action === 'reset-dm') {
      if (typeof mutation.agentId !== 'string' || !this.configuredAgents().some(agent => agent.id === mutation.agentId)) {
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

  private async discoverAgentCandidates(): Promise<CommonspaceAgentProfile[]> {
    let discovered: CommonspaceAgentProfile[] = []
    if (this.overrides.discoverAgents !== undefined) {
      discovered = await this.overrides.discoverAgents()
    } else {
      try {
        const { stdout } = await execFileAsync(this.hermesPath, ['profile', 'list'], {
          maxBuffer: MAX_PROFILE_LIST_BYTES,
          timeout: 30_000,
          encoding: 'utf8',
        })
        discovered = parseHermesProfileList(stdout)
      } catch (error) {
        this.environment.logger?.warn(`Commonspace could not discover Hermes profiles: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const unique = new Map<string, CommonspaceAgentProfile>()
    for (const agent of discovered) {
      if (agent.adapter === 'hermes' && !unique.has(agent.id)) unique.set(agent.id, agent)
    }
    return [...unique.values()]
  }

  private configuredAgents(discoveredAgents: CommonspaceAgentProfile[] = []): CommonspaceAgentProfile[] {
    const discoveredById = new Map(discoveredAgents.map(agent => [agent.id, agent]))
    return this.state.agents.map<CommonspaceAgentProfile>((agent) => {
      if (agent.adapter === 'hermes') {
        const discovered = discoveredById.get(agent.id)
        if (discovered?.adapter === 'hermes') return discovered
      }
      return {
        id: agent.id,
        displayName: agent.displayName,
        adapter: agent.adapter,
        model: agent.model,
        status: 'unknown',
      }
    })
  }

  private async runAgent(input: AgentRunInput): Promise<AgentRunResult> {
    if (this.overrides.runAgent !== undefined) {
      const result = await this.overrides.runAgent(input)
      return typeof result === 'string' ? { text: result } : result
    }
    return this.runAcpAgent(input)
  }

  private async runAcpAgent(input: AgentRunInput): Promise<AgentRunResult> {
    const mcpServers = this.mcpServersFor(input)
    const reasoning = acpReasoningValue(input.agent.adapter, input.reasoning)
    const configOptions: Record<string, string> = {
      ...(input.model === undefined || input.agent.adapter === 'hermes' ? {} : { model: input.model }),
      ...(reasoning === undefined
        ? {}
        : { reasoning_effort: reasoning }),
    }
    let processClient = this.acpProcesses.get(input.agent.id)
    if (processClient === undefined) {
      const hermes = input.agent.adapter === 'hermes'
      processClient = new AcpAgentProcess({
        command: hermes ? this.hermesAcpCommand : this.codexAcpCommand,
        args: hermes
          ? [...this.hermesAcpArgs, '-p', input.agent.id, 'acp', ...(this.hermesYolo ? ['--accept-hooks'] : [])]
          : this.codexAcpArgs,
        cwd: input.cwd,
        env: hermes
          ? { ...process.env, NO_BROWSER: '1' }
          : {
              ...process.env,
              CODEX_PATH: this.codexPath,
              INITIAL_AGENT_MODE: this.externalAgentYolo ? 'agent-full-access' : 'agent',
              NO_BROWSER: '1',
            },
        requestTimeoutMs: ((this.runBudgetSeconds ?? 3_600) + 30) * 1000,
        maxResponseChars: MAX_AGENT_RESPONSE_CHARS,
        clientName: `commonspace-${input.agent.id}`,
      })
      this.acpProcesses.set(input.agent.id, processClient)
    }
    const activeScopeKey = `${input.agent.id}\u0000${input.sessionName}`
    let activeSessionId: string | undefined
    try {
      const result = await processClient.run({
        cwd: input.cwd,
        additionalCwds: input.additionalCwds,
        message: input.message,
        mcpServers,
        modeId: input.agent.adapter === 'hermes'
          ? (this.hermesYolo ? 'dont_ask' : 'accept_edits')
          : (this.externalAgentYolo ? 'agent-full-access' : 'agent'),
        ...(input.agent.adapter === 'hermes' && input.model !== undefined ? { modelId: input.model } : {}),
        configOptions,
        onSessionReady: sessionId => {
          activeSessionId = sessionId
          this.activeAcpSessions.set(activeScopeKey, sessionId)
        },
        ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      })
      if (result.text.trim() === '') throw new Error(`${input.agent.displayName} returned no response`)
      return {
        sessionId: result.sessionId,
        text: result.text,
        ...(result.trace === undefined
          ? {}
          : { trace: { adapter: input.agent.adapter, ...result.trace } }),
      }
    } catch (error) {
      if (this.acpProcesses.get(input.agent.id) === processClient && error instanceof Error && /(?:exited|not connected|timed out)/i.test(error.message)) {
        this.acpProcesses.delete(input.agent.id)
        await processClient.close().catch(() => undefined)
      }
      throw error
    } finally {
      if (activeSessionId !== undefined && this.activeAcpSessions.get(activeScopeKey) === activeSessionId) {
        this.activeAcpSessions.delete(activeScopeKey)
      }
    }
  }

  private mcpServersFor(input: AgentRunInput): AcpMcpServer[] {
    if (this.mcpGateway === undefined || this.mcpEndpoint === undefined || input.commonspaceScope === undefined) return []
    const scope: CommonspaceMcpScope = {
      ...input.commonspaceScope,
      agentId: input.agent.id,
      sessionName: input.sessionName,
    }
    const key = `${input.agent.id}\u0000${input.sessionName}`
    const fingerprint = JSON.stringify(scope)
    let credential = this.mcpCredentials.get(key)
    if (credential?.fingerprint !== fingerprint || (credential !== undefined && !this.mcpGateway.has(credential.token))) {
      if (credential !== undefined) {
        this.mcpGateway.revoke(credential.token)
        this.mcpCredentials.delete(key)
      }
      while (this.mcpCredentials.size >= MAX_MCP_CREDENTIALS) {
        const oldest = this.mcpCredentials.entries().next().value as [string, { token: string }] | undefined
        if (oldest === undefined) break
        this.mcpCredentials.delete(oldest[0])
        this.mcpGateway.revoke(oldest[1].token)
      }
      const issued = this.mcpGateway.issue(scope)
      credential = { fingerprint, scope: structuredClone(scope), token: issued.token }
      this.mcpCredentials.set(key, credential)
    }
    return [{
      type: 'http',
      name: 'commonspace',
      url: this.mcpEndpoint,
      headers: [{ name: 'Authorization', value: `Bearer ${credential.token}` }],
    }]
  }

  private async runAgentWithSessionRecovery(
    input: AgentRunInput,
    shouldContinue: () => boolean,
  ): Promise<AgentRunResult | null> {
    try {
      return await this.runAgent(input)
    } catch (error) {
      if (input.sessionId === undefined || !isMissingNativeSession(error)) throw error
      if (!shouldContinue()) return null
      this.forgetAgentSession(input.agent.id, input.sessionName, input.sessionId)
      if (!shouldContinue()) return null
      const replacement = { ...input }
      delete replacement.sessionId
      return this.runAgent(replacement)
    }
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
