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
  CommonspaceAgentConfiguration,
  CommonspaceBootstrap,
  CommonspaceChannelMemory,
  CommonspaceAgentProfile,

  CommonspaceImageAttachment,
  CommonspaceImageMimeType,
  CommonspaceMessage,
  CommonspaceMutation,
  CommonspaceRoutingConfiguration,
  CommonspaceRoutingDecision,
  CommonspaceRunAttribution,
  CommonspaceRunFileChange,
  CommonspaceRunRootAttribution,
  CommonspaceState,
  CommonspaceLiveAgentActivity,
  CommonspaceQueuedFollowup,
  CommonspaceTraceEntry,
  CommonspaceTracePlanStep,
  CommonspaceThread,
  SendMessageRequest,
  SendMessageResponse,
  ReorderFollowupRequest,
  RemoveFollowupRequest,
  FollowupQueueResponse,
  StopAgentRunsRequest,
  StopAgentRunsResponse,
  UpdateAgentConfigurationRequest,
  UpdateChannelContextRequest,
  UpdateRoutingConfigurationRequest,
} from '@commonspace/shared'
import type { McpServer as AcpMcpServer } from '@agentclientprotocol/sdk'
import { COMMONSPACE_STATE_VERSION, conversationKey, projectTagName, referencedProjectIds, uniqueAgentDisplayName } from '@commonspace/shared'
import { mergeChannelMemoryProjection, projectChannelMemory } from './memory.js'
import { mentionedAgents, mentionedChannelAgents, parseHermesProfileDescription, parseHermesProfileList, parseTags, rankChannelAgents } from './relay.js'
import { addDiscoveredAgent, applyMutation, createInitialState, defaultCommonspaceDefaults, defaultRunSettings, DM_SESSION_BOUNDARY_AUTHOR_ID, emptyChannelMemory, isCommonspaceReasoning, managedAgentId } from './state.js'
import { AcpAgentProcess, AcpSessionLoadError, AcpSessionRunError } from './acp-runtime.js'
import { codexProfileRuntimeConfig, discoverCodexAgents, findCodexAgentProfile, type CodexAgentProfileConfig } from './codex-agents.js'
import { inspectAgentConfiguration, updateAgentConfiguration as updateNativeAgentConfiguration } from './agent-configuration.js'
import type { CommonspaceMcpGateway, CommonspaceMcpProvider, CommonspaceMcpScope } from './commonspace-mcp.js'
import { buildRoutingPrompt, completeWithOpenAICompatible, parseRoutingResponse } from './ai-router.js'
import { buildChannelContextCompactionPrompt, inferredChannelMemory, parseChannelContextCompaction } from './context.js'

import { captureRunSnapshot, completeRunAttribution, type RunSnapshot } from './run-attribution.js'

const execFileAsync = promisify(execFile)
const moduleRequire = createRequire(import.meta.url)
const MAX_MESSAGE_CHARS = 16_000
const MAX_IMAGE_ATTACHMENTS = 4
const MAX_IMAGE_ATTACHMENT_BYTES = 8 * 1024 * 1024
const MAX_IMAGE_ATTACHMENTS_BYTES = 16 * 1024 * 1024
const MAX_PROFILE_LIST_BYTES = 1024 * 1024
const MAX_AGENT_RESPONSE_CHARS = 64_000
const MAX_MCP_CONTEXT_CHARS = 64_000

const MAX_MCP_CONTEXT_MESSAGES = 30
const MAX_MCP_CREDENTIALS = 10_000
const MAX_MCP_SEARCH_SNIPPET_CHARS = 500
const MAX_TRACE_ENTRIES = 128
const MAX_TRACE_CHARS = 256_000
const DEFAULT_ROUTING_BASE_URL = 'https://api.openai.com/v1'
const SHARED_CONTEXT_PRESSURE_TOKENS = 24_000
const MANAGED_AGENT_ID_PATTERN = /^codex-[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u

function searchSnippet(text: string, includedTerms: readonly string[]): string {
  if (text.length <= MAX_MCP_SEARCH_SNIPPET_CHARS) return text
  const searchable = text.normalize('NFKC').toLocaleLowerCase()
  const matchIndex = includedTerms
    .map(term => searchable.indexOf(term))
    .filter(index => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0
  const start = Math.max(0, matchIndex - Math.floor(MAX_MCP_SEARCH_SNIPPET_CHARS / 3))
  const prefix = start > 0 ? '…' : ''
  const needsSuffix = text.length > start + MAX_MCP_SEARCH_SNIPPET_CHARS - prefix.length
  const suffix = needsSuffix ? '…' : ''
  return `${prefix}${text.slice(start, start + MAX_MCP_SEARCH_SNIPPET_CHARS - prefix.length - suffix.length)}${suffix}`
}
const THREAD_SESSION_SCOPE_PATTERN = /^Commonspace Thread: [0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DM_SESSION_SCOPE_PATTERN = /^Commonspace DM: [0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IMAGE_ATTACHMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IMAGE_MIME_TYPES = new Set<CommonspaceImageMimeType>(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

function completedReplyStatus(text: string): 'complete' | 'needs_input' | 'silent' {
  const value = text.trim()
  if (value === '') return 'silent'
  if (/\?\s*$/u.test(value) || /\b(?:need|needs|waiting for|please provide|can you|could you)\b[^.!?]*[?.!]\s*$/iu.test(value)) {
    return 'needs_input'
  }
  return 'complete'
}

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
  images?: readonly AgentImageInput[]
  commonspaceScope?: CommonspaceMcpScope
  sessionId?: string
  model?: string
  reasoning?: CommonspaceState['defaults']['reasoning']
  onTraceUpdate?: (entries: readonly CommonspaceTraceEntry[]) => void
  /** Aborted when the user stops the Commonspace message that initiated this run. */
  signal: AbortSignal
}

export interface AgentImageInput {
  name: string
  mimeType: CommonspaceImageMimeType
  data: string
}

export interface AgentRunResult {
  text: string
  sessionId?: string
  trace?: CommonspaceAgentTrace
}

export interface CommonspaceHostDependencies {
  discoverAgents(): Promise<CommonspaceAgentProfile[]>
  runAgent(input: AgentRunInput): Promise<string | AgentRunResult>
  routeAgents(input: CommonspaceRouteInput): Promise<CommonspaceRouteResult>
  beforeAcceptSend?(prepared: PreparedSend): Promise<void>
}

export interface CommonspaceRouteInput {
  text: string
  context: string[]
  candidates: Array<Pick<CommonspaceAgentProfile, 'id' | 'displayName' | 'description'> & {
    routingScore: number
    matchedTerms: string[]
  }>
  maxAgents: number
}

export interface CommonspaceRouteResult {
  agentIds: string[]
  confidence?: number
  reason: string
}

interface PreparedSend {
  request: SendMessageRequest
  text: string
  attachments: PreparedImageAttachment[]

  agents: CommonspaceAgentProfile[]
  agentIds: string[]
  routing?: CommonspaceRoutingDecision
  channel?: CommonspaceState['channels'][number]
  projects: CommonspaceState['projects']
  /** Compatibility primary Project while singular consumers are migrated. */
  project?: CommonspaceState['projects'][number]
  thread?: CommonspaceThread
  dmSessionName?: string
}

interface PrivateRoutingConfiguration extends Omit<CommonspaceRoutingConfiguration, 'apiKeyConfigured'> {
  apiKey?: string
}

interface PreparedImageAttachment {
  metadata: CommonspaceImageAttachment
  data: Buffer
}


interface AgentDelivery {
  authorType: 'user' | 'agent'
  authorId: string
  authorName: string
  text: string
  images?: readonly AgentImageInput[]

}

interface ActiveAgentRun {
  id: string
  sourceMessageId: string
  agentId: string
  scopeKey: string
  abortController: AbortController
}

interface PendingFollowup {
  prepared: PreparedSend
  response: SendMessageResponse
  delivery: NonNullable<SendMessageRequest['delivery']>
}

function messageId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function sameProjectSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every(projectId => right.includes(projectId))
}

function projectReferenceFields(projects: readonly CommonspaceState['projects'][number][]): Pick<CommonspaceMessage, 'projectIds' | 'projectId'> {
  const projectIds = projects.map(project => project.id)
  return projectIds.length === 0 ? {} : { projectIds, projectId: projectIds[0]! }
}

interface PreparedProjectRoot {
  projectId: string
  projectRootIndex: number
  rootIndex: number
  path: string
}

function preparedProjectRoots(projects: readonly CommonspaceState['projects'][number][]): PreparedProjectRoot[] {
  let rootIndex = 0
  return projects.flatMap(project => project.paths.map((path, projectRootIndex) => ({
    projectId: project.id,
    projectRootIndex,
    rootIndex: rootIndex++,
    path,
  })))
}

function defaultRoutingConfiguration(): PrivateRoutingConfiguration {
  return {
    provider: 'openai-compatible',
    model: 'gpt-4.1-mini',
    harnessAgentId: null,
    baseUrl: DEFAULT_ROUTING_BASE_URL,
  }
}

function normalizedRoutingBaseUrl(value: unknown): string {
  const raw = typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_ROUTING_BASE_URL
  if (raw.length > 2_000) throw new Error('routing base URL is too long')
  const parsed = new URL(raw)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('routing base URL must use HTTP or HTTPS')
  return parsed.toString().replace(/\/$/u, '')
}

function routingUsesOpenAiOrigin(baseUrl: string): boolean {
  return new URL(baseUrl).origin === new URL(DEFAULT_ROUTING_BASE_URL).origin
}

function sanitizeRoutingConfiguration(value: unknown): PrivateRoutingConfiguration {
  const record = plainRecord(value)
  if (record === null) return defaultRoutingConfiguration()
  if (record.provider !== 'harness' && record.provider !== 'openai-compatible') return defaultRoutingConfiguration()
  const provider = record.provider
  const model = typeof record.model === 'string' ? record.model.trim().slice(0, 200) : ''
  const harnessAgentId = typeof record.harnessAgentId === 'string' && record.harnessAgentId.trim() !== ''
    ? record.harnessAgentId.trim().slice(0, 200)
    : null
  let baseUrl = DEFAULT_ROUTING_BASE_URL
  try {
    baseUrl = normalizedRoutingBaseUrl(record.baseUrl)
  } catch {
    // Invalid persisted URLs fall back without exposing or blocking the workspace.
  }
  const apiKey = typeof record.apiKey === 'string' && record.apiKey !== ''
    ? record.apiKey.slice(0, 10_000)
    : undefined
  return { provider, model, harnessAgentId, baseUrl, ...(apiKey === undefined ? {} : { apiKey }) }
}

function isImageMimeType(value: unknown): value is CommonspaceImageMimeType {
  return typeof value === 'string' && IMAGE_MIME_TYPES.has(value as CommonspaceImageMimeType)
}

function prepareImageAttachments(value: unknown): PreparedImageAttachment[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('image attachments must be an array')
  if (value.length > MAX_IMAGE_ATTACHMENTS) throw new Error(`at most ${String(MAX_IMAGE_ATTACHMENTS)} images can be attached`)
  const attachments: PreparedImageAttachment[] = []
  let totalBytes = 0
  for (const candidate of value) {
    const attachment = plainRecord(candidate)
    if (attachment === null) throw new Error('invalid image attachment')
    if (!isImageMimeType(attachment.mimeType)) throw new Error('unsupported image type')
    const name = loadedString(attachment.name, 200).normalize('NFKC').trim()
    if (name === '') throw new Error('image name is required')
    if (typeof attachment.data !== 'string' || attachment.data.length === 0 || attachment.data.length > Math.ceil(MAX_IMAGE_ATTACHMENT_BYTES / 3) * 4 + 4) {
      throw new Error('invalid image data')
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(attachment.data)) {
      throw new Error('invalid image data')
    }
    const data = Buffer.from(attachment.data, 'base64')
    if (data.length === 0 || data.length > MAX_IMAGE_ATTACHMENT_BYTES || data.toString('base64') !== attachment.data) {
      throw new Error('invalid image data')
    }
    totalBytes += data.length
    if (totalBytes > MAX_IMAGE_ATTACHMENTS_BYTES) throw new Error('image attachments are too large')
    attachments.push({
      metadata: {
        id: crypto.randomUUID(),
        name,
        mimeType: attachment.mimeType,
        size: data.length,
      },
      data,
    })
  }
  return attachments
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
    const nativeProfile = agent.nativeProfile
    if (nativeProfile !== undefined && (typeof nativeProfile !== 'string' || nativeProfile.trim() !== nativeProfile || nativeProfile === '' || nativeProfile.length > 200 || /\s/u.test(nativeProfile))) continue
    if (typeof agent.displayName !== 'string' || agent.displayName.trim() === '') continue
    if (agent.model !== null && typeof agent.model !== 'string') continue
    if (typeof agent.createdAt !== 'string') continue
    const nativeDisplayName = agent.displayName.normalize('NFKC').trim().slice(0, 80)
    try {
      if (adapter !== 'hermes' && managedAgentId(adapter, typeof nativeProfile === 'string' ? nativeProfile : nativeDisplayName) !== agent.id) continue
    } catch {
      continue
    }
    const displayName = uniqueAgentDisplayName(nativeDisplayName, adapter, agents)
    const model = typeof agent.model === 'string' ? agent.model.trim().slice(0, 200) : null
    const avatarEmoji = typeof agent.avatarEmoji === 'string' ? agent.avatarEmoji.normalize('NFKC').trim().slice(0, 16) : ''
    const accentColor = typeof agent.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/u.test(agent.accentColor.trim())
      ? agent.accentColor.trim().toLocaleLowerCase()
      : undefined
    agents.push({
      id: agent.id,
      displayName,
      ...(avatarEmoji === '' ? {} : { avatarEmoji }),
      ...(accentColor === undefined ? {} : { accentColor }),
      adapter,
      ...(typeof nativeProfile === 'string' ? { nativeProfile } : {}),
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

function loadedIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.valueOf()) || timestamp.toISOString() !== value ? null : value
}

function loadedStringArray(value: unknown, maximumItems = 64, maximumLength = 2_000): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((candidate) => {
    if (typeof candidate !== 'string') return []
    const normalized = candidate.trim().slice(0, maximumLength)
    return normalized === '' ? [] : [normalized]
  }))].slice(0, maximumItems)
}

function loadedProjectIds(value: Record<string, unknown>, allowedProjectIds: ReadonlySet<string>): string[] {
  const singular = loadedId(value.projectId)
  return [...new Set([
    ...loadedStringArray(value.projectIds, 32, 200),
    ...(singular === null ? [] : [singular]),
  ])].filter(projectId => allowedProjectIds.has(projectId))
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
  const summary = loadedString(memory.summary, 16_000)
  const origin = memory.origin === 'inference' || memory.origin === 'user' ? memory.origin : 'automatic'
  const status = memory.status === 'stale' || memory.status === 'current' || memory.status === 'empty'
    ? memory.status
    : summary === '' ? 'empty' : 'current'
  const compactedThroughMessageId = memory.compactedThroughMessageId === null
    ? null
    : loadedId(memory.compactedThroughMessageId)
  return {
    summary,
    decisions: loadedStringArray(memory.decisions, 50, 2_000),
    openQuestions: loadedStringArray(memory.openQuestions, 50, 2_000),
    threadIds: loadedStringArray(memory.threadIds, 50, 200),
    updatedAt: typeof memory.updatedAt === 'string' ? memory.updatedAt.slice(0, 100) : null,
    origin,
    status,
    sourceMessageCount: loadedBoundedInteger(memory.sourceMessageCount, 0, 0, 10_000),
    estimatedTokens: loadedBoundedInteger(memory.estimatedTokens, 0, 0, Number.MAX_SAFE_INTEGER),
    compactedThroughMessageId,
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

function sanitizeChannels(value: unknown): CommonspaceState['channels'] {
  if (!Array.isArray(value)) return []
  const channels: CommonspaceState['channels'] = []
  const ids = new Set<string>()
  for (const candidate of value) {
    const channel = plainRecord(candidate)
    const id = loadedId(channel?.id)
    if (channel === null || id === null || ids.has(id)) continue
    const name = loadedString(channel.name, 80).normalize('NFKC').trim().replace(/^#+/, '')
    if (name === '') continue
    ids.add(id)
    channels.push({
      id,
      name,
      agentIds: loadedStringArray(channel.agentIds, 64, 200),
      instructions: loadedString(channel.instructions, 8_000),
      memory: sanitizeChannelMemory(channel.memory),
      settings: sanitizeRunSettings(channel.settings),
      createdAt: loadedString(channel.createdAt, 100),
    })
  }
  return channels
}

function sanitizeThreads(value: unknown, channels: readonly CommonspaceState['channels'][number][], projectIds: ReadonlySet<string>): CommonspaceState['threads'] {
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
    const referencedProjects = loadedProjectIds(thread, projectIds)
    ids.add(id)
    threads.push({
      id,
      channelId,
      projectIds: referencedProjects,
      projectId: referencedProjects[0] ?? null,
      rootMessageId,
      agentIds: loadedStringArray(thread.agentIds, 64, 200),
      createdAt: loadedString(thread.createdAt, 100),
    })
  }
  return threads
}

function sanitizeImageAttachments(value: unknown): CommonspaceImageAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined
  const attachments: CommonspaceImageAttachment[] = []
  const seen = new Set<string>()
  for (const candidate of value.slice(0, MAX_IMAGE_ATTACHMENTS)) {
    const attachment = plainRecord(candidate)
    const id = loadedId(attachment?.id)
    const name = loadedString(attachment?.name, 200).normalize('NFKC').trim()
    const size = attachment?.size
    if (attachment === null || id === null || !IMAGE_ATTACHMENT_ID_PATTERN.test(id) || seen.has(id)) continue
    if (name === '' || !isImageMimeType(attachment.mimeType)) continue
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1 || size > MAX_IMAGE_ATTACHMENT_BYTES) continue
    seen.add(id)
    attachments.push({ id, name, mimeType: attachment.mimeType, size })
  }
  return attachments.length === 0 ? undefined : attachments
}


function sanitizeRoutingDecision(value: unknown, agentIds: ReadonlySet<string>): CommonspaceRoutingDecision | undefined {
  const routing = plainRecord(value)
  if (routing === null || (routing.source !== 'explicit' && routing.source !== 'ai' && routing.source !== 'local' && routing.source !== 'fallback')) return undefined
  if (!Array.isArray(routing.agentIds) || typeof routing.reason !== 'string') return undefined
  const routedAgentIds = [...new Set(routing.agentIds.filter((id): id is string => typeof id === 'string' && agentIds.has(id)))].slice(0, 8)
  const status = routing.status === 'pending' || routing.status === 'resolved' || routing.status === 'failed'
    ? routing.status
    : undefined
  const reason = routing.reason.normalize('NFKC').trim().slice(0, 500)
  if ((routedAgentIds.length === 0 && status !== 'pending' && status !== 'failed') || reason === '') return undefined
  const confidence = typeof routing.confidence === 'number' && Number.isFinite(routing.confidence)
    ? Math.max(0, Math.min(1, routing.confidence))
    : undefined
  return { source: routing.source === 'fallback' ? 'local' : routing.source, ...(status === undefined ? {} : { status }), agentIds: routedAgentIds, ...(confidence === undefined ? {} : { confidence }), reason }
}

function isRunFileStatus(value: unknown): value is CommonspaceRunFileChange['status'] {
  return value === 'modified' || value === 'added' || value === 'deleted' || value === 'renamed' || value === 'untracked' || value === 'conflicted'
}

function sanitizeRunAttribution(value: unknown): CommonspaceRunAttribution | undefined {
  const attribution = plainRecord(value)
  if (attribution === null || !Array.isArray(attribution.roots)) return undefined
  const startedAt = loadedIsoTimestamp(attribution.startedAt)
  const completedAt = loadedIsoTimestamp(attribution.completedAt)
  if (startedAt === null || completedAt === null) return undefined
  const roots: CommonspaceRunRootAttribution[] = []
  for (const candidate of attribution.roots.slice(0, 16)) {
    const root = plainRecord(candidate)
    if (root === null || !Number.isInteger(root.rootIndex) || Number(root.rootIndex) < 0) continue
    const rootIndex = Number(root.rootIndex)
    const projectId = loadedId(root.projectId)
    const projectRootIndex = Number.isInteger(root.projectRootIndex) && Number(root.projectRootIndex) >= 0
      ? Number(root.projectRootIndex)
      : undefined
    const reference = {
      ...(projectId === null ? {} : { projectId }),
      ...(projectRootIndex === undefined ? {} : { projectRootIndex }),
    }
    if (root.available === false) {
      roots.push({ available: false, rootIndex, ...reference, reason: loadedString(root.reason, 500) })
      continue
    }
    if (root.available !== true || !Array.isArray(root.preExisting) || !Array.isArray(root.observed)) continue
    const preExisting = root.preExisting.slice(0, 1_000).flatMap(candidate => {
      const change = plainRecord(candidate)
      const path = loadedString(change?.path, 2_000)
      return change !== null && path !== '' && isRunFileStatus(change.status) ? [{ path, status: change.status }] : []
    })
    const observed: CommonspaceRunFileChange[] = root.observed.slice(0, 1_000).flatMap(candidate => {
      const change = plainRecord(candidate)
      const path = loadedString(change?.path, 2_000)
      if (change === null || path === '' || !isRunFileStatus(change.status) || typeof change.preExisting !== 'boolean') return []
      return [{
        path,
        status: change.status,
        preExisting: change.preExisting,
        additions: typeof change.additions === 'number' && Number.isInteger(change.additions) ? change.additions : null,
        deletions: typeof change.deletions === 'number' && Number.isInteger(change.deletions) ? change.deletions : null,
        ...(typeof change.patch === 'string' ? { patch: change.patch.slice(0, 128_000) } : {}),
        ...(change.patchTruncated === true ? { patchTruncated: true } : {}),
      }]
    })
    roots.push({
      available: true,
      rootIndex,
      ...reference,
      branch: typeof root.branch === 'string' ? root.branch.slice(0, 500) : null,
      headBefore: typeof root.headBefore === 'string' ? root.headBefore.slice(0, 100) : null,
      headAfter: typeof root.headAfter === 'string' ? root.headAfter.slice(0, 100) : null,
      preExisting,
      observed,
    })
  }
  return { startedAt, completedAt, roots }
}

function sanitizeMessages(
  value: unknown,
  channelIds: ReadonlySet<string>,
  agentIds: ReadonlySet<string>,
  projectIds: ReadonlySet<string>,
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
      const sourceMessageId = loadedId(message.sourceMessageId)
      if (message.sourceMessageId !== undefined && sourceMessageId === null) continue
      const trace = message.authorType === 'agent' ? sanitizeAgentTrace(message.trace) : undefined
      const runAttribution = message.authorType === 'agent' ? sanitizeRunAttribution(message.runAttribution) : undefined
      const attachments = sanitizeImageAttachments(message.attachments)

      const routing = sanitizeRoutingDecision(message.routing, agentIds)
      const referencedProjects = loadedProjectIds(message, projectIds)
      seen.add(id)
      sanitized.push({
        id,
        conversation: { kind, id: conversationId },
        authorType: message.authorType,
        authorId,
        authorName,
        text: message.text.slice(0, 64_000),
        ...(attachments === undefined ? {} : { attachments }),

        createdAt: loadedString(message.createdAt, 100),
        ...(referencedProjects.length === 0 ? {} : { projectIds: referencedProjects, projectId: referencedProjects[0] }),
        ...(threadId === null ? {} : { threadId }),
        ...(parentMessageId === null ? {} : { parentMessageId }),
        ...(sourceMessageId === null ? {} : { sourceMessageId }),
        ...(trace === undefined ? {} : { trace }),
        ...(runAttribution === undefined ? {} : { runAttribution }),
        ...(routing === undefined ? {} : { routing }),
        ...(kind === 'dm' && message.authorType === 'user' &&
          (message.replyStatus === 'queued' || message.replyStatus === 'running' || message.replyStatus === 'complete' ||
            message.replyStatus === 'needs_input' || message.replyStatus === 'failed' || message.replyStatus === 'cancelled' ||
            message.replyStatus === 'silent' || message.replyStatus === 'timeout' || message.replyStatus === 'error')
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
  if (record === null || typeof record.version !== 'number' || !Number.isInteger(record.version) ||
    record.version < 1 || record.version > COMMONSPACE_STATE_VERSION) {
    throw new Error(`Commonspace state has an unsupported version; expected 1-${COMMONSPACE_STATE_VERSION}`)
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
  const projectIds = new Set(projects.map(project => project.id))
  let channels = sanitizeChannels(record.channels)
    .map(channel => ({ ...channel, agentIds: channel.agentIds.filter(agentId => agentIds.has(agentId)) }))
  const threads = sanitizeThreads(record.threads, channels, projectIds)
    .map(thread => ({ ...thread, agentIds: thread.agentIds.filter(agentId => agentIds.has(agentId)) }))
  const threadIds = new Set(threads.map(thread => thread.id))
  channels = channels.map(channel => ({
    ...channel,
    memory: { ...channel.memory, threadIds: channel.memory.threadIds.filter(id => threadIds.has(id)) },
  }))
  const dmSessions = sanitizeDmSessions(record.dmSessions, agentIds)
  const messages = sanitizeMessages(record.messages, new Set(channels.map(channel => channel.id)), agentIds, projectIds, threads)
  const inboxMessageIds = new Set(Object.values(messages).flatMap(entries => entries
    .filter(message => message.authorType === 'agent' || message.authorType === 'system' || message.replyStatus === 'error' || message.replyStatus === 'failed' || message.replyStatus === 'timeout')
    .map(message => message.id)))
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: loadedBoundedInteger(record.revision, 0, 0, Number.MAX_SAFE_INTEGER),
    inboxReadAt: loadedIsoTimestamp(record.inboxReadAt),
    inboxReadMessageIds: loadedStringArray(record.inboxReadMessageIds, 10_000, 200)
      .filter(messageId => inboxMessageIds.has(messageId)),
    inboxSavedItemIds: loadedStringArray(record.inboxSavedItemIds, 10_000, 200)
      .filter(messageId => inboxMessageIds.has(messageId)),
    followedSessionIds: loadedStringArray(record.followedSessionIds, 10_000, 500),
    mutedSessionIds: loadedStringArray(record.mutedSessionIds, 10_000, 500),
    defaults,
    agents,
    dmSessions,
    agentSessions: sanitizeAgentSessions(record.agentSessions, agentIds, dmSessions),
    projects,
    channels,
    threads,
    messages,
  }
}

export class CommonspaceHostService implements CommonspaceMcpProvider {
  readonly root: string
  private readonly statePath: string
  private readonly stateBackupPath: string
  private readonly stateCorruptPath: string
  private readonly routingPath: string
  private readonly attachmentsRoot: string
  private readonly defaultCwd: string
  private state: CommonspaceState = createInitialState()
  private routingConfiguration: PrivateRoutingConfiguration = defaultRoutingConfiguration()
  private writeTail = Promise.resolve()
  private readonly agentSessionTails = new Map<string, Promise<unknown>>()
  private readonly revisionListeners = new Set<(revision: number) => void>()
  private readonly liveActivityListeners = new Set<(activities: readonly CommonspaceLiveAgentActivity[]) => void>()
  private readonly liveActivitiesById = new Map<string, CommonspaceLiveAgentActivity>()
  private readonly activeAgentRuns = new Map<string, ActiveAgentRun>()
  private readonly backgroundRuns = new Set<Promise<void>>()
  private readonly activeConversationRuns = new Map<string, Promise<void>>()
  private readonly pendingFollowups = new Map<string, PendingFollowup[]>()
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
  private discoveredAgentCandidates: CommonspaceAgentProfile[] = []
  private readonly codexAgentProfileConfigs = new Map<string, CodexAgentProfileConfig>()
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
    this.stateBackupPath = join(this.root, 'state.backup.json')
    this.stateCorruptPath = join(this.root, 'state.corrupt.json')
    this.routingPath = join(this.root, 'routing.json')
    this.attachmentsRoot = join(this.root, 'attachments')
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
    await mkdir(this.attachmentsRoot, { recursive: true, mode: 0o700 })
    await chmod(this.attachmentsRoot, 0o700)
    try {
      this.routingConfiguration = sanitizeRoutingConfiguration(JSON.parse(await readFile(this.routingPath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.environment.logger?.warn('Commonspace ignored invalid routing configuration')
      this.routingConfiguration = defaultRoutingConfiguration()
    }
    try {
      this.state = sanitizeLoadedState(JSON.parse(await readFile(this.statePath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        try {
          this.state = sanitizeLoadedState(JSON.parse(await readFile(this.stateBackupPath, 'utf8')))
          await rm(this.stateCorruptPath, { force: true })
          await rename(this.statePath, this.stateCorruptPath)
          this.environment.logger?.warn('Commonspace recovered invalid state.json from state.backup.json')
        } catch (recoveryError) {
          this.environment.logger?.warn(error)
          this.environment.logger?.warn(recoveryError)
          throw new AggregateError([error, recoveryError], 'Commonspace state and rollback backup are both invalid')
        }
      } else {
        this.state = createInitialState()
      }
    }
    this.state = await this.canonicalizeLoadedProjectPaths(this.state)
    this.state = this.redactLoadedTraces(this.state)
    let memoryChanged = false
    const channels = this.state.channels.map(channel => {
      const memory = mergeChannelMemoryProjection(
        channel.memory,
        projectChannelMemory(this.state, channel.id, this.state.defaults.memoryThreads),
      )
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
    const threads = state.threads.map((thread) => {
      const references = referencedProjectIds(thread).filter(projectId => projectIds.has(projectId))
      return { ...thread, projectIds: references, projectId: references[0] ?? null }
    })
    const messages = Object.fromEntries(Object.entries(state.messages).map(([key, entries]) => [
      key,
      entries.map((message) => {
        const references = referencedProjectIds(message).filter(projectId => projectIds.has(projectId))
        const sanitized = { ...message }
        if (references.length === 0) {
          delete sanitized.projectIds
          delete sanitized.projectId
        } else {
          sanitized.projectIds = references
          sanitized.projectId = references[0]!
        }
        return sanitized
      }),
    ]))
    return { ...state, projects, threads, messages }
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
      for (const run of this.activeAgentRuns.values()) run.abortController.abort(new Error('Commonspace is shutting down'))
      this.activeAgentRuns.clear()
      this.liveActivitiesById.clear()
      this.broadcastLiveActivities()
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
      ...(scoped.projects.length === 0
        ? {}
        : { projects: scoped.projects.map(project => ({ id: project.id, name: project.name })) }),
      ...(scoped.project === undefined ? {} : { project: { id: scoped.project.id, name: scoped.project.name } }),
      ...(scoped.thread === undefined
        ? {}
        : {
            thread: {
              id: scoped.thread.id,
              rootMessageId: scoped.thread.rootMessageId,
            },
          }),
      instructions: scoped.channel?.instructions ?? '',
      memory: scoped.channel?.memory ?? { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
      ...(scoped.channel === undefined
        ? {}
        : {
            collaboration: {
              routing: 'Human @mentions are explicit assignments. Unmentioned work is routed by participant responsibilities.',
              handoff: 'When another specialist is required, address that peer with @name in the final reply and include a concrete handoff.',
              limits: 'Handoff to at most one peer at a time. Do not mention peers for status, acknowledgement, or work you can complete yourself.',
            },
          }),
      participants: scoped.channel === undefined
        ? [{ id: scoped.agent.id, displayName: scoped.agent.displayName }]
        : scoped.channel.agentIds.flatMap(id => {
            const agent = this.state.agents.find(candidate => candidate.id === id)
            if (agent === undefined) return []
            const profile = this.configuredAgents().find(candidate => candidate.id === agent.id)
            return [{
              id: agent.id,
              displayName: agent.displayName,
              adapter: agent.adapter,
              ...(profile?.description === undefined ? {} : { description: profile.description }),
            }]
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

  async searchMessages(scope: CommonspaceMcpScope, input: { query: string; limit: number }): Promise<Record<string, unknown>> {
    this.resolveMcpScope(scope)
    const terms = [...input.query.normalize('NFKC').matchAll(/(-?)(?:"([^"]+)"|(\S+))/g)]
      .map(match => ({ excluded: match[1] === '-', value: (match[2] ?? match[3] ?? '').toLocaleLowerCase() }))
      .filter(term => term.value !== '')
    const included = terms.filter(term => !term.excluded).map(term => term.value)
    const excluded = terms.filter(term => term.excluded).map(term => term.value)
    const limit = Math.max(1, Math.min(100, Math.trunc(input.limit)))
    const results = this.messagesForMcpScope(scope)
      .filter(message => {
        const searchable = `${message.authorName}\n${message.text}`.normalize('NFKC').toLocaleLowerCase()
        return included.every(term => searchable.includes(term)) && excluded.every(term => !searchable.includes(term))
      })
      .slice(-limit)
      .reverse()
      .map(message => ({
        id: message.id,
        authorType: message.authorType,
        authorId: message.authorId,
        authorName: message.authorName,
        text: searchSnippet(message.text, included),
        createdAt: message.createdAt,
        ...(message.threadId === undefined ? {} : { threadId: message.threadId }),
        ...(message.parentMessageId === undefined ? {} : { parentMessageId: message.parentMessageId }),
        matchedTerms: included,
      }))
    return { results }
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
    return {
      agents: this.configuredAgents(),
      discoveredAgents: this.discoveredAgentCandidates,
      state: this.publicSnapshot(),
      liveActivities: this.liveActivities(),
      queuedFollowups: this.queuedFollowups(),
      routing: this.publicRoutingConfiguration(),
    }
  }

  routing(): CommonspaceRoutingConfiguration {
    return this.publicRoutingConfiguration()
  }

  async updateRoutingConfiguration(request: UpdateRoutingConfigurationRequest): Promise<CommonspaceRoutingConfiguration> {
    if (request.provider !== 'harness' && request.provider !== 'openai-compatible') {
      throw new Error('unsupported routing provider')
    }
    const model = request.provider === 'openai-compatible'
      ? request.model.normalize('NFKC').trim()
      : this.routingConfiguration.model
    if (model.length > 200) throw new Error('routing model is too long')
    const harnessAgentId = request.provider === 'harness' ? request.harnessAgentId.trim() || null : null
    if (request.provider === 'harness' && (harnessAgentId === null || !this.state.agents.some(agent => agent.id === harnessAgentId))) {
      throw new Error('routing harness must be a configured agent')
    }
    if (request.provider === 'openai-compatible' && model === '') throw new Error('routing model is required')
    const baseUrl = request.provider === 'openai-compatible'
      ? normalizedRoutingBaseUrl(request.baseUrl)
      : this.routingConfiguration.baseUrl
    const requestedApiKey = request.provider === 'openai-compatible' ? request.apiKey : undefined
    const apiKey = requestedApiKey === undefined
      ? baseUrl === this.routingConfiguration.baseUrl ? this.routingConfiguration.apiKey : undefined
      : requestedApiKey === null || requestedApiKey.trim() === ''
        ? undefined
        : requestedApiKey.trim().slice(0, 10_000)
    const next: PrivateRoutingConfiguration = {
      provider: request.provider,
      model,
      harnessAgentId,
      baseUrl,
      ...(apiKey === undefined ? {} : { apiKey }),
    }
    await this.persistRoutingConfiguration(next)
    this.routingConfiguration = next
    return this.publicRoutingConfiguration()
  }

  channelContext(channelId: string): CommonspaceChannelMemory {
    const channel = this.state.channels.find(candidate => candidate.id === channelId)
    if (channel === undefined) throw new Error('unknown channel')
    return structuredClone(channel.memory)
  }

  async updateChannelContext(channelId: string, request: UpdateChannelContextRequest): Promise<CommonspaceChannelMemory> {
    await this.mutate({
      action: 'set-channel-memory',
      channelId,
      summary: request.summary,
      ...(request.decisions === undefined ? {} : { decisions: request.decisions }),
      ...(request.openQuestions === undefined ? {} : { openQuestions: request.openQuestions }),
    })
    return this.channelContext(channelId)
  }

  async compactChannelContext(channelId: string): Promise<CommonspaceChannelMemory> {
    return this.withAdmission(async () => {
      const channel = this.state.channels.find(candidate => candidate.id === channelId)
      if (channel === undefined) throw new Error('unknown channel')
      const projection = projectChannelMemory(this.state, channelId, this.state.defaults.memoryThreads)
      const memory = await this.inferChannelMemory(channelId, projection)
      this.state = {
        ...this.state,
        revision: this.state.revision + 1,
        channels: this.state.channels.map(candidate => candidate.id === channelId ? { ...candidate, memory } : candidate),
      }
      await this.persist()
      this.broadcastRevision()
      return structuredClone(memory)
    })
  }

  async discoverAgents(adapter: AgentAdapterKind): Promise<CommonspaceBootstrap> {
    if (adapter !== 'hermes' && adapter !== 'codex') throw new Error('unsupported agent adapter')
    this.discoveredAgentCandidates = await this.discoverAgentCandidates(adapter)
    return this.bootstrap()
  }

  async agentConfiguration(agentId: string): Promise<CommonspaceAgentConfiguration> {
    const agent = this.configuredAgents().find(candidate => candidate.id === agentId)
    if (agent === undefined) throw new Error('unknown agent')
    return this.withAgentRuntime(agent, await inspectAgentConfiguration(this.hermesPath, agent))
  }

  async updateAgentConfiguration(agentId: string, update: UpdateAgentConfigurationRequest): Promise<CommonspaceAgentConfiguration> {
    const agent = this.configuredAgents().find(candidate => candidate.id === agentId)
    if (agent === undefined) throw new Error('unknown agent')
    const configuration = await updateNativeAgentConfiguration(this.hermesPath, agent, update)
    this.discoveredAgentCandidates = await this.discoverAgentCandidates(agent.adapter)
    return this.withAgentRuntime(agent, configuration)
  }

  private withAgentRuntime(agent: CommonspaceAgentProfile, configuration: CommonspaceAgentConfiguration): CommonspaceAgentConfiguration {
    const completed = Object.values(this.state.messages).flatMap(messages => messages)
      .filter(message => message.authorType === 'agent' && message.authorId === agent.id && message.trace !== undefined)
      .map(message => {
        const usage = message.trace!.entries.find(entry => entry.type === 'usage')
        return {
          messageId: message.id,
          conversation: message.conversation,
          startedAt: message.trace!.startedAt,
          completedAt: message.trace!.completedAt,
          status: 'complete' as const,
          ...(usage?.type !== 'usage' || usage.usedTokens === 0 ? {} : { usedTokens: usage.usedTokens }),
          ...(usage?.type !== 'usage' || usage.costAmount === undefined ? {} : { costAmount: usage.costAmount }),
          ...(usage?.type !== 'usage' || usage.costCurrency === undefined ? {} : { costCurrency: usage.costCurrency }),
        }
      })
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    const active = [...this.liveActivitiesById.values()].filter(activity => activity.agentId === agent.id)
    const lastRuns = [
      ...active.map(activity => ({ messageId: activity.sourceMessageId, conversation: activity.conversation, startedAt: activity.startedAt, completedAt: activity.startedAt, status: 'running' as const })),
      ...completed,
    ].slice(0, 10)
    const usages = completed.filter(run => run.costAmount !== undefined)
    const currencies = [...new Set(usages.map(run => run.costCurrency).filter((currency): currency is string => currency !== undefined))]
    const knownSessions = Object.keys(this.state.agentSessions[agent.id] ?? {}).length
    const lastRunAt = lastRuns[0]?.completedAt ?? null
    return {
      ...configuration,
      sessionHealth: {
        status: active.length > 0 || knownSessions > 0 || lastRunAt !== null ? 'healthy' : 'idle',
        activeSessions: active.length,
        knownSessions,
        lastRunAt,
      },
      lastRuns,
      cost: { amount: usages.reduce((sum, run) => sum + (run.costAmount ?? 0), 0), currency: currencies.length === 1 ? currencies[0]! : null },
    }
  }

  private resolveMcpScope(scope: CommonspaceMcpScope): {
    agent: CommonspaceAgentDefinition
    channel?: CommonspaceState['channels'][number]
    thread?: CommonspaceThread
    projects: CommonspaceState['projects']
    project?: CommonspaceState['projects'][number]
  } {
    const agent = this.state.agents.find(candidate => candidate.id === scope.agentId)
    if (agent === undefined) throw new Error('Commonspace MCP agent scope expired')
    if (scope.conversation.kind === 'dm') {
      if (scope.conversation.id !== agent.id || scope.threadId !== undefined) throw new Error('invalid Commonspace MCP direct-message scope')
      const currentSessionName = this.state.dmSessions[agent.id] ?? 'Bot Chat'
      if (scope.sessionName !== currentSessionName) throw new Error('Commonspace MCP direct-message generation expired')
      const projects = referencedProjectIds(scope).map((projectId) => {
        const project = this.state.projects.find(candidate => candidate.id === projectId)
        if (project === undefined) throw new Error('Commonspace MCP project scope expired')
        return project
      })
      return { agent, projects, ...(projects[0] === undefined ? {} : { project: projects[0] }) }
    }

    const channel = this.state.channels.find(candidate => candidate.id === scope.conversation.id)
    if (channel === undefined || scope.threadId === undefined) throw new Error('Commonspace MCP channel scope expired')
    const thread = this.state.threads.find(candidate => candidate.id === scope.threadId && candidate.channelId === channel.id)
    if (thread === undefined || !thread.agentIds.includes(agent.id)) throw new Error('Commonspace MCP thread scope expired')
    if (scope.sessionName !== `Commonspace Thread: ${thread.id}`) throw new Error('invalid Commonspace MCP native-session scope')
    const threadProjectIds = referencedProjectIds(thread)
    const scopedProjectIds = referencedProjectIds(scope)
    if (scopedProjectIds.length > 0 && !sameProjectSet(scopedProjectIds, threadProjectIds)) {
      throw new Error('invalid Commonspace MCP project scope')
    }
    const projects = threadProjectIds.map((projectId) => {
      const project = this.state.projects.find(candidate => candidate.id === projectId)
      if (project === undefined) throw new Error('Commonspace MCP project scope expired')
      return project
    })
    return { agent, channel, thread, projects, ...(projects[0] === undefined ? {} : { project: projects[0] }) }
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
    if (changed) {
      this.state = { ...this.state, revision: this.state.revision + 1, messages }
    }
    return changed
  }

  async mutate(mutation: CommonspaceMutation): Promise<CommonspaceState> {
    return this.withAdmission(async () => {
      const resetScope = mutation.action === 'reset-dm' && typeof mutation.agentId === 'string'
        ? `${mutation.agentId}\u0000${this.state.dmSessions[mutation.agentId] ?? 'Bot Chat'}`
        : undefined
      const resetRuns = resetScope === undefined
        ? []
        : [...this.activeAgentRuns.values()].filter(run => run.scopeKey === resetScope)
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
        let agent = this.discoveredAgentCandidates.find(candidate => candidate.id === mutation.agentId)
        if (agent === undefined) {
          const [hermes, codex] = await Promise.all([
            this.discoverAgentCandidates('hermes'),
            this.discoverAgentCandidates('codex'),
          ])
          this.discoveredAgentCandidates = [...hermes, ...codex]
          agent = this.discoveredAgentCandidates.find(candidate => candidate.id === mutation.agentId)
        }
        if (agent === undefined) throw new Error('unknown discovered agent')
        this.state = addDiscoveredAgent(this.state, agent)
      } else {
        const normalized = await this.normalizeMutation(mutation)
        this.state = applyMutation(this.state, normalized)
      }
      this.revokeInvalidMcpCredentials()
      if (mutation.action === 'remove-agent') {
        const processEntries = [...this.acpProcesses.entries()]
          .filter(([key]) => key.startsWith(`${mutation.agentId}\u0000`))
        for (const [key] of processEntries) this.acpProcesses.delete(key)
        for (const key of this.activeAcpSessions.keys()) {
          if (key.startsWith(`${mutation.agentId}\u0000`)) this.activeAcpSessions.delete(key)
        }
        await Promise.all(processEntries.map(([, processClient]) => processClient.close()))
      } else if (mutation.action === 'reset-dm' && resetScope !== undefined) {
        const processClient = this.acpProcesses.get(resetScope)
        const activeResetSession = this.activeAcpSessions.get(resetScope)
        this.acpProcesses.delete(resetScope)
        if (activeResetSession !== undefined) await processClient?.cancelSession(activeResetSession)
        for (const run of resetRuns) run.abortController.abort(new Error('Interrupted by /new.'))
        await processClient?.close()
      } else if (mutation.action === 'remove-channel') {
        const processEntries = [...this.acpProcesses.entries()].filter(([key]) => {
          const separator = key.indexOf('\u0000')
          return separator >= 1 && removedChannelSessionNames?.has(key.slice(separator + 1)) === true
        })
        for (const [key] of processEntries) this.acpProcesses.delete(key)
        await Promise.all(activeRemovedChannelSessions.map(async ({ key, sessionId }) => {
          if (this.activeAcpSessions.get(key) === sessionId) this.activeAcpSessions.delete(key)
          await processEntries.find(([processKey]) => processKey === key)?.[1].cancelSession(sessionId)
        }))
        await Promise.all(processEntries.map(([, processClient]) => processClient.close()))
      }
      await this.persist()
      this.broadcastRevision()
      return this.publicSnapshot()
    })
  }

  async send(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.withAdmission(async () => {
      if (request.delivery !== undefined && !['queue', 'steer', 'stop-and-send'].includes(request.delivery)) {
        throw new Error('invalid follow-up delivery mode')
      }
      const prepared = await this.prepareSend(request)
      await this.overrides.beforeAcceptSend?.(prepared)
      const response = await this.acceptSend(prepared)
      const scopeKey = this.followupScopeKey(prepared.request.conversation, response.thread?.id)
      if (this.activeConversationRuns.has(scopeKey)) {
        const delivery = request.delivery ?? 'queue'
        const queue = this.pendingFollowups.get(scopeKey) ?? []
        const pending = { prepared, response, delivery }
        if (delivery === 'steer' || delivery === 'stop-and-send') queue.unshift(pending)
        else queue.push(pending)
        this.pendingFollowups.set(scopeKey, queue)
        if (delivery === 'steer' || delivery === 'stop-and-send') {
          await this.abortConversationRuns(prepared.request.conversation, response.thread?.id, 'Stopped for a follow-up.')
        }
      } else {
        this.startConversationRun(scopeKey, { prepared, response, delivery: request.delivery ?? 'queue' })
      }
      return response
    })
  }

  async reorderFollowup(request: ReorderFollowupRequest): Promise<FollowupQueueResponse> {
    return this.withAdmission(async () => {
      if (typeof request.messageId !== 'string' || request.messageId === '') throw new Error('message id is required')
      if (request.direction !== 'up' && request.direction !== 'down') throw new Error('invalid queue direction')
      for (const queue of this.pendingFollowups.values()) {
        const index = queue.findIndex(item => item.response.accepted.id === request.messageId)
        if (index < 0) continue
        const target = request.direction === 'up' ? index - 1 : index + 1
        if (target >= 0 && target < queue.length) {
          const [item] = queue.splice(index, 1)
          queue.splice(target, 0, item!)
          this.broadcastLiveActivities()
        }
        return { queuedFollowups: this.queuedFollowups() }
      }
      throw new Error('queued follow-up not found')
    })
  }

  async removeFollowup(request: RemoveFollowupRequest): Promise<FollowupQueueResponse> {
    return this.withAdmission(async () => {
      if (typeof request.messageId !== 'string' || request.messageId === '') throw new Error('message id is required')
      for (const [scopeKey, queue] of this.pendingFollowups) {
        const index = queue.findIndex(item => item.response.accepted.id === request.messageId)
        if (index < 0) continue
        const [removed] = queue.splice(index, 1)
        if (queue.length === 0) this.pendingFollowups.delete(scopeKey)
        if (removed !== undefined) {
          this.updateMessageReplyStatus(removed.prepared.request.conversation, request.messageId, 'cancelled', 'Removed from queue.')
          await this.persist()
          this.broadcastRevision()
          this.broadcastLiveActivities()
        }
        return { queuedFollowups: this.queuedFollowups() }
      }
      throw new Error('queued follow-up not found')
    })
  }

  async stopAgentRuns(request: StopAgentRunsRequest): Promise<StopAgentRunsResponse> {
    return this.withAdmission(async () => {
      if (typeof request.messageId !== 'string' || request.messageId === '') throw new Error('message id is required')
      if (request.agentId !== undefined && (typeof request.agentId !== 'string' || request.agentId === '')) {
        throw new Error('agent id must be a non-empty string')
      }
      const message = Object.values(this.state.messages).flat().find(candidate => candidate.id === request.messageId)
      if (message === undefined || message.authorType !== 'user') throw new Error('unknown user message')
      const runs = [...this.activeAgentRuns.values()].filter(run =>
        !run.abortController.signal.aborted && run.sourceMessageId === request.messageId &&
        (request.agentId === undefined || run.agentId === request.agentId))
      const stoppedAgentIds = [...new Set(runs.map(run => run.agentId))]
      await Promise.all(runs.map(async (run) => {
        run.abortController.abort(new Error('Stopped by user.'))
        const sessionId = this.activeAcpSessions.get(run.scopeKey)
        if (sessionId !== undefined) await this.acpProcesses.get(run.scopeKey)?.cancelSession(sessionId)
      }))
      const changed = message.conversation.kind === 'dm' && stoppedAgentIds.length > 0
        ? this.updateMessageReplyStatus(message.conversation, message.id, 'error', 'Stopped by user.')
        : false
      if (changed) {
        await this.persist()
        this.broadcastRevision()
      }
      return { stoppedAgentIds }
    })
  }

  subscribeToRevisions(listener: (revision: number) => void): () => void {
    this.revisionListeners.add(listener)
    return () => { this.revisionListeners.delete(listener) }
  }

  liveActivities(): CommonspaceLiveAgentActivity[] {
    return structuredClone([...this.liveActivitiesById.values()])
  }

  queuedFollowups(): CommonspaceQueuedFollowup[] {
    return [...this.pendingFollowups.values()].flatMap(queue => queue.map((item, position) => ({
      messageId: item.response.accepted.id,
      conversation: item.prepared.request.conversation,
      ...(item.response.thread === undefined ? {} : { threadId: item.response.thread.id }),
      agentIds: [...item.prepared.agentIds],
      text: item.prepared.text,
      position,
      createdAt: item.response.accepted.createdAt,
      delivery: item.delivery,
    })))
  }

  subscribeToLiveActivities(listener: (activities: readonly CommonspaceLiveAgentActivity[]) => void): () => void {
    this.liveActivityListeners.add(listener)
    return () => { this.liveActivityListeners.delete(listener) }
  }

  async readImageAttachment(id: string): Promise<{ attachment: CommonspaceImageAttachment; data: Buffer }> {
    if (!IMAGE_ATTACHMENT_ID_PATTERN.test(id)) throw new Error('unknown image attachment')
    const attachment = Object.values(this.state.messages)
      .flatMap(messages => messages)
      .flatMap(message => message.attachments ?? [])
      .find(candidate => candidate.id === id)
    if (attachment === undefined) throw new Error('unknown image attachment')
    const data = await readFile(join(this.attachmentsRoot, id))
    if (data.length !== attachment.size) throw new Error('image attachment is unavailable')
    return { attachment: structuredClone(attachment), data }
  }

  private async prepareSend(request: SendMessageRequest): Promise<PreparedSend> {
    const text = request.text.normalize('NFKC').trim().slice(0, MAX_MESSAGE_CHARS)
    const attachments = prepareImageAttachments(request.attachments)
    const taggedProjects = [...new Set(parseTags(text).projects)].flatMap(tag => {
      const project = this.state.projects.find(candidate => candidate.id.toLocaleLowerCase() === tag || projectTagName(candidate.name) === tag)
      return project === undefined ? [] : [project]
    })
    if (request.projectIds !== undefined && !Array.isArray(request.projectIds)) throw new Error('project ids must be an array')
    const requestedProjectIds = [...new Set([
      ...taggedProjects.map(project => project.id),
      ...(request.projectIds ?? []).map((projectId) => {
        if (typeof projectId !== 'string' || projectId.trim() === '') throw new Error('project id must be a non-empty string')
        return projectId.trim()
      }),
      ...(request.projectId === undefined ? [] : [request.projectId]),
    ])]
    if (requestedProjectIds.length > 32) throw new Error('a message can reference at most 32 projects')
    let agents = this.configuredAgents()
    let channel = undefined as PreparedSend['channel']
    let projects: PreparedSend['projects'] = []
    let project = undefined as PreparedSend['project']
    let thread = undefined as PreparedSend['thread']
    let dmSessionName = undefined as PreparedSend['dmSessionName']
    let agentIds: string[]
    let routing = undefined as PreparedSend['routing']

    if (request.conversation.kind === 'channel') {
      channel = this.state.channels.find(candidate => candidate.id === request.conversation.id)
      if (channel === undefined) throw new Error('unknown channel')
      if (request.threadId !== undefined) {
        thread = this.state.threads.find(candidate => candidate.id === request.threadId)
        if (thread === undefined || thread.channelId !== channel.id) throw new Error('unknown channel thread')
        const threadProjectIds = referencedProjectIds(thread)
        if (requestedProjectIds.length > 0 && !sameProjectSet(requestedProjectIds, threadProjectIds)) {
          throw new Error('thread projects cannot be changed')
        }
        projects = threadProjectIds.map((projectId) => {
          const referenced = this.state.projects.find(candidate => candidate.id === projectId)
          if (referenced === undefined) throw new Error('thread references an unknown project')
          return referenced
        })
      } else {
        projects = requestedProjectIds.map((projectId) => {
          const referenced = this.state.projects.find(candidate => candidate.id === projectId)
          if (referenced === undefined) throw new Error('unknown project')
          return referenced
        })
      }
      project = projects[0]
      const memberIds = new Set(thread?.agentIds ?? channel.agentIds)
      if (request.targetAgentId === undefined &&
        mentionedChannelAgents([...memberIds], text, agents).length === 0 &&
        agents.some(agent => memberIds.has(agent.id) && agent.status === 'unknown')) {
        const adapters = [...new Set(agents
          .filter(agent => memberIds.has(agent.id) && agent.status === 'unknown')
          .map(agent => agent.adapter))]
        const refreshed = (await Promise.all(adapters.map(adapter => this.discoverAgentCandidates(adapter)))).flat()
        const refreshedAdapters = new Set(adapters)
        this.discoveredAgentCandidates = [
          ...this.discoveredAgentCandidates.filter(agent => !refreshedAdapters.has(agent.adapter)),
          ...refreshed,
        ]
        agents = this.configuredAgents()
      }
      if (request.targetAgentId !== undefined) {
        if (thread === undefined) throw new Error('direct channel replies require a thread')
        if (!channel.agentIds.includes(request.targetAgentId) || !agents.some(agent => agent.id === request.targetAgentId)) {
          throw new Error('direct reply target is not a channel member')
        }
        agentIds = [request.targetAgentId]
        routing = { source: 'explicit', agentIds, reason: 'Direct reply target selected.' }
      } else {
        const explicitlyMentionedAgentIds = mentionedAgents(text, agents)
        channel = {
          ...channel,
          agentIds: [...new Set([...channel.agentIds, ...explicitlyMentionedAgentIds])],
        }
        if (thread !== undefined) {
          thread = {
            ...thread,
            agentIds: [...new Set([...thread.agentIds, ...explicitlyMentionedAgentIds])],
          }
        }
        const routedMemberIds = thread?.agentIds ?? channel.agentIds
        const explicitlyAddressed = mentionedChannelAgents(routedMemberIds, text, agents)
        if (explicitlyAddressed.length > 0) {
          agentIds = explicitlyAddressed
          routing = { source: 'explicit', agentIds, reason: parseTags(text).agents.includes('all') ? '@all addressed every channel agent.' : 'Agent mention selected.' }
        } else {
          agentIds = []
          routing = { source: 'ai', status: 'pending', agentIds, reason: 'Routing with inference.' }
        }
      }
    } else {
      if (request.threadId !== undefined) throw new Error('direct messages do not use channel threads')
      if (request.targetAgentId !== undefined) throw new Error('direct messages do not accept a reply target')
      if (!agents.some(agent => agent.id === request.conversation.id)) throw new Error('unknown agent')
      projects = requestedProjectIds.map((projectId) => {
        const referenced = this.state.projects.find(candidate => candidate.id === projectId)
        if (referenced === undefined) throw new Error('unknown project')
        return referenced
      })
      project = projects[0]
      agentIds = [request.conversation.id]
      dmSessionName = this.state.dmSessions[request.conversation.id] ?? 'Bot Chat'
    }
    if (text === '' && attachments.length === 0) throw new Error('message text or image is required')
    return { request, text, attachments, agents, agentIds, projects, ...(routing === undefined ? {} : { routing }), ...(channel === undefined ? {} : { channel }), ...(project === undefined ? {} : { project }), ...(thread === undefined ? {} : { thread }), ...(dmSessionName === undefined ? {} : { dmSessionName }) }
  }

  private async routeChannelMessage(
    text: string,
    request: SendMessageRequest,
    thread: CommonspaceThread | undefined,
    memberIds: readonly string[],
    agents: readonly CommonspaceAgentProfile[],
  ): Promise<CommonspaceRouteResult> {
    const agentById = new Map(agents.map(agent => [agent.id, agent]))
    const candidates = rankChannelAgents(memberIds, text, agents).flatMap((signal) => {
      const agent = agentById.get(signal.id)
      if (agent === undefined) return []
      return [{
        id: agent.id,
        displayName: agent.displayName,
        ...(agent.description === undefined ? {} : { description: agent.description }),
        routingScore: signal.score,
        matchedTerms: signal.matchedTerms,
      }]
    })
    if (candidates.length === 0) throw new Error('inference routing failed: no eligible agents')
    const context = thread === undefined
      ? []
      : [
          ...referencedProjectIds(thread).flatMap((projectId) => {
            const project = this.state.projects.find(candidate => candidate.id === projectId)
            return project === undefined ? [] : [`Referenced Project: ${project.name}`]
          }),
          ...(this.state.messages[conversationKey(request.conversation)] ?? [])
            .filter(message => message.threadId === thread.id)
            .slice(-8)
            .map(message => `${message.authorName}: ${message.text.slice(0, 1_000)}`),
        ]
    const input: CommonspaceRouteInput = {
      text,
      context,
      candidates,
      maxAgents: Math.min(2, candidates.length),
    }
    try {
      const result = this.overrides.routeAgents === undefined
        ? await this.routeAgents(input)
        : await this.overrides.routeAgents(input)
      const allowed = new Set(candidates.map(candidate => candidate.id))
      const agentIds = [...new Set(result.agentIds)]
        .filter(agentId => allowed.has(agentId))
        .slice(0, input.maxAgents)
      const reason = result.reason.normalize('NFKC').trim().slice(0, 500)
      if (agentIds.length === 0 || reason === '') throw new Error('inference routing returned no valid decision')
      const confidence = typeof result.confidence === 'number' && Number.isFinite(result.confidence)
        ? Math.max(0, Math.min(1, result.confidence))
        : undefined
      return { agentIds, ...(confidence === undefined ? {} : { confidence }), reason }
    } catch (error) {
      this.environment.logger?.warn(error)
      throw new Error('inference routing failed', { cause: error })
    }
  }

  private followupScopeKey(conversation: SendMessageRequest['conversation'], threadId?: string): string {
    return `${conversation.kind}:${conversation.id}\u0000${threadId ?? ''}`
  }

  private startConversationRun(scopeKey: string, initial: PendingFollowup): void {
    const operation = (async () => {
      let current: PendingFollowup | undefined = initial
      while (current !== undefined && !this.closing) {
        await this.processReplies(current.prepared, current.response)
        const queue = this.pendingFollowups.get(scopeKey)
        current = queue?.shift()
        if (queue?.length === 0) this.pendingFollowups.delete(scopeKey)
        this.broadcastLiveActivities()
      }
    })()
    this.activeConversationRuns.set(scopeKey, operation)
    this.backgroundRuns.add(operation)
    void operation.finally(() => {
      this.activeConversationRuns.delete(scopeKey)
      this.backgroundRuns.delete(operation)
      this.broadcastLiveActivities()
    }).catch(error => { this.environment.logger?.warn(error) })
  }

  private async abortConversationRuns(
    conversation: SendMessageRequest['conversation'],
    threadId: string | undefined,
    reason: string,
  ): Promise<void> {
    const activities = [...this.liveActivitiesById.values()].filter(activity =>
      activity.conversation.kind === conversation.kind && activity.conversation.id === conversation.id &&
      activity.threadId === threadId)
    const runIds = new Set(activities.map(activity => activity.id))
    const runs = [...this.activeAgentRuns.values()].filter(run => runIds.has(run.id) && !run.abortController.signal.aborted)
    await Promise.all(runs.map(async (run) => {
      run.abortController.abort(new Error(reason))
      const sessionId = this.activeAcpSessions.get(run.scopeKey)
      if (sessionId !== undefined) await this.acpProcesses.get(run.scopeKey)?.cancelSession(sessionId)
    }))
    const sourceMessageIds = new Set(activities.map(activity => activity.sourceMessageId))
    let changed = false
    for (const sourceMessageId of sourceMessageIds) {
      changed = this.updateMessageReplyStatus(conversation, sourceMessageId, 'cancelled', reason) || changed
    }
    if (changed) {
      await this.persist()
      this.broadcastRevision()
    }
  }

  private async acceptSend(prepared: PreparedSend): Promise<SendMessageResponse> {
    if (!this.conversationIsCurrent(prepared, prepared.thread)) {
      throw new Error('conversation changed before message acceptance')
    }
    const previousState = this.state
    await this.persistImageAttachments(prepared.attachments)
    const createdAt = now()
    const acceptedId = messageId()
    let thread = prepared.thread
    if (prepared.request.conversation.kind === 'channel' && thread === undefined) {
      const id = crypto.randomUUID()
      thread = {
        id,
        channelId: prepared.request.conversation.id,
        projectIds: prepared.projects.map(project => project.id),
        projectId: prepared.project?.id ?? null,
        rootMessageId: acceptedId,
        agentIds: prepared.agentIds,
        createdAt,
      }
    }
    const accepted: CommonspaceMessage = {
      id: acceptedId,
      conversation: prepared.request.conversation,
      authorType: 'user',
      authorId: 'user',
      authorName: 'Ralph',
      text: prepared.text,
      ...(prepared.routing === undefined ? {} : { routing: prepared.routing }),
      ...(prepared.attachments.length === 0 ? {} : { attachments: prepared.attachments.map(attachment => attachment.metadata) }),

      createdAt,
      ...projectReferenceFields(prepared.projects),
      ...(thread === undefined ? {} : { threadId: thread.id }),
      ...(prepared.thread === undefined ? {} : { parentMessageId: prepared.thread.rootMessageId }),
      ...(prepared.request.conversation.kind === 'dm' ? { replyStatus: 'queued' } : {}),
    }
    const key = conversationKey(prepared.request.conversation)
    const currentMessages = this.state.messages[key] ?? []
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      channels: prepared.channel === undefined
        ? this.state.channels
        : this.state.channels.map(existing => existing.id === prepared.channel?.id
            ? { ...existing, agentIds: prepared.channel.agentIds }
            : existing),
      messages: { ...this.state.messages, [key]: [...currentMessages, accepted].slice(-500) },
      threads: prepared.thread === undefined && thread !== undefined
        ? [...this.state.threads, thread]
        : this.state.threads.map(existing => {
            if (existing.id !== thread?.id) return existing
            const updated: CommonspaceThread = {
              ...existing,
              agentIds: prepared.thread?.agentIds ?? existing.agentIds,
            }
            return updated
          }),
    }
    try {
      await this.persist()
    } catch (error) {
      this.state = previousState
      await this.removeImageAttachments(prepared.attachments.map(attachment => attachment.metadata.id))
      throw error
    }
    this.broadcastRevision()
    return { accepted, ...(thread === undefined ? {} : { thread }), state: this.publicSnapshot() }
  }

  private async processReplies(prepared: PreparedSend, response: SendMessageResponse): Promise<void> {
    const routed = await this.resolvePendingRouting(prepared, response)
    if (routed === null) return
    prepared = routed.prepared
    response = routed.response
    const thread = response.thread
    const projectRoots = preparedProjectRoots(prepared.projects)
    const cwd = projectRoots[0]?.path ?? this.defaultCwd
    const explicitlyTargetsAll = prepared.request.conversation.kind === 'channel'
      && parseTags(prepared.text).agents.includes('all')
    const effectiveLimit = explicitlyTargetsAll
      ? prepared.agentIds.length
      : Math.min(this.maxAgentsPerTurn, this.state.defaults.maxAgentsPerTurn)
    const effectiveModel = prepared.channel?.settings.model ?? this.state.defaults.model ?? undefined
    const effectiveReasoning = prepared.channel?.settings.reasoning ?? this.state.defaults.reasoning
    const memberIds = prepared.channel?.agentIds ?? thread?.agentIds ?? prepared.agentIds
    const delivered = new Set<string>()

    const rootDelivery: AgentDelivery = {
      authorType: 'user',
      authorId: response.accepted.authorId,
      authorName: response.accepted.authorName,
      text: response.accepted.text,

      ...(prepared.attachments.length === 0
        ? {}
        : { images: prepared.attachments.map(attachment => ({
            name: attachment.metadata.name,
            mimeType: attachment.metadata.mimeType,
            data: attachment.data.toString('base64'),
          })) }),
    }

    const deliver = async (agentId: string, delivery: AgentDelivery): Promise<void> => {
      if (delivered.has(agentId) || delivered.size >= effectiveLimit) return
      delivered.add(agentId)
      const agent = prepared.agents.find(candidate => candidate.id === agentId)
      if (agent === undefined) return
      const authority = this.agentAuthority(agent)
      if (authority === undefined) return
      const sessionName = prepared.request.conversation.kind === 'dm'
        ? prepared.dmSessionName ?? 'Bot Chat'
        : `Commonspace Thread: ${thread?.id ?? crypto.randomUUID()}`
      const activeRun: ActiveAgentRun = {
        id: crypto.randomUUID(),
        sourceMessageId: response.accepted.id,
        agentId: agent.id,
        scopeKey: `${agent.id}\u0000${sessionName}`,
        abortController: new AbortController(),
      }
      this.activeAgentRuns.set(activeRun.id, activeRun)
      const executionIsCurrent = () => !activeRun.abortController.signal.aborted && !this.closing && this.agentAuthorityIsCurrent(agent, authority) && this.conversationIsCurrent(prepared, thread)
      const sessionId = this.state.agentSessions[agent.id]?.[sessionName]
      const agentModel = effectiveModel ?? (agent.adapter === 'hermes' || agent.nativeProfile !== undefined ? undefined : agent.model ?? undefined)
      let agentResponse: AgentRunResult | null
      let runStartedAt = now()
      let runSnapshots: Array<PreparedProjectRoot & { snapshot: RunSnapshot }> = []
      try {
        agentResponse = await this.withAgentSessionLock(agent.id, sessionName, async () => {
          if (!executionIsCurrent()) return null
          const liveActivityId = this.beginLiveActivity(activeRun.id, response.accepted.id, agent, prepared.request.conversation, thread?.id)
          try {
            if (prepared.request.conversation.kind === 'dm' &&
              this.updateMessageReplyStatus(prepared.request.conversation, response.accepted.id, 'running')) {
              await this.persist()
              this.broadcastRevision()
            }
            runStartedAt = now()
            runSnapshots = await Promise.all(projectRoots.map(async root => ({
              ...root,
              snapshot: await captureRunSnapshot(root.path),
            })))
            const result = await this.runAgentWithSessionRecovery({
              agent,
              cwd,
              additionalCwds: projectRoots.slice(1).map(root => root.path),
              sessionName,
              message: delivery.text,
              ...(delivery.images === undefined ? {} : { images: delivery.images }),
              commonspaceScope: {
                agentId: agent.id,
                conversation: prepared.request.conversation,
                sessionName,
                ...(thread === undefined ? {} : { threadId: thread.id }),
                ...(prepared.projects.length === 0
                  ? {}
                  : { projectIds: prepared.projects.map(project => project.id), projectId: prepared.projects[0]!.id }),
              },
              ...(sessionId === undefined ? {} : { sessionId }),
              ...(agentModel === undefined ? {} : { model: agentModel }),
              ...(agent.nativeProfile === undefined ? { reasoning: effectiveReasoning } : {}),
              onTraceUpdate: entries => {
                if (executionIsCurrent()) this.updateLiveActivity(liveActivityId, entries)
              },
              signal: activeRun.abortController.signal,
            }, executionIsCurrent)
            return result
          } finally {
            this.endLiveActivity(liveActivityId)
          }
        })
      } catch (error) {
        if (!executionIsCurrent()) return
        const message = this.publicAgentFailure(error)
        if (prepared.request.conversation.kind === 'dm') {
          const status = /timed? out|timeout/iu.test(message) ? 'timeout' : 'failed'
          this.updateMessageReplyStatus(prepared.request.conversation, response.accepted.id, status, message)
        }
        this.append({
          id: messageId(),
          sourceMessageId: response.accepted.id,
          conversation: prepared.request.conversation,
          authorType: 'system',
          authorId: 'system',
          authorName: 'Commonspace',
          text: `@${agent.id} run failed: ${message}`,
          createdAt: now(),
          ...projectReferenceFields(prepared.projects),
          ...(thread === undefined ? {} : { threadId: thread.id, parentMessageId: thread.rootMessageId }),
        })
        await this.persist()
        this.broadcastRevision()
        return
      } finally {
        this.activeAgentRuns.delete(activeRun.id)
      }
      if (agentResponse === null || !executionIsCurrent()) return
      if (agentResponse.sessionId !== undefined) this.rememberAgentSession(agent.id, sessionName, agentResponse.sessionId)
      if (prepared.request.conversation.kind === 'dm') {
        const status = completedReplyStatus(agentResponse.text)
        this.updateMessageReplyStatus(
          prepared.request.conversation,
          response.accepted.id,
          status,
          status === 'silent' ? 'The agent completed without returning a visible response.' : undefined,
        )
      }
      const trace = agentResponse.trace === undefined
        ? undefined
        : this.publicAgentTrace(agentResponse.trace, agent.adapter)
      const completedAt = now()
      const runAttribution: CommonspaceRunAttribution | undefined = prepared.projects.length === 0
        ? undefined
        : {
            startedAt: runStartedAt,
            completedAt,
            roots: await Promise.all(runSnapshots.map(async ({ path, snapshot, rootIndex, projectId, projectRootIndex }) => ({
              ...await completeRunAttribution(path, snapshot, rootIndex),
              projectId,
              projectRootIndex,
            }))),
          }
      const reply: CommonspaceMessage = {
        id: messageId(),
        sourceMessageId: response.accepted.id,
        conversation: prepared.request.conversation,
        authorType: 'agent',
        authorId: agent.id,
        authorName: agent.displayName,
        text: agentResponse.text,
        createdAt: completedAt,
        ...projectReferenceFields(prepared.projects),
        ...(trace === undefined ? {} : { trace }),
        ...(runAttribution === undefined ? {} : { runAttribution }),
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
      await this.updateChannelMemory(thread.channelId)
    }
  }

  private async resolvePendingRouting(
    prepared: PreparedSend,
    response: SendMessageResponse,
  ): Promise<{ prepared: PreparedSend; response: SendMessageResponse } | null> {
    if (prepared.routing?.status !== 'pending' || prepared.request.conversation.kind !== 'channel') {
      return { prepared, response }
    }
    try {
      const memberIds = prepared.thread?.agentIds ?? prepared.channel?.agentIds ?? []
      const decision = await this.routeChannelMessage(prepared.text, prepared.request, prepared.thread, memberIds, prepared.agents)
      const routing: CommonspaceRoutingDecision = { source: 'ai', status: 'resolved', ...decision }
      const thread = response.thread === undefined ? undefined : { ...response.thread, agentIds: decision.agentIds }
      const accepted: CommonspaceMessage = { ...response.accepted, routing }
      const key = conversationKey(prepared.request.conversation)
      this.state = {
        ...this.state,
        revision: this.state.revision + 1,
        messages: {
          ...this.state.messages,
          [key]: (this.state.messages[key] ?? []).map(message => message.id === accepted.id ? accepted : message),
        },
        threads: thread === undefined
          ? this.state.threads
          : this.state.threads.map(existing => existing.id === thread.id ? thread : existing),
      }
      await this.persist()
      this.broadcastRevision()
      return {
        prepared: { ...prepared, agentIds: decision.agentIds, routing, ...(thread === undefined ? {} : { thread }) },
        response: { ...response, accepted, ...(thread === undefined ? {} : { thread }), state: this.publicSnapshot() },
      }
    } catch (error) {
      const routing: CommonspaceRoutingDecision = {
        source: 'ai',
        status: 'failed',
        agentIds: [],
        reason: error instanceof Error ? error.message : 'Inference routing failed.',
      }
      const key = conversationKey(prepared.request.conversation)
      this.state = {
        ...this.state,
        revision: this.state.revision + 1,
        messages: {
          ...this.state.messages,
          [key]: (this.state.messages[key] ?? []).map(message => message.id === response.accepted.id ? { ...message, routing } : message),
        },
      }
      await this.persist()
      this.broadcastRevision()
      return null
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

  private async inferChannelMemory(
    channelId: string,
    projection: CommonspaceChannelMemory,
  ): Promise<CommonspaceChannelMemory> {
    if ((projection.sourceMessageCount ?? 0) === 0) return { ...projection, origin: 'inference' }
    const compacted = parseChannelContextCompaction(await this.completeInference(
      'You compact bounded shared workspace context. Return only the requested JSON object.',
      buildChannelContextCompactionPrompt(this.state, channelId, projection),
      2_000,
    ))
    return inferredChannelMemory(projection, compacted, now())
  }

  private async updateChannelMemory(channelId: string): Promise<void> {
    const channel = this.state.channels.find(candidate => candidate.id === channelId)
    if (channel === undefined) return
    const projection = projectChannelMemory(this.state, channelId, this.state.defaults.memoryThreads)
    let memory = mergeChannelMemoryProjection(
      channel.memory,
      projection,
    )
    if ((projection.estimatedTokens ?? 0) >= SHARED_CONTEXT_PRESSURE_TOKENS &&
      (memory.origin === 'automatic' || memory.status === 'stale')) {
      try {
        memory = await this.inferChannelMemory(channelId, projection)
      } catch (error) {
        this.environment.logger?.warn(`Commonspace context compaction failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      channels: this.state.channels.map(channel => channel.id === channelId ? { ...channel, memory } : channel),
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

  private broadcastLiveActivities(): void {
    const activities = this.liveActivities()
    for (const listener of this.liveActivityListeners) {
      try {
        listener(activities)
      } catch {
        this.liveActivityListeners.delete(listener)
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
      const conflict = this.discoveredAgentCandidates.some(agent => agent.id === id)
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

  private async discoverAgentCandidates(adapter: AgentAdapterKind): Promise<CommonspaceAgentProfile[]> {
    if (adapter === 'codex') {
      const candidates = await discoverCodexAgents({
        cwd: this.defaultCwd,
        projectPaths: this.state.projects.flatMap(project => project.paths),
      })
      this.codexAgentProfileConfigs.clear()
      for (const candidate of candidates) this.codexAgentProfileConfigs.set(candidate.profile.id, candidate.config)
      return candidates.map(candidate => candidate.profile)
    }
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
        discovered = await Promise.all(discovered.map(async (agent) => {
          try {
            const result = await execFileAsync(this.hermesPath, ['profile', 'describe', agent.id], {
              maxBuffer: MAX_PROFILE_LIST_BYTES,
              timeout: 30_000,
              encoding: 'utf8',
            })
            const description = parseHermesProfileDescription(result.stdout)
            return description === undefined ? agent : { ...agent, description }
          } catch {
            return agent
          }
        }))
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

  private configuredAgents(discoveredAgents: CommonspaceAgentProfile[] = this.discoveredAgentCandidates): CommonspaceAgentProfile[] {
    const discoveredById = new Map(discoveredAgents.map(agent => [agent.id, agent]))
    return this.state.agents.map<CommonspaceAgentProfile>((agent) => {
      if (agent.adapter === 'hermes' || agent.nativeProfile !== undefined) {
        const discovered = discoveredById.get(agent.id)
        if (discovered?.adapter === agent.adapter) {
          return {
            id: agent.id,
            displayName: agent.displayName,
            ...(agent.avatarEmoji === undefined ? {} : { avatarEmoji: agent.avatarEmoji }),
            ...(agent.accentColor === undefined ? {} : { accentColor: agent.accentColor }),
            adapter: agent.adapter,
            ...(agent.nativeProfile === undefined ? {} : { nativeProfile: agent.nativeProfile }),
            model: discovered.model,
            status: discovered.status,
            ...(discovered.description === undefined ? {} : { description: discovered.description }),
          }
        }
      }
      return {
        id: agent.id,
        displayName: agent.displayName,
        ...(agent.avatarEmoji === undefined ? {} : { avatarEmoji: agent.avatarEmoji }),
        ...(agent.accentColor === undefined ? {} : { accentColor: agent.accentColor }),
        adapter: agent.adapter,
        ...(agent.nativeProfile === undefined ? {} : { nativeProfile: agent.nativeProfile }),
        model: agent.model,
        status: 'unknown',
      }
    })
  }

  private async completeInference(system: string, prompt: string, maxTokens: number): Promise<string> {
    if (this.routingConfiguration.provider === 'openai-compatible') {
      const apiKey = this.routingConfiguration.apiKey ??
        (routingUsesOpenAiOrigin(this.routingConfiguration.baseUrl) ? process.env.OPENAI_API_KEY : undefined)
      return completeWithOpenAICompatible({
        baseUrl: this.routingConfiguration.baseUrl,
        model: this.routingConfiguration.model,
        ...(apiKey === undefined ? {} : { apiKey }),
        signal: AbortSignal.timeout(30_000),
      }, { system, prompt, maxTokens })
    }
    if (this.routingConfiguration.provider === 'harness') {
      const agent = this.configuredAgents().find(candidate => candidate.id === this.routingConfiguration.harnessAgentId)
      if (agent === undefined) throw new Error('routing harness is unavailable')
      const result = await this.runAgent({
        agent,
        cwd: this.defaultCwd,
        additionalCwds: [],
        sessionName: 'Commonspace Inference',
        message: `${system}\n\n${prompt}`,
        reasoning: 'minimal',
        signal: AbortSignal.timeout(30_000),
      })
      return result.text
    }
    throw new Error('unsupported routing provider')
  }

  private async routeAgents(input: CommonspaceRouteInput): Promise<CommonspaceRouteResult> {
    return parseRoutingResponse(await this.completeInference(
      'You are a bounded routing classifier. Return only the requested JSON object.',
      buildRoutingPrompt(input),
      250,
    ))
  }

  private async runAgent(input: AgentRunInput): Promise<AgentRunResult> {
    if (this.overrides.runAgent !== undefined) {
      const result = await this.overrides.runAgent(input)
      return typeof result === 'string' ? { text: result } : result
    }
    return this.runAcpAgent(input)
  }

  private beginLiveActivity(
    id: string,
    sourceMessageId: string,
    agent: CommonspaceAgentProfile,
    conversation: SendMessageRequest['conversation'],
    threadId: string | undefined,
  ): string {
    this.liveActivitiesById.set(id, {
      id,
      sourceMessageId,
      agentId: agent.id,
      agentName: agent.displayName,
      adapter: agent.adapter,
      conversation: structuredClone(conversation),
      ...(threadId === undefined ? {} : { threadId }),
      startedAt: now(),
      entries: [],
    })
    this.broadcastLiveActivities()
    return id
  }

  private updateLiveActivity(id: string, entries: readonly CommonspaceTraceEntry[]): void {
    const current = this.liveActivitiesById.get(id)
    if (current === undefined) return
    const completedAt = now()
    const trace = this.publicAgentTrace({
      adapter: current.adapter,
      startedAt: current.startedAt,
      completedAt,
      entries: [...entries],
    }, current.adapter)
    this.liveActivitiesById.set(id, { ...current, entries: trace?.entries ?? [] })
    this.broadcastLiveActivities()
  }

  private endLiveActivity(id: string): void {
    if (!this.liveActivitiesById.delete(id)) return
    this.broadcastLiveActivities()
  }

  private async codexAgentProfileConfig(agent: CommonspaceAgentProfile, cwd: string): Promise<CodexAgentProfileConfig | undefined> {
    const nativeProfile = agent.nativeProfile
    if (agent.adapter !== 'codex' || nativeProfile === undefined) return undefined
    const cached = this.codexAgentProfileConfigs.get(agent.id)
    if (cached?.name === nativeProfile) return cached
    const candidate = await findCodexAgentProfile({
      nativeProfile,
      cwd,
      projectPaths: this.state.projects.flatMap(project => project.paths),
    })
    if (candidate === undefined) throw new Error(`Codex native agent profile "${nativeProfile}" is unavailable`)
    this.codexAgentProfileConfigs.set(agent.id, candidate.config)
    return candidate.config
  }

  private async runAcpAgent(input: AgentRunInput): Promise<AgentRunResult> {
    if (input.signal.aborted) throw input.signal.reason
    const mcpServers = this.mcpServersFor(input)
    const codexProfile = await this.codexAgentProfileConfig(input.agent, input.cwd)
    const reasoning = codexProfile === undefined ? acpReasoningValue(input.agent.adapter, input.reasoning) : undefined
    const configOptions: Record<string, string> = {
      ...(input.model === undefined || input.agent.adapter === 'hermes' || codexProfile !== undefined ? {} : { model: input.model }),
      ...(reasoning === undefined
        ? {}
        : { reasoning_effort: reasoning }),
    }
    const activeScopeKey = `${input.agent.id}\u0000${input.sessionName}`
    let processClient = this.acpProcesses.get(activeScopeKey)
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
              ...(codexProfile === undefined ? {} : { CODEX_CONFIG: JSON.stringify(codexProfileRuntimeConfig(codexProfile)) }),
            },
        requestTimeoutMs: ((this.runBudgetSeconds ?? 3_600) + 30) * 1000,
        maxResponseChars: MAX_AGENT_RESPONSE_CHARS,
        clientName: `commonspace-${input.agent.id}`,
      })
      this.acpProcesses.set(activeScopeKey, processClient)
    }
    let activeSessionId: string | undefined
    try {
      const result = await processClient.run({
        cwd: input.cwd,
        additionalCwds: input.additionalCwds,
        message: input.message,
        ...(input.images === undefined ? {} : { images: input.images }),
        mcpServers,
        modeId: input.agent.adapter === 'hermes'
          ? (this.hermesYolo ? 'dont_ask' : 'accept_edits')
          : (this.externalAgentYolo ? 'agent-full-access' : 'agent'),
        ...(input.agent.adapter === 'hermes' && input.model !== undefined ? { modelId: input.model } : {}),
        configOptions,
        onSessionReady: sessionId => {
          activeSessionId = sessionId
          this.activeAcpSessions.set(activeScopeKey, sessionId)
          if (input.signal.aborted) void processClient.cancelSession(sessionId)
        },
        ...(input.onTraceUpdate === undefined ? {} : { onTraceUpdate: input.onTraceUpdate }),
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
    } finally {
      if (activeSessionId !== undefined && this.activeAcpSessions.get(activeScopeKey) === activeSessionId) {
        this.activeAcpSessions.delete(activeScopeKey)
      }
      if (this.acpProcesses.get(activeScopeKey) === processClient) this.acpProcesses.delete(activeScopeKey)
      await processClient.close().catch(error => { this.environment.logger?.warn(error) })
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

  private async persistImageAttachments(attachments: readonly PreparedImageAttachment[]): Promise<void> {
    const storedIds: string[] = []
    try {
      for (const attachment of attachments) {
        const temporary = join(this.attachmentsRoot, `attachment-${process.pid}-${crypto.randomUUID()}.tmp`)
        try {
          await writeFile(temporary, attachment.data, { mode: 0o600, flag: 'wx' })
          await rename(temporary, join(this.attachmentsRoot, attachment.metadata.id))
          storedIds.push(attachment.metadata.id)
        } finally {
          await rm(temporary, { force: true })
        }
      }
    } catch (error) {
      await this.removeImageAttachments(storedIds)
      throw error
    }
  }

  private async removeImageAttachments(ids: readonly string[]): Promise<void> {
    await Promise.all(ids.map(id => rm(join(this.attachmentsRoot, id), { force: true })))
  }

  private publicRoutingConfiguration(): CommonspaceRoutingConfiguration {
    return {
      provider: this.routingConfiguration.provider,
      model: this.routingConfiguration.model,
      harnessAgentId: this.routingConfiguration.harnessAgentId,
      baseUrl: this.routingConfiguration.baseUrl,
      apiKeyConfigured: this.routingConfiguration.apiKey !== undefined ||
        (routingUsesOpenAiOrigin(this.routingConfiguration.baseUrl) && process.env.OPENAI_API_KEY !== undefined),
    }
  }

  private async persistRoutingConfiguration(configuration: PrivateRoutingConfiguration): Promise<void> {
    const temporary = join(this.root, `routing-${process.pid}-${crypto.randomUUID()}.tmp`)
    try {
      await writeFile(temporary, JSON.stringify(configuration, null, 2), { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.routingPath)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.state, null, 2)
    const task = this.writeTail.catch(() => undefined).then(async () => {
      const temporary = join(this.root, `state-${process.pid}-${crypto.randomUUID()}.tmp`)
      const backupTemporary = join(this.root, `state-backup-${process.pid}-${crypto.randomUUID()}.tmp`)
      try {
        try {
          const previous = await readFile(this.statePath, 'utf8')
          await writeFile(backupTemporary, previous, { encoding: 'utf8', mode: 0o600 })
          await rename(backupTemporary, this.stateBackupPath)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        await writeFile(temporary, snapshot, { encoding: 'utf8', mode: 0o600 })
        await rename(temporary, this.statePath)
      } finally {
        await Promise.all([rm(temporary, { force: true }), rm(backupTemporary, { force: true })])
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
