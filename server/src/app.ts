import type { IncomingMessage } from 'node:http'
import express, { type ErrorRequestHandler, type Express, type NextFunction, type Request, type Response } from 'express'
import { COMMONSPACE_SEARCH_KINDS, type CommonspaceLiveAgentActivity, type CommonspaceMutation, type CommonspaceSearchKind, type DiscoverAgentsRequest, type RemoveFollowupRequest, type ReorderFollowupRequest, type SelectDirectoryResponse, type SendMessageRequest, type StopAgentRunsRequest, type UpdateChannelContextRequest, type UpdateRoutingConfigurationRequest } from '@commonspace/shared'
import type { CommonspaceHostService } from './service.js'
import type { CommonspaceMcpGateway } from './commonspace-mcp.js'
import { selectLocalDirectory } from './directory-picker.js'
import {
  listProjectFiles,
  openProjectFile,
  openProjectFileInEditor,
  ProjectFileError,
  projectGitDiff,
  projectGitStatus,
  streamProjectFile,
} from './project-files.js'
import { searchCommonspace } from './search.js'

const MAX_BODY_BYTES = 128 * 1024
const MAX_SEND_BODY_BYTES = 24 * 1024 * 1024

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  const trimmed = first?.split(',')[0]?.trim()
  return trimmed === '' ? undefined : trimmed
}

function requestBrowserHost(req: IncomingMessage): string | undefined {
  return firstHeaderValue(req.headers['x-forwarded-host']) ?? req.headers.host
}

function urlMatchesRequestHost(value: string, host: string | undefined): boolean {
  if (host === undefined) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && url.host === host
  } catch {
    return false
  }
}

export interface CreateCommonspaceAppOptions {
  service: CommonspaceHostService
  mcpGateway?: CommonspaceMcpGateway
  directoryPicker?: () => Promise<string | null>
}

export function requestIsSameOrigin(req: IncomingMessage): boolean {
  const host = requestBrowserHost(req)
  if (host === undefined) return false
  const origin = req.headers.origin
  if (origin !== undefined) {
    return urlMatchesRequestHost(origin, host)
  }
  const referer = req.headers.referer
  if (referer !== undefined) {
    return urlMatchesRequestHost(referer, host)
  }
  return req.headers['sec-fetch-site'] === 'same-origin'
}

export function requestIsLoopback(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress
  return address === '127.0.0.1' || address === '::1' || address?.startsWith('::ffff:127.') === true
}

function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!requestIsSameOrigin(req)) {
    res.status(403).json({ code: 'origin_denied', error: 'same-origin request required' })
    return
  }
  next()
}

function recordBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('request body must be an object')
  }
  return value as Record<string, unknown>
}

function queryString(value: unknown, fallback = ''): string {
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw new ProjectFileError(400, 'invalid_query', 'Query parameter must be a string')
  return value
}

function queryRootIndex(value: unknown): number {
  if (value === undefined) return 0
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
    throw new ProjectFileError(400, 'invalid_project_root', 'Project folder index must be a non-negative integer')
  }
  const rootIndex = Number(value)
  if (!Number.isSafeInteger(rootIndex)) throw new ProjectFileError(400, 'invalid_project_root', 'Project folder index is too large')
  return rootIndex
}

function projectIdParam(value: unknown): string {
  if (typeof value !== 'string' || value === '') throw new ProjectFileError(400, 'invalid_project_id', 'Project id is required')
  return value
}

function sendProjectError(res: Response, error: unknown): void {
  if (error instanceof ProjectFileError) {
    res.status(error.status).json({ code: error.code, error: error.message })
    return
  }
  res.status(500).json({ code: 'project_read_failed', error: 'Unable to read project files' })
}

export function createCommonspaceApp({ service, mcpGateway, directoryPicker }: CreateCommonspaceAppOptions): Express {
  const app = express()
  const pickDirectory = directoryPicker ?? selectLocalDirectory
  app.disable('x-powered-by')

  app.use('/api', (req, res, next) => {
    if (!requestIsLoopback(req)) {
      res.status(403).json({ code: 'loopback_required', error: 'Commonspace is local-only' })
      return
    }
    res.setHeader('cache-control', 'no-store')
    next()
  })
  app.use('/api/send', express.json({ limit: MAX_SEND_BODY_BYTES }))
  app.use('/api', express.json({ limit: MAX_BODY_BYTES }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  if (mcpGateway !== undefined) {
    app.all('/api/mcp', (req, res) => {
      void mcpGateway.handle(req, res)
    })
  }

  app.get('/api/bootstrap', requireSameOrigin, async (_req, res) => {
    res.json(await service.bootstrap())
  })

  app.get('/api/search', requireSameOrigin, async (req, res) => {
    try {
      const query = queryString(req.query.q)
      const rawKinds = queryString(req.query.types)
      const kinds = rawKinds === '' ? [] : rawKinds.split(',').filter((kind): kind is CommonspaceSearchKind => COMMONSPACE_SEARCH_KINDS.includes(kind as CommonspaceSearchKind))
      if (rawKinds !== '' && kinds.length !== rawKinds.split(',').length) throw new Error('search contains an invalid result type')
      const rawLimit = queryString(req.query.limit, '24')
      if (!/^\d+$/u.test(rawLimit)) throw new Error('search limit must be a positive integer')
      const projectId = queryString(req.query.project)
      res.json(await searchCommonspace(await service.bootstrap(), {
        query,
        ...(kinds.length === 0 ? {} : { kinds }),
        ...(projectId === '' ? {} : { projectId }),
        limit: Number(rawLimit),
      }))
    } catch (error) {
      res.status(400).json({ code: 'search_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/routing', requireSameOrigin, (_req, res) => {
    res.json(service.routing())
  })

  app.put('/api/routing', requireSameOrigin, async (req, res) => {
    try {
      res.json(await service.updateRoutingConfiguration(recordBody(req.body) as unknown as UpdateRoutingConfigurationRequest))
    } catch (error) {
      res.status(400).json({ code: 'routing_configuration_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/channels/:channelId/context', requireSameOrigin, (req, res) => {
    try {
      const channelId = req.params.channelId
      if (typeof channelId !== 'string' || channelId === '') throw new Error('channel id is required')
      res.json(service.channelContext(channelId))
    } catch (error) {
      res.status(404).json({ code: 'channel_context_not_found', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.put('/api/channels/:channelId/context', requireSameOrigin, async (req, res) => {
    try {
      const channelId = req.params.channelId
      if (typeof channelId !== 'string' || channelId === '') throw new Error('channel id is required')
      res.json(await service.updateChannelContext(channelId, recordBody(req.body) as unknown as UpdateChannelContextRequest))
    } catch (error) {
      res.status(400).json({ code: 'channel_context_update_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/api/channels/:channelId/context/compact', requireSameOrigin, async (req, res) => {
    try {
      const channelId = req.params.channelId
      if (typeof channelId !== 'string' || channelId === '') throw new Error('channel id is required')
      res.json(await service.compactChannelContext(channelId))
    } catch (error) {
      res.status(400).json({ code: 'channel_context_compaction_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/projects/:projectId/files', requireSameOrigin, async (req, res) => {
    try {
      res.json(await listProjectFiles(
        service.snapshot(),
        projectIdParam(req.params.projectId),
        queryRootIndex(req.query.root),
        queryString(req.query.path),
      ))
    } catch (error) {
      sendProjectError(res, error)
    }
  })

  app.get('/api/projects/:projectId/file', requireSameOrigin, async (req, res) => {
    try {
      const file = await openProjectFile(
        service.snapshot(),
        projectIdParam(req.params.projectId),
        queryRootIndex(req.query.root),
        queryString(req.query.path),
      )
      await streamProjectFile(req, res, file)
    } catch (error) {
      if (res.headersSent) {
        res.destroy()
        return
      }
      sendProjectError(res, error)
    }
  })

  app.post('/api/projects/:projectId/open', requireSameOrigin, async (req, res) => {
    try {
      const body = recordBody(req.body)
      if (typeof body.path !== 'string' || typeof body.rootIndex !== 'number' || typeof body.line !== 'number') {
        throw new ProjectFileError(400, 'invalid_editor_target', 'Editor target requires path, rootIndex, and line')
      }
      res.json(await openProjectFileInEditor(
        service.snapshot(),
        projectIdParam(req.params.projectId),
        body.rootIndex,
        body.path,
        body.line,
      ))
    } catch (error) {
      sendProjectError(res, error)
    }
  })

  app.get('/api/projects/:projectId/changes', requireSameOrigin, async (req, res) => {
    try {
      res.json(await projectGitStatus(service.snapshot(), projectIdParam(req.params.projectId), queryRootIndex(req.query.root)))
    } catch (error) {
      sendProjectError(res, error)
    }
  })

  app.get('/api/projects/:projectId/diff', requireSameOrigin, async (req, res) => {
    try {
      res.json(await projectGitDiff(
        service.snapshot(),
        projectIdParam(req.params.projectId),
        queryRootIndex(req.query.root),
        queryString(req.query.path),
      ))
    } catch (error) {
      sendProjectError(res, error)
    }
  })

  app.post('/api/discover-agents', requireSameOrigin, async (req, res) => {
    try {
      const body = recordBody(req.body) as unknown as DiscoverAgentsRequest
      if (body.adapter !== 'hermes' && body.adapter !== 'codex') throw new Error('unsupported agent adapter')
      res.json(await service.discoverAgents(body.adapter))
    } catch (error) {
      res.status(400).json({ code: 'agent_discovery_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/events', requireSameOrigin, (req, res) => {
    res.status(200)
    res.setHeader('content-type', 'text/event-stream; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.setHeader('connection', 'keep-alive')
    res.flushHeaders()
    const writeRevision = (revision: number) => {
      res.write(`event: revision\ndata: ${JSON.stringify({ revision })}\n\n`)
    }
    const writeActivity = (activities: readonly CommonspaceLiveAgentActivity[]) => {
      res.write(`event: activity\ndata: ${JSON.stringify({ activities, queuedFollowups: service.queuedFollowups() })}\n\n`)
    }
    writeRevision(service.snapshot().revision)
    writeActivity(service.liveActivities())
    const unsubscribeRevision = service.subscribeToRevisions(writeRevision)
    const unsubscribeActivity = service.subscribeToLiveActivities(writeActivity)
    req.on('close', () => {
      unsubscribeRevision()
      unsubscribeActivity()
    })
  })

  app.post('/api/select-directory', requireSameOrigin, async (_req, res) => {
    try {
      const path = await pickDirectory()
      res.json({ path } satisfies SelectDirectoryResponse)
    } catch (error) {
      res.status(500).json({ code: 'directory_picker_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/api/mutate', requireSameOrigin, async (req, res) => {
    try {
      await service.mutate(recordBody(req.body) as unknown as CommonspaceMutation)
      res.json(await service.bootstrap())
    } catch (error) {
      res.status(400).json({ code: 'invalid_mutation', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/api/send', requireSameOrigin, async (req, res) => {
    try {
      res.status(202).json(await service.send(recordBody(req.body) as unknown as SendMessageRequest))
    } catch (error) {
      res.status(400).json({ code: 'send_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/api/stop', requireSameOrigin, async (req, res) => {
    try {
      res.json(await service.stopAgentRuns(recordBody(req.body) as unknown as StopAgentRunsRequest))
    } catch (error) {
      res.status(400).json({ code: 'stop_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/api/followups/reorder', requireSameOrigin, async (req, res) => {
    try {
      res.json(await service.reorderFollowup(recordBody(req.body) as unknown as ReorderFollowupRequest))
    } catch (error) {
      res.status(400).json({ code: 'followup_reorder_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/api/followups/remove', requireSameOrigin, async (req, res) => {
    try {
      res.json(await service.removeFollowup(recordBody(req.body) as unknown as RemoveFollowupRequest))
    } catch (error) {
      res.status(400).json({ code: 'followup_remove_failed', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/api/attachments/:attachmentId', requireSameOrigin, async (req, res) => {
    try {
      const attachmentId = req.params.attachmentId
      if (typeof attachmentId !== 'string') throw new Error('unknown image attachment')
      const { attachment, data } = await service.readImageAttachment(attachmentId)
      res.setHeader('content-type', attachment.mimeType)
      res.setHeader('content-length', String(data.length))
      res.setHeader('x-content-type-options', 'nosniff')
      res.send(data)
    } catch (error) {
      res.status(404).json({ code: 'attachment_not_found', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ code: 'not_found', error: 'API route not found' })
  })

  app.get('/', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use((_req, res) => {
    res.status(404).json({ code: 'not_found', error: 'route not found' })
  })

  const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    void next
    const message = error instanceof Error ? error.message : String(error)
    const status = (error as { type?: string }).type === 'entity.too.large' ? 413 : 500
    res.status(status).json({ code: status === 413 ? 'body_too_large' : 'internal_error', error: message })
  }
  app.use(errorHandler)

  return app
}
