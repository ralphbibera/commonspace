import { execFile } from 'node:child_process'
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {
  CommonspaceBootstrap,
  CommonspaceMessage,
  CommonspaceMutation,
  CommonspaceState,
  CommonspaceThread,
  HermesAgentProfile,
  SendMessageRequest,
  SendMessageResponse,
} from '../contracts.ts'
import { conversationKey } from '../contracts.ts'
import { buildHermesInvocation, buildRoomPrompt, parseHermesProfileList, routeChannelAgents } from './hermes.ts'
import { applyMutation, createInitialState } from './state.ts'

const execFileAsync = promisify(execFile)
const MAX_BODY_BYTES = 128 * 1024
const MAX_MESSAGE_CHARS = 16_000
const MAX_CAPTURE_BYTES = 1024 * 1024

export interface CommonspaceHostConfig {
  root?: string
  hermesPath?: string
  maxAgentsPerTurn?: number
  yolo?: boolean
  runBudgetSeconds?: number
}

interface SendDependencies {
  discoverAgents(): Promise<HermesAgentProfile[]>
  runAgent(input: {
    profile: string
    cwd: string
    sessionName: string
    prompt: string
  }): Promise<string>
}

interface PreparedSend {
  request: SendMessageRequest
  text: string
  agents: HermesAgentProfile[]
  agentIds: string[]
  channel?: CommonspaceState['channels'][number]
  project?: CommonspaceState['projects'][number]
  thread?: CommonspaceThread
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const encoded = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(encoded),
  })
  res.end(encoded)
}

export function requestIsSameOrigin(req: IncomingMessage): boolean {
  const host = req.headers.host
  if (host === undefined) return false
  const origin = req.headers.origin
  if (origin !== undefined) {
    try {
      const url = new URL(origin)
      return url.protocol === 'http:' && url.host === host
    } catch {
      return false
    }
  }
  return req.headers['sec-fetch-site'] === 'same-origin'
}

export function requestIsLoopback(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress
  return address === '127.0.0.1' || address === '::1' || address?.startsWith('::ffff:127.') === true
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let bytes = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.byteLength
    if (bytes > MAX_BODY_BYTES) throw new Error('request body is too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('request body must be an object')
  }
  return value as Record<string, unknown>
}

function messageId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function sanitizeLoadedState(value: unknown): CommonspaceState {
  if (typeof value !== 'object' || value === null) return createInitialState()
  const record = value as Record<string, unknown>
  if ((record.version !== 1 && record.version !== 2) || !Array.isArray(record.projects) || !Array.isArray(record.channels)) {
    return createInitialState()
  }
  return {
    version: 2,
    revision: typeof record.revision === 'number' ? record.revision : 0,
    projects: record.projects as CommonspaceState['projects'],
    channels: record.channels as CommonspaceState['channels'],
    threads: Array.isArray(record.threads) ? record.threads as CommonspaceState['threads'] : [],
    messages: typeof record.messages === 'object' && record.messages !== null
      ? record.messages as CommonspaceState['messages']
      : {},
  }
}

export class CommonspaceHostService {
  readonly root: string
  private readonly statePath: string
  private state: CommonspaceState = createInitialState()
  private writeTail = Promise.resolve()
  private readonly conversationTails = new Map<string, Promise<unknown>>()
  private readonly eventClients = new Set<ServerResponse>()
  private readonly backgroundRuns = new Set<Promise<void>>()
  private readonly hermesPath: string
  private readonly maxAgentsPerTurn: number
  private readonly yolo: boolean
  private readonly runBudgetSeconds: number

  constructor(
    private readonly ctx: Context,
    config: CommonspaceHostConfig = {},
    private readonly overrides: Partial<SendDependencies> = {},
  ) {
    this.root = config.root ?? join(homedir(), '.commonspace')
    this.statePath = join(this.root, 'state.json')
    this.hermesPath = config.hermesPath ?? 'hermes'
    this.maxAgentsPerTurn = Math.max(1, Math.min(8, config.maxAgentsPerTurn ?? 6))
    this.yolo = config.yolo === true
    this.runBudgetSeconds = Math.min(600, Math.max(30, config.runBudgetSeconds ?? 180))
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true })
    try {
      this.state = sanitizeLoadedState(JSON.parse(await readFile(this.statePath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.ctx.logger.warn(error)
      this.state = createInitialState()
    }
  }

  snapshot(): CommonspaceState {
    return structuredClone(this.state)
  }

  async bootstrap(): Promise<CommonspaceBootstrap> {
    return {
      agents: await this.discoverAgents(),
      state: this.snapshot(),
    }
  }

  async mutate(mutation: CommonspaceMutation): Promise<CommonspaceState> {
    const normalized = await this.normalizeMutation(mutation)
    this.state = applyMutation(this.state, normalized)
    await this.persist()
    this.broadcastRevision()
    return this.snapshot()
  }

  async send(request: SendMessageRequest): Promise<SendMessageResponse> {
    const prepared = await this.prepareSend(request)
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

  registerRoutes(): () => void {
    const routes = [
      this.ctx.webServer.register({
        kind: 'exact',
        path: '/commonspace/api/bootstrap',
        handler: async (req, res) => {
          if (!requestIsLoopback(req)) return json(res, 403, { code: 'loopback_required', error: 'Commonspace is local-only' })
          if (!requestIsSameOrigin(req)) return json(res, 403, { code: 'origin_denied', error: 'same-origin request required' })
          if (req.method !== 'GET') return json(res, 405, { code: 'method_not_allowed', error: 'GET required' })
          json(res, 200, await this.bootstrap())
        },
      }),
      this.ctx.webServer.register({
        kind: 'exact',
        path: '/commonspace/api/events',
        handler: async (req, res) => {
          if (!requestIsLoopback(req)) return json(res, 403, { code: 'loopback_required', error: 'Commonspace is local-only' })
          if (!requestIsSameOrigin(req)) return json(res, 403, { code: 'origin_denied', error: 'same-origin request required' })
          if (req.method !== 'GET') return json(res, 405, { code: 'method_not_allowed', error: 'GET required' })
          res.writeHead(200, {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-store',
            connection: 'keep-alive',
          })
          res.write(`event: revision\ndata: ${JSON.stringify({ revision: this.state.revision })}\n\n`)
          this.eventClients.add(res)
          req.on('close', () => { this.eventClients.delete(res) })
        },
      }),
      this.ctx.webServer.register({
        kind: 'exact',
        path: '/commonspace/api/mutate',
        handler: async (req, res) => {
          if (!requestIsLoopback(req)) return json(res, 403, { code: 'loopback_required', error: 'Commonspace is local-only' })
          if (req.method !== 'POST') return json(res, 405, { code: 'method_not_allowed', error: 'POST required' })
          if (!requestIsSameOrigin(req)) return json(res, 403, { code: 'origin_denied', error: 'same-origin request required' })
          try {
            const state = await this.mutate(asRecord(await readJsonBody(req)) as unknown as CommonspaceMutation)
            json(res, 200, { state })
          } catch (error) {
            json(res, 400, { code: 'invalid_mutation', error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
      this.ctx.webServer.register({
        kind: 'exact',
        path: '/commonspace/api/send',
        handler: async (req, res) => {
          if (!requestIsLoopback(req)) return json(res, 403, { code: 'loopback_required', error: 'Commonspace is local-only' })
          if (req.method !== 'POST') return json(res, 405, { code: 'method_not_allowed', error: 'POST required' })
          if (!requestIsSameOrigin(req)) return json(res, 403, { code: 'origin_denied', error: 'same-origin request required' })
          try {
            json(res, 202, await this.send(asRecord(await readJsonBody(req)) as unknown as SendMessageRequest))
          } catch (error) {
            json(res, 400, { code: 'send_failed', error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    ]
    return () => {
      for (const client of this.eventClients) client.end()
      this.eventClients.clear()
      for (const dispose of routes.reverse()) dispose()
    }
  }

  private async prepareSend(request: SendMessageRequest): Promise<PreparedSend> {
    const text = request.text.normalize('NFKC').trim().slice(0, MAX_MESSAGE_CHARS)
    if (text === '') throw new Error('message text is required')
    const agents = await this.discoverAgents()
    let channel = undefined as PreparedSend['channel']
    let project = undefined as PreparedSend['project']
    let thread = undefined as PreparedSend['thread']
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
      if (!agents.some(agent => agent.id === request.conversation.id)) throw new Error('unknown Hermes profile')
      if (request.projectId !== undefined) {
        project = this.state.projects.find(candidate => candidate.id === request.projectId)
        if (project === undefined) throw new Error('unknown project')
      }
      agentIds = [request.conversation.id]
    }
    return { request, text, agents, agentIds, ...(channel === undefined ? {} : { channel }), ...(project === undefined ? {} : { project }), ...(thread === undefined ? {} : { thread }) }
  }

  private async acceptSend(prepared: PreparedSend): Promise<SendMessageResponse> {
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
    return { accepted, ...(thread === undefined ? {} : { thread }), state: this.snapshot() }
  }

  private async processReplies(prepared: PreparedSend, response: SendMessageResponse): Promise<void> {
    const thread = response.thread
    if (thread !== undefined) await this.setThreadStatus(thread.id, 'running')
    const cwd = prepared.project?.paths[0] ?? process.cwd()
    const projectContext = prepared.project?.paths.length
      ? `Project workspaces:\n${prepared.project.paths.map(path => `- ${path}`).join('\n')}\n\n`
      : ''
    try {
      for (const agentId of prepared.agentIds.slice(0, this.maxAgentsPerTurn)) {
        const agent = prepared.agents.find(candidate => candidate.id === agentId)
        if (agent === undefined) continue
        const prompt = prepared.request.conversation.kind === 'dm'
          ? `${projectContext}Message from Ralph in Commonspace:\n\n${prepared.text}`
          : buildRoomPrompt({
              channel: prepared.channel?.name ?? 'channel',
              agent: agent.id,
              userText: prepared.text,
              ...(prepared.project === undefined ? {} : { projectPaths: prepared.project.paths }),
              recent: (this.state.messages[conversationKey(prepared.request.conversation)] ?? []).slice(-30),
            })
        const agentResponse = await this.runAgent({
          profile: agent.id,
          cwd,
          sessionName: prepared.request.conversation.kind === 'dm'
            ? 'Bot Chat'
            : `Commonspace Thread: ${thread?.id ?? crypto.randomUUID()}`,
          prompt,
        })
        this.append({
          id: messageId(),
          conversation: prepared.request.conversation,
          authorType: 'agent',
          authorId: agent.id,
          authorName: agent.displayName,
          text: agentResponse,
          createdAt: now(),
          ...(thread === undefined ? {} : { threadId: thread.id, parentMessageId: thread.rootMessageId }),
        })
        await this.persist()
        this.broadcastRevision()
      }
      if (thread !== undefined) await this.setThreadStatus(thread.id, 'complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
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
      if (thread !== undefined) await this.setThreadStatus(thread.id, 'error', message)
    }
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
    const payload = `event: revision\ndata: ${JSON.stringify({ revision: this.state.revision })}\n\n`
    for (const client of this.eventClients) {
      try {
        client.write(payload)
      } catch {
        this.eventClients.delete(client)
        client.end()
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

  private async normalizeMutation(mutation: CommonspaceMutation): Promise<CommonspaceMutation> {
    if (mutation.action === 'create-project') {
      const paths = await Promise.all(mutation.paths.map(path => this.validDirectory(path)))
      return { ...mutation, paths }
    }
    if (mutation.action === 'add-project-path') {
      return { ...mutation, path: await this.validDirectory(mutation.path) }
    }
    return mutation
  }

  private async validDirectory(path: string): Promise<string> {
    if (!isAbsolute(path)) throw new Error('project path must be absolute')
    const resolved = await realpath(path)
    if (!(await stat(resolved)).isDirectory()) throw new Error('project path must be a directory')
    return resolved
  }

  private async discoverAgents(): Promise<HermesAgentProfile[]> {
    if (this.overrides.discoverAgents !== undefined) return this.overrides.discoverAgents()
    const { stdout } = await execFileAsync(this.hermesPath, ['profile', 'list'], {
      maxBuffer: MAX_CAPTURE_BYTES,
      timeout: 30_000,
      encoding: 'utf8',
    })
    const agents = parseHermesProfileList(stdout)
    if (agents.length === 0) throw new Error('Hermes returned no profiles')
    return agents
  }

  private async runAgent(input: { profile: string; cwd: string; sessionName: string; prompt: string }): Promise<string> {
    if (this.overrides.runAgent !== undefined) return this.overrides.runAgent(input)
    const tempRoot = join(this.root, 'tmp')
    await mkdir(tempRoot, { recursive: true })
    const queryFile = join(tempRoot, `${crypto.randomUUID()}.txt`)
    try {
      await writeFile(queryFile, input.prompt, { encoding: 'utf8', mode: 0o600 })
      const invocation = buildHermesInvocation({
        profile: input.profile,
        cwd: input.cwd,
        sessionName: input.sessionName,
        queryFile,
        hermesPath: this.hermesPath,
        yolo: this.yolo,
      })
      const { stdout, stderr } = await execFileAsync(invocation.command, [
        ...invocation.args,
        '--run-budget', String(this.runBudgetSeconds),
      ], {
        maxBuffer: MAX_CAPTURE_BYTES,
        timeout: (this.runBudgetSeconds + 30) * 1000,
        encoding: 'utf8',
      })
      const response = stdout.trim()
      if (response === '') throw new Error(stderr.trim() || `Hermes profile ${input.profile} returned no response`)
      return response.slice(0, 64_000)
    } finally {
      await rm(queryFile, { force: true })
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

export async function createCommonspaceHost(ctx: Context, config: CommonspaceHostConfig = {}): Promise<CommonspaceHostService> {
  const service = new CommonspaceHostService(ctx, config)
  await service.initialize()
  return service
}
