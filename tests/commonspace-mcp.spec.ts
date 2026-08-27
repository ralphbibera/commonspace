import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCommonspaceApp } from '../server/src/app.ts'
import { CommonspaceMcpGateway } from '../server/src/commonspace-mcp.ts'

const closers: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.all(closers.splice(0).map(close => close()))
})

describe('Commonspace MCP gateway', () => {
  it('serves bounded session-scoped context over authenticated loopback HTTP', async () => {
    const readMessages = vi.fn(async () => ({
      messages: [{ id: 'message-older', authorName: 'Ralph', text: 'Earlier context.' }],
      nextBefore: null,
    }))
    const postProgress = vi.fn(async (_scope: unknown, text: string) => ({ messageId: `posted:${text}` }))
    const gateway = new CommonspaceMcpGateway({
      readContext: async scope => ({
        agent: { id: scope.agentId, displayName: 'Review Bot' },
        conversation: { kind: 'channel', id: 'channel-1', name: 'engineering' },
        instructions: 'Keep changes scoped.',
        messages: [{ id: 'message-1', authorName: 'Ralph', text: 'Review the relay.' }],
      }),
      readMessages,
      postProgress,
    })
    const credential = gateway.issue({
      agentId: 'codex-review-bot',
      conversation: { kind: 'channel', id: 'channel-1' },
      threadId: 'thread-1',
    })
    const app = createCommonspaceApp({ service: {} as never, mcpGateway: gateway })
    const server = createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    const url = new URL(`http://127.0.0.1:${String(address.port)}/api/mcp`)
    closers.push(async () => {
      await gateway.close()
      await new Promise<void>((resolve, reject) => server.close(error => error === undefined ? resolve() : reject(error)))
    })

    const unauthorized = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(unauthorized.status).toBe(401)

    const client = new Client({ name: 'commonspace-mcp-test', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { authorization: `Bearer ${credential.token}` } },
    })
    await client.connect(transport as never)
    const tools = await client.listTools()
    expect(tools.tools.map(tool => tool.name)).toEqual([
      'commonspace_get_context',
      'commonspace_read_messages',
      'commonspace_post_progress',
    ])
    const context = await client.callTool({ name: 'commonspace_get_context', arguments: {} })
    expect(context.structuredContent).toMatchObject({
      agent: { id: 'codex-review-bot' },
      conversation: { id: 'channel-1' },
      messages: [{ text: 'Review the relay.' }],
    })
    const history = await client.callTool({
      name: 'commonspace_read_messages',
      arguments: { before: 'message-1', limit: 7 },
    })
    expect(history.structuredContent).toMatchObject({
      messages: [{ id: 'message-older', text: 'Earlier context.' }],
    })
    expect(readMessages).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'codex-review-bot',
      conversation: { kind: 'channel', id: 'channel-1' },
      threadId: 'thread-1',
    }), { before: 'message-1', limit: 7 })
    const progress = await client.callTool({
      name: 'commonspace_post_progress',
      arguments: { text: 'Reviewing now.' },
    })
    expect(progress.structuredContent).toEqual({ messageId: 'posted:Reviewing now.' })
    expect(postProgress).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'codex-review-bot',
      threadId: 'thread-1',
    }), 'Reviewing now.')
    await client.close()
  })
})
