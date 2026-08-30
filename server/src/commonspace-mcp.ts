import { randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { ConversationRef } from '@commonspace/shared'
import { z } from 'zod'

const MAX_CREDENTIALS = 10_000

export interface CommonspaceMcpScope {
  agentId: string
  conversation: ConversationRef
  threadId?: string
  sessionName?: string
  projectIds?: string[]
  /** @deprecated Compatibility mirror of the first projectIds entry. */
  projectId?: string
}

export interface CommonspaceMcpProvider {
  readContext(scope: CommonspaceMcpScope): Promise<Record<string, unknown>>
  readMessages(scope: CommonspaceMcpScope, input: { before?: string; limit: number }): Promise<Record<string, unknown>>
  searchMessages(scope: CommonspaceMcpScope, input: { query: string; limit: number }): Promise<Record<string, unknown>>
  postProgress(scope: CommonspaceMcpScope, text: string): Promise<{ messageId: string }>
}

export interface CommonspaceMcpCredential {
  token: string
}

interface ActiveRequest {
  server: McpServer
  transport: StreamableHTTPServerTransport
}

function bearerToken(header: string | undefined): string | undefined {
  if (header === undefined || !header.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length)
  return token === '' ? undefined : token
}

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value,
  }
}

/**
 * Authenticates ACP-provided MCP connections and binds every tool call to one
 * Commonspace agent/conversation scope. The transport is intentionally
 * stateless; the bearer capability is the session continuity boundary.
 */
export class CommonspaceMcpGateway {
  readonly #provider: CommonspaceMcpProvider
  readonly #credentials = new Map<string, CommonspaceMcpScope>()
  readonly #active = new Set<ActiveRequest>()
  #closed = false

  constructor(provider: CommonspaceMcpProvider) {
    this.#provider = provider
  }

  issue(scope: CommonspaceMcpScope): CommonspaceMcpCredential {
    if (this.#closed) throw new Error('Commonspace MCP gateway is closed')
    while (this.#credentials.size >= MAX_CREDENTIALS) {
      const oldest = this.#credentials.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.#credentials.delete(oldest)
    }
    const token = randomBytes(32).toString('base64url')
    this.#credentials.set(token, structuredClone(scope))
    return { token }
  }

  revoke(token: string): void {
    this.#credentials.delete(token)
  }

  has(token: string): boolean {
    return this.#credentials.has(token)
  }

  async handle(req: Request, res: Response): Promise<void> {
    if (this.#closed) {
      res.status(503).json({ code: 'mcp_unavailable', error: 'Commonspace MCP gateway is closed' })
      return
    }
    const token = bearerToken(req.headers.authorization)
    const scope = token === undefined ? undefined : this.#credentials.get(token)
    if (scope === undefined) {
      res.status(401).setHeader('www-authenticate', 'Bearer').json({ code: 'mcp_unauthorized', error: 'valid MCP bearer capability required' })
      return
    }
    if (req.method !== 'POST') {
      res.status(405).setHeader('allow', 'POST').json({ code: 'method_not_allowed', error: 'MCP accepts POST requests only' })
      return
    }

    const server = this.#createServer(scope)
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    })
    const active = { server, transport }
    this.#active.add(active)
    try {
      // The SDK's Transport declarations do not model exactOptionalPropertyTypes.
      await server.connect(transport as never)
      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: error instanceof Error ? error.message : 'Internal MCP error' },
          id: null,
        })
      }
    } finally {
      this.#active.delete(active)
      await transport.close().catch(() => undefined)
      await server.close().catch(() => undefined)
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    this.#credentials.clear()
    const active = [...this.#active]
    this.#active.clear()
    await Promise.all(active.flatMap(({ server, transport }) => [
      transport.close().catch(() => undefined),
      server.close().catch(() => undefined),
    ]))
  }

  #createServer(scope: CommonspaceMcpScope): McpServer {
    const server = new McpServer({ name: 'commonspace', version: '0.1.0' })
    server.registerTool('commonspace_get_context', {
      title: 'Get Commonspace context',
      description: scope.conversation.kind === 'channel'
        ? 'Call once at the start of every Commonspace channel turn. Reads bounded room/thread instructions, memory, participants, and recent messages without replaying them in the user prompt.'
        : 'Read bounded Commonspace project and recent-message context when the direct message needs workspace state beyond the provider-native session.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => toolResult(await this.#provider.readContext(scope)))
    server.registerTool('commonspace_read_messages', {
      title: 'Read Commonspace messages',
      description: 'Read an older bounded page of messages from this MCP session\'s conversation and thread only.',
      inputSchema: {
        before: z.string().min(1).max(200).optional().describe('Message ID before which to read'),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async ({ before, limit }) => toolResult(await this.#provider.readMessages(scope, {
      ...(before === undefined ? {} : { before }),
      limit,
    })))
    server.registerTool('commonspace_search', {
      title: 'Search Commonspace messages',
      description: 'Search messages in this MCP session\'s conversation and thread using case-insensitive terms, quoted phrases, and -excluded terms.',
      inputSchema: {
        query: z.string().trim().min(1).max(500),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, async ({ query, limit }) => toolResult(await this.#provider.searchMessages(scope, { query, limit })))
    server.registerTool('commonspace_post_progress', {
      title: 'Post Commonspace progress',
      description: 'Post one visible progress note to the current Commonspace conversation/thread. Peer handoffs remain part of the final reply so the relay can route them exactly once.',
      inputSchema: {
        text: z.string().trim().min(1).max(4_000),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, async ({ text }) => toolResult(await this.#provider.postProgress(scope, text)))
    return server
  }
}
