import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_COMMONSPACE_SOURCE,
  installOrUpdate,
  rollbackRelease,
  serviceLayout,
  serviceStatus,
} from '../scripts/commonspace-service.mjs'

const roots = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'commonspace-service-manager-'))
  roots.push(home)
  const appRoot = join(home, 'Application Support', 'Commonspace & Local')
  const calls = []
  const logs = []
  let clone = 0
  const dependencies = {
    platform: 'darwin',
    home,
    uid: 501,
    nodePath: '/opt/homebrew/bin/node',
    pathEnvironment: '/opt/homebrew/bin:/usr/bin:/bin',
    now: () => '2026-08-31T12:00:00.000Z',
    randomId: () => `release-${String(clone + 1)}`,
    health: async () => true,
    log: message => { logs.push(message) },
    run: async (command, args, options = {}) => {
      calls.push({ command, args, options })
      if (command === 'git' && args[0] === 'clone') {
        clone += 1
        const target = args.at(-1)
        await mkdir(join(target, 'server', 'dist'), { recursive: true })
        await mkdir(join(target, 'ui', 'dist'), { recursive: true })
        await mkdir(join(target, 'scripts'), { recursive: true })
        await writeFile(join(target, 'server', 'dist', 'index.js'), `// server ${String(clone)}`)
        await writeFile(join(target, 'ui', 'dist', 'index.html'), `release ${String(clone)}`)
        await writeFile(join(target, 'scripts', 'commonspace-service.mjs'), '#!/usr/bin/env node\n')
        await writeFile(join(target, 'release-marker'), String(clone))
      }
      if (command === 'git' && args[0] === 'rev-parse') {
        return { exitCode: 0, stdout: `commit-${String(clone)}\n`, stderr: '' }
      }
      return { exitCode: 0, stdout: '', stderr: '' }
    },
  }
  return { home, appRoot, calls, logs, dependencies }
}

describe('installed Commonspace service manager', () => {
  it('installs and updates an atomic managed release with a launchd service and rollback', async () => {
    const { appRoot, calls, dependencies, home } = await fixture()
    const layout = serviceLayout({ appRoot, home, uid: dependencies.uid })

    await installOrUpdate({ mode: 'install', appRoot }, dependencies)

    expect(calls[0]).toMatchObject({
      command: 'git',
      args: expect.arrayContaining(['clone', DEFAULT_COMMONSPACE_SOURCE]),
    })
    expect(await readFile(join(layout.current, 'release-marker'), 'utf8')).toBe('1')
    expect(await readlink(layout.binPath)).toBe(join(layout.current, 'scripts', 'commonspace-service.mjs'))
    expect((await lstat(layout.binPath)).isSymbolicLink()).toBe(true)
    const plist = await readFile(layout.launchAgentPath, 'utf8')
    expect(plist).toContain('dev.commonspace.service')
    expect(plist).toContain('/opt/homebrew/bin/node')
    expect(plist).toContain('Commonspace &amp; Local/current/ui/dist')
    expect(plist).not.toContain('Commonspace & Local/current/ui/dist')
    expect(calls).toContainEqual(expect.objectContaining({ command: '/usr/bin/plutil', args: ['-lint', expect.stringContaining('.plist.')] }))
    expect(calls).toContainEqual(expect.objectContaining({ command: '/bin/launchctl', args: ['bootstrap', 'gui/501', layout.launchAgentPath] }))

    await installOrUpdate({ mode: 'update', appRoot }, dependencies)

    expect(await readFile(join(layout.current, 'release-marker'), 'utf8')).toBe('2')
    expect(await readFile(join(layout.previous, 'release-marker'), 'utf8')).toBe('1')
    await rollbackRelease({ appRoot }, dependencies)
    expect(await readFile(join(layout.current, 'release-marker'), 'utf8')).toBe('1')
    expect(await readFile(join(layout.previous, 'release-marker'), 'utf8')).toBe('2')

    await expect(serviceStatus({ appRoot }, dependencies)).resolves.toMatchObject({
      installed: true,
      loaded: true,
      healthy: true,
      release: 'commit-1',
      url: 'http://127.0.0.1:3100',
    })
  })

  it('rejects installation outside the supported macOS owner session', async () => {
    const { appRoot, dependencies } = await fixture()
    await expect(installOrUpdate({ mode: 'install', appRoot }, { ...dependencies, platform: 'linux' }))
      .rejects.toThrow('macOS')
  })

  it('refuses broad roots and preserves an unrelated command at the install target', async () => {
    const { appRoot, dependencies, home } = await fixture()
    expect(() => serviceLayout({ appRoot: home, home, uid: dependencies.uid }))
      .toThrow('dedicated Commonspace directory')

    const layout = serviceLayout({ appRoot, home, uid: dependencies.uid })
    await mkdir(dirname(layout.binPath), { recursive: true })
    await writeFile(layout.binPath, 'unrelated command')
    await expect(installOrUpdate({ mode: 'install', appRoot }, dependencies))
      .rejects.toThrow('refusing to overwrite an unrelated Commonspace command')
    await expect(readFile(layout.binPath, 'utf8')).resolves.toBe('unrelated command')
    await expect(lstat(layout.current)).rejects.toThrow()
  })
})
