import { join } from 'node:path'
import type { IncomingMessage } from 'node:http'
import express, { type ErrorRequestHandler, type Express, type NextFunction, type Request, type Response } from 'express'
import type { CommonspaceMutation, SendMessageRequest } from '@commonspace/shared'
import type { CommonspaceHostService } from './service.js'

const MAX_BODY_BYTES = 128 * 1024

export interface CreateCommonspaceAppOptions {
  service: CommonspaceHostService
  uiDistPath?: string
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

export function createCommonspaceApp({ service, uiDistPath }: CreateCommonspaceAppOptions): Express {
  const app = express()
  app.disable('x-powered-by')

  app.use('/api', (req, res, next) => {
    if (!requestIsLoopback(req)) {
      res.status(403).json({ code: 'loopback_required', error: 'Commonspace is local-only' })
      return
    }
    res.setHeader('cache-control', 'no-store')
    next()
  })
  app.use('/api', express.json({ limit: MAX_BODY_BYTES }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.get('/api/bootstrap', requireSameOrigin, async (_req, res) => {
    res.json(await service.bootstrap())
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
    writeRevision(service.snapshot().revision)
    const unsubscribe = service.subscribeToRevisions(writeRevision)
    req.on('close', unsubscribe)
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

  app.use('/api', (_req, res) => {
    res.status(404).json({ code: 'not_found', error: 'API route not found' })
  })

  if (uiDistPath !== undefined) {
    app.use(express.static(uiDistPath, {
      fallthrough: true,
      index: false,
      immutable: true,
      maxAge: '1y',
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) res.setHeader('cache-control', 'no-cache')
      },
    }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.accepts('html') === false) {
        next()
        return
      }
      res.setHeader('cache-control', 'no-cache')
      res.sendFile(join(uiDistPath, 'index.html'), (error) => {
        if (error !== undefined) next(error)
      })
    })
  }

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
