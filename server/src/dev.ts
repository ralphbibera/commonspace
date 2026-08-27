import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startDevelopmentSupervisor } from './dev-supervisor.js'

async function runDevelopmentServer(): Promise<void> {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url))
  const serverRoot = resolve(sourceDirectory, '..')
  const repositoryRoot = resolve(serverRoot, '..')
  const supervisor = startDevelopmentSupervisor({
    command: process.execPath,
    args: ['--import', 'tsx', resolve(serverRoot, 'src/index.ts')],
    cwd: serverRoot,
    env: process.env,
    watchPaths: [
      resolve(serverRoot, 'src'),
      resolve(repositoryRoot, 'packages/shared/src'),
    ],
  })

  let stopOperation: Promise<void> | undefined
  const stop = () => {
    stopOperation ??= supervisor.close().then(() => {
      process.exitCode = 0
    }).catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

const entryPath = process.argv[1]?.replaceAll('\\', '/')
if (entryPath?.endsWith('/server/src/dev.ts') === true || entryPath?.endsWith('/server/dist/dev.js') === true) {
  void runDevelopmentServer().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
