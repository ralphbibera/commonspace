// @vitest-environment node
import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startCommonspaceServer, type RunningCommonspaceServer } from '../server/src/index.ts'

const execFileAsync = promisify(execFile)
const roots: string[] = []
const servers: RunningCommonspaceServer[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(servers.splice(0).map(server => server.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd })
}

async function fixture(): Promise<{
  running: RunningCommonspaceServer
  projectId: string
  workspace: string
  outside: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'commonspace-project-files-'))
  roots.push(root)
  const workspace = join(root, 'workspace')
  const outside = join(root, 'outside.txt')
  await mkdir(join(workspace, 'src'), { recursive: true })
  await writeFile(join(workspace, 'README.md'), 'before\nsame\n')
  await writeFile(join(workspace, 'src', 'index.ts'), 'export const answer = 42\n')
  await writeFile(join(workspace, 'cover.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  await writeFile(join(workspace, 'demo.mp4'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]))
  await writeFile(join(workspace, 'blob.bin'), Buffer.from([0, 1, 2]))
  await writeFile(join(workspace, 'NOTICE'), 'plain text without an extension\n')
  await writeFile(join(workspace, '.env.local'), 'API_KEY=do-not-render\n')
  await writeFile(join(workspace, 'id_rsa'), '-----BEGIN OPENSSH PRIVATE KEY-----\ndo-not-render\n')
  await writeFile(join(workspace, 'credentials.json'), '{"token":"do-not-render"}\n')
  await writeFile(outside, 'host private\n')
  await symlink(outside, join(workspace, 'outside-link.txt'))

  await git(workspace, ['init', '-b', 'main'])
  await git(workspace, ['config', 'user.email', 'commonspace@example.test'])
  await git(workspace, ['config', 'user.name', 'Commonspace Test'])
  await git(workspace, ['add', 'README.md', 'src/index.ts', 'cover.png', 'demo.mp4', 'blob.bin'])
  await git(workspace, ['commit', '-m', 'test: baseline'])
  await writeFile(join(workspace, 'README.md'), 'after\nsame\n')
  await writeFile(join(workspace, 'notes.txt'), 'new note\n')

  const running = await startCommonspaceServer({
    root: join(root, 'state'),
    port: 0,
    logger: { warn: () => undefined, info: () => undefined },
  })
  servers.push(running)
  await running.service.mutate({ action: 'create-project', name: 'Viewer', paths: [workspace] })
  const project = running.service.snapshot().projects[0]
  if (project === undefined) throw new Error('project fixture missing')
  return { running, projectId: project.id, workspace, outside }
}

function projectUrl(
  running: RunningCommonspaceServer,
  projectId: string,
  endpoint: string,
  query: Record<string, string> = {},
): string {
  const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/${endpoint}`, running.url)
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value)
  return url.toString()
}

describe('project file API', () => {
  it('opens a validated project file at a requested line in the configured editor', async () => {
    const { running, projectId, workspace } = await fixture()
    const editorLog = join(workspace, 'editor.log')
    const editor = join(workspace, 'fake-editor.sh')
    await writeFile(editor, `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(editorLog)}\n`)
    await chmod(editor, 0o755)
    vi.stubEnv('COMMONSPACE_EDITOR_PATH', editor)

    const response = await fetch(projectUrl(running, projectId, 'open'), {
      method: 'POST',
      headers: { origin: running.url, 'content-type': 'application/json' },
      body: JSON.stringify({ rootIndex: 0, path: 'src/index.ts', line: 12 }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ opened: true })
    expect(await readFile(editorLog, 'utf8')).toBe(`--goto\n${await realpath(join(workspace, 'src', 'index.ts'))}:12\n`)
  })

  it('lists project files and serves text, images, and ranged video without exposing symlinks', async () => {
    const { running, projectId } = await fixture()
    const headers = { origin: running.url }

    const listingResponse = await fetch(projectUrl(running, projectId, 'files'), { headers })
    expect(listingResponse.status).toBe(200)
    await expect(listingResponse.json()).resolves.toMatchObject({
      projectId,
      rootIndex: 0,
      path: '',
      truncated: false,
      entries: expect.arrayContaining([
        expect.objectContaining({ name: 'src', path: 'src', kind: 'directory' }),
        expect.objectContaining({ name: 'README.md', path: 'README.md', kind: 'file', preview: 'text', contentType: 'text/markdown; charset=utf-8' }),
        expect.objectContaining({ name: 'cover.png', path: 'cover.png', kind: 'file', preview: 'image', contentType: 'image/png' }),
        expect.objectContaining({ name: 'demo.mp4', path: 'demo.mp4', kind: 'file', preview: 'video', contentType: 'video/mp4' }),
        expect.objectContaining({ name: 'blob.bin', path: 'blob.bin', kind: 'file', preview: 'binary' }),
        expect.objectContaining({ name: 'NOTICE', path: 'NOTICE', kind: 'file', preview: 'text', contentType: 'text/plain; charset=utf-8' }),
      ]),
    })
    const listing = await (await fetch(projectUrl(running, projectId, 'files'), { headers })).json() as { entries: Array<{ name: string }> }
    expect(listing.entries.some(entry => entry.name === '.git')).toBe(false)
    expect(listing.entries.some(entry => entry.name === 'outside-link.txt')).toBe(false)

    const textResponse = await fetch(projectUrl(running, projectId, 'file', { path: 'README.md' }), { headers })
    expect(textResponse.status).toBe(200)
    expect(textResponse.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    await expect(textResponse.text()).resolves.toBe('after\nsame\n')

    const imageResponse = await fetch(projectUrl(running, projectId, 'file', { path: 'cover.png' }), { headers })
    expect(imageResponse.status).toBe(200)
    expect(imageResponse.headers.get('content-type')).toBe('image/png')

    const videoResponse = await fetch(projectUrl(running, projectId, 'file', { path: 'demo.mp4' }), {
      headers: { ...headers, range: 'bytes=2-5' },
    })
    expect(videoResponse.status).toBe(206)
    expect(videoResponse.headers.get('content-range')).toBe('bytes 2-5/8')
    expect([...new Uint8Array(await videoResponse.arrayBuffer())]).toEqual([2, 3, 4, 5])
  })

  it('rejects traversal and symlink file reads', async () => {
    const { running, projectId } = await fixture()
    const headers = { origin: running.url }

    const traversal = await fetch(projectUrl(running, projectId, 'file', { path: '../outside.txt' }), { headers })
    expect(traversal.status).toBe(400)
    await expect(traversal.json()).resolves.toMatchObject({ code: 'invalid_project_path' })

    const gitMetadata = await fetch(projectUrl(running, projectId, 'file', { path: '.git/config' }), { headers })
    expect(gitMetadata.status).toBe(400)
    await expect(gitMetadata.json()).resolves.toMatchObject({ code: 'invalid_project_path' })

    const symlink = await fetch(projectUrl(running, projectId, 'file', { path: 'outside-link.txt' }), { headers })
    expect(symlink.status).toBe(403)
    await expect(symlink.json()).resolves.toMatchObject({ code: 'project_path_outside_root' })
  })

  it('reports working-tree changes and returns a bounded unified text diff', async () => {
    const { running, projectId } = await fixture()
    const headers = { origin: running.url }

    const changesResponse = await fetch(projectUrl(running, projectId, 'changes'), { headers })
    expect(changesResponse.status).toBe(200)
    await expect(changesResponse.json()).resolves.toMatchObject({
      available: true,
      branch: 'main',
      clean: false,
      files: expect.arrayContaining([
        expect.objectContaining({ path: 'README.md', status: 'modified', additions: 1, deletions: 1, preview: 'text' }),
        expect.objectContaining({ path: 'notes.txt', status: 'untracked', additions: 1, deletions: 0, preview: 'text' }),
      ]),
    })

    const diffResponse = await fetch(projectUrl(running, projectId, 'diff', { path: 'README.md' }), { headers })
    expect(diffResponse.status).toBe(200)
    await expect(diffResponse.json()).resolves.toMatchObject({
      path: 'README.md',
      binary: false,
      truncated: false,
      patch: expect.stringContaining('-before'),
    })
    const diff = await (await fetch(projectUrl(running, projectId, 'diff', { path: 'README.md' }), { headers })).json() as { patch: string }
    expect(diff.patch).toContain('+after')
  })

  it('lists sensitive files without allowing their contents to be previewed', async () => {
    const { running, projectId } = await fixture()
    const headers = { origin: running.url }
    const listing = await (await fetch(projectUrl(running, projectId, 'files'), { headers })).json() as {
      entries: Array<{ name: string; preview?: string }>
    }

    expect(listing.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '.env.local', preview: 'blocked' }),
      expect.objectContaining({ name: 'id_rsa', preview: 'blocked' }),
      expect.objectContaining({ name: 'credentials.json', preview: 'blocked' }),
    ]))
    for (const path of ['.env.local', 'id_rsa', 'credentials.json']) {
      const response = await fetch(projectUrl(running, projectId, 'file', { path }), { headers })
      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({ code: 'project_file_sensitive' })
    }
  })
})
