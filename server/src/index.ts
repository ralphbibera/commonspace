import { stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import { createCommonspaceApp } from './app.js'
import { CommonspaceMcpGateway } from './commonspace-mcp.js'
import { developmentServerMessages } from './dev-supervisor.js'
import {
  CommonspaceHostService,
  type CommonspaceHostConfig,
  type CommonspaceHostDependencies,
} from './service.js'

interface CommonspaceLogger {
  info(message: string): void
  warn(message: unknown): void
}

export interface StartCommonspaceServerOptions extends CommonspaceHostConfig {
  port?: number
  uiDistPath?: string
  directoryPicker?: () => Promise<string | null>
  dependencies?: Partial<CommonspaceHostDependencies>
  logger?: CommonspaceLogger
}

export interface RunningCommonspaceServer {
  url: string
  service: CommonspaceHostService
  close(): Promise<void>
  drainAndClose(): Promise<void>
}

function defaultUiDistPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/dist')
}

async function existingDirectory(path: string): Promise<string | undefined> {
  try {
    return (await stat(path)).isDirectory() ? path : undefined
  } catch {
    return undefined
  }
}

function defaultLogger(): CommonspaceLogger {
  const logger = pino({ level: process.env.COMMONSPACE_LOG_LEVEL ?? 'info' })
  return {
    info: message => logger.info(message),
    warn: message => logger.warn({ error: message instanceof Error ? message.message : message }, 'Commonspace warning'),
  }
}

async function closeHttpServer(server: Server): Promise<void> {
  if (!server.listening) return
  const closing = new Promise<void>((resolveClose, rejectClose) => {
    server.close(error => { if (error === undefined) resolveClose(); else rejectClose(error) })
  })
  server.closeAllConnections()
  await closing
}

export async function startCommonspaceServer(options: StartCommonspaceServerOptions = {}): Promise<RunningCommonspaceServer> {
  const logger = options.logger ?? defaultLogger()
  const service = new CommonspaceHostService({ logger }, options, options.dependencies)
  await service.initialize()
  const mcpGateway = new CommonspaceMcpGateway(service)
  let server: Server | undefined
  let url: string
  try {
    const requestedUiDistPath = options.uiDistPath ?? defaultUiDistPath()
    const uiDistPath = await existingDirectory(requestedUiDistPath)
    if (options.uiDistPath !== undefined && uiDistPath === undefined) {
      throw new Error(`Commonspace UI build not found: ${options.uiDistPath}`)
    }
    const app = createCommonspaceApp({
      service,
      mcpGateway,
      ...(uiDistPath === undefined ? {} : { uiDistPath }),
      ...(options.directoryPicker === undefined ? {} : { directoryPicker: options.directoryPicker }),
    })
    server = createServer(app)
    const port = options.port ?? 3100

    await new Promise<void>((resolveListen, rejectListen) => {
      const onError = (error: Error) => {
        server?.off('listening', onListening)
        rejectListen(error)
      }
      const onListening = () => {
        server?.off('error', onError)
        resolveListen()
      }
      server?.once('error', onError)
      server?.once('listening', onListening)
      server?.listen(port, '127.0.0.1')
    })

    const address = server.address() as AddressInfo
    url = `http://127.0.0.1:${String(address.port)}`
    service.attachMcpGateway(mcpGateway, `${url}/api/mcp`)
  } catch (error) {
    if (server !== undefined) await closeHttpServer(server).catch(() => undefined)
    await mcpGateway.close().catch(() => undefined)
    await service.close().catch(() => undefined)
    throw error
  }
  let httpCloseOperation: Promise<void> | undefined
  const closeHttp = async (): Promise<void> => {
    httpCloseOperation ??= closeHttpServer(server)
    await httpCloseOperation
  }
  return {
    url,
    service,
    async close() {
      try {
        await service.close()
      } finally {
        await closeHttp()
      }
    },
    async drainAndClose() {
      try {
        await service.drainAndClose()
      } finally {
        await closeHttp()
      }
    },
  }
}

function configuredPort(value: string | undefined): number {
  if (value === undefined || value === '') return 3100
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('COMMONSPACE_PORT must be an integer from 0 to 65535')
  }
  return port
}

async function runCli(): Promise<void> {
  const running = await startCommonspaceServer({
    port: configuredPort(process.env.COMMONSPACE_PORT),
    hermesYolo: process.env.COMMONSPACE_HERMES_YOLO === '1',
    externalAgentYolo: process.env.COMMONSPACE_AGENT_YOLO === '1',
    ...(process.env.COMMONSPACE_HOME === undefined ? {} : { root: process.env.COMMONSPACE_HOME }),
    ...(process.env.INIT_CWD === undefined ? {} : { defaultCwd: process.env.INIT_CWD }),
    ...(process.env.COMMONSPACE_HERMES_PATH === undefined ? {} : { hermesPath: process.env.COMMONSPACE_HERMES_PATH }),
    ...(process.env.COMMONSPACE_CODEX_PATH === undefined ? {} : { codexPath: process.env.COMMONSPACE_CODEX_PATH }),
    ...(process.env.COMMONSPACE_HERMES_ACP_PATH === undefined ? {} : { hermesAcpCommand: process.env.COMMONSPACE_HERMES_ACP_PATH }),
    ...(process.env.COMMONSPACE_CODEX_ACP_PATH === undefined ? {} : { codexAcpCommand: process.env.COMMONSPACE_CODEX_ACP_PATH }),
  })
  console.info(`Commonspace is running at ${running.url}`)
  let finalized = false
  const finalize = (operation: Promise<void>) => {
    void operation.then(() => {
      if (finalized) return
      finalized = true
      process.exitCode = 0
      if (process.connected) process.disconnect()
    }).catch((error: unknown) => {
      if (finalized) return
      finalized = true
      console.error(error)
      process.exitCode = 1
      if (process.connected) process.disconnect()
    })
  }
  const stop = () => {
    finalize(running.close())
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  process.once('disconnect', stop)
  process.on('message', (message: unknown) => {
    if (typeof message !== 'object' || message === null ||
      (message as { type?: unknown }).type !== developmentServerMessages.restart) return
    finalize(running.drainAndClose())
  })
  process.send?.({ type: developmentServerMessages.ready })
}

const entryPath = process.argv[1]?.replaceAll('\\', '/')
if (entryPath?.endsWith('/server/src/index.ts') === true || entryPath?.endsWith('/server/dist/index.js') === true) {
  void runCli().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
