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

function json(res: ServerResponse, status: number, body: unknown): void {
  const encoded = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(encoded),
  })
  res.end(encoded)
}

function requestIsSameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin === undefined || host === undefined) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function requestIsLoopback(req: IncomingMessage): boolean {
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
  if (record.version !== 1 || !Array.isArray(record.projects) || !Array.isArray(record.channels)) {
    return createInitialState()
  }
  return {
    version: 1,
    revision: typeof record.revision === 'number' ? record.revision : 0,
    projects: record.projects as CommonspaceState['projects'],
    channels: record.channels as CommonspaceState['channels'],
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
    return this.snapshot()
  }

  async send(request: SendMessageRequest): Promise<SendMessageResponse> {
    const key = conversationKey(request.conversation)
    const previous = this.conversationTails.get(key) ?? Promise.resolve()
    const operation = previous.catch(() => undefined).then(() => this.sendNow(request))
    this.conversationTails.set(key, operation)
    try {
      return await operation
    } finally {
      if (this.conversationTails.get(key) === operation) this.conversationTails.delete(key)
    }
  }

  registerRoutes(): () => void {
    const routes = [
      this.ctx.webServer.register({
        kind: 'exact',
        path: '/commonspace/api/bootstrap',
        handler: async (req, res) => {
          if (!requestIsLoopback(req)) return json(res, 403, { code: 'loopback_required', error: 'Commonspace is local-only' })
          if (req.method !== 'GET') return json(res, 405, { code: 'method_not_allowed', error: 'GET required' })
          json(res, 200, await this.bootstrap())
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
            json(res, 200, await this.send(asRecord(await readJsonBody(req)) as unknown as SendMessageRequest))
          } catch (error) {
            json(res, 400, { code: 'send_failed', error: error instanceof Error ? error.message : String(error) })
          }
        },
      }),
    ]
    return () => { for (const dispose of routes.reverse()) dispose() }
  }

  private async sendNow(request: SendMessageRequest): Promise<SendMessageResponse> {
    const text = request.text.normalize('NFKC').trim().slice(0, MAX_MESSAGE_CHARS)
    if (text === '') throw new Error('message text is required')
    const project = request.projectId === undefined
      ? undefined
      : this.state.projects.find(candidate => candidate.id === request.projectId)
    const cwd = project?.paths[0] ?? process.cwd()
    const projectContext = project?.paths.length
      ? `Project workspaces:\n${project.paths.map(path => `- ${path}`).join('\n')}\n\n`
      : ''
    const accepted: CommonspaceMessage = {
      id: messageId(),
      conversation: request.conversation,
      authorType: 'user',
      authorId: 'user',
      authorName: 'Ralph',
      text,
      createdAt: now(),
    }
    this.append(accepted)
    await this.persist()

    const agents = await this.discoverAgents()
    const agentIds = request.conversation.kind === 'dm'
      ? [request.conversation.id]
      : this.channelAgents(request.conversation.id, text, agents)
    const replies: CommonspaceMessage[] = []
    for (const agentId of agentIds.slice(0, this.maxAgentsPerTurn)) {
      const agent = agents.find(candidate => candidate.id === agentId)
      if (agent === undefined) continue
      const prompt = request.conversation.kind === 'dm'
        ? `${projectContext}Message from Ralph in Commonspace:\n\n${text}`
        : buildRoomPrompt({
            channel: this.state.channels.find(channel => channel.id === request.conversation.id)?.name ?? 'channel',
            agent: agent.id,
            userText: text,
            ...(project === undefined ? {} : { projectPaths: project.paths }),
            recent: (this.state.messages[conversationKey(request.conversation)] ?? []).slice(-20),
          })
      const response = await this.runAgent({
        profile: agent.id,
        cwd,
        sessionName: request.conversation.kind === 'dm'
          ? 'Bot Chat'
          : `Commonspace Channel: ${this.state.channels.find(channel => channel.id === request.conversation.id)?.name ?? request.conversation.id}`,
        prompt,
      })
      const reply: CommonspaceMessage = {
        id: messageId(),
        conversation: request.conversation,
        authorType: 'agent',
        authorId: agent.id,
        authorName: agent.displayName,
        text: response,
        createdAt: now(),
      }
      this.append(reply)
      replies.push(reply)
      await this.persist()
    }
    return { accepted, replies, state: this.snapshot() }
  }

  private channelAgents(channelId: string, text: string, agents: HermesAgentProfile[]): string[] {
    const channel = this.state.channels.find(candidate => candidate.id === channelId)
    if (channel === undefined) throw new Error('unknown channel')
    return routeChannelAgents(channel.agentIds, text, agents)
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
    await writeFile(queryFile, input.prompt, { encoding: 'utf8', mode: 0o600 })
    try {
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
    this.writeTail = this.writeTail.then(async () => {
      const temporary = join(this.root, `state-${process.pid}-${crypto.randomUUID()}.tmp`)
      await writeFile(temporary, snapshot, { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.statePath)
    })
    return this.writeTail
  }
}

export async function createCommonspaceHost(ctx: Context, config: CommonspaceHostConfig = {}): Promise<CommonspaceHostService> {
  const service = new CommonspaceHostService(ctx, config)
  await service.initialize()
  return service
}
