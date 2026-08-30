// @vitest-environment node
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { captureRunSnapshot, completeRunAttribution } from '../server/src/run-attribution.ts'

const execFileAsync = promisify(execFile)
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd })
}

describe('run attribution', () => {
  it('separates pre-existing worktree changes from changes observed during the run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-run-attribution-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    await writeFile(join(workspace, 'README.md'), 'baseline\n')
    await git(workspace, ['init', '-b', 'main'])
    await git(workspace, ['config', 'user.email', 'commonspace@example.test'])
    await git(workspace, ['config', 'user.name', 'Commonspace Test'])
    await git(workspace, ['add', 'README.md'])
    await git(workspace, ['commit', '-m', 'baseline'])
    await writeFile(join(workspace, 'README.md'), 'before run\n')

    const before = await captureRunSnapshot(workspace)
    await writeFile(join(workspace, 'README.md'), 'after run\n')
    await writeFile(join(workspace, 'result.txt'), 'created by run\n')
    const attribution = await completeRunAttribution(workspace, before, 0)

    expect(attribution).toMatchObject({
      available: true,
      rootIndex: 0,
      branch: 'main',
      preExisting: [expect.objectContaining({ path: 'README.md', status: 'modified' })],
      observed: expect.arrayContaining([
        expect.objectContaining({ path: 'README.md', status: 'modified', preExisting: true }),
        expect.objectContaining({ path: 'result.txt', status: 'added', preExisting: false }),
      ]),
    })
    const readme = attribution.available ? attribution.observed.find(change => change.path === 'README.md') : undefined
    expect(readme?.patch).toContain('-before run')
    expect(readme?.patch).toContain('+after run')
    const result = attribution.available ? attribution.observed.find(change => change.path === 'result.txt') : undefined
    expect(result?.patch).toContain('+created by run')
  })

  it('attributes changes committed during the run even when the worktree finishes clean', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-committed-run-attribution-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    await writeFile(join(workspace, 'README.md'), 'baseline\n')
    await git(workspace, ['init', '-b', 'main'])
    await git(workspace, ['config', 'user.email', 'commonspace@example.test'])
    await git(workspace, ['config', 'user.name', 'Commonspace Test'])
    await git(workspace, ['add', 'README.md'])
    await git(workspace, ['commit', '-m', 'baseline'])
    const before = await captureRunSnapshot(workspace)

    await writeFile(join(workspace, 'README.md'), 'committed by run\n')
    await git(workspace, ['add', 'README.md'])
    await git(workspace, ['commit', '-m', 'run change'])

    const attribution = await completeRunAttribution(workspace, before, 0)
    expect(attribution).toMatchObject({
      available: true,
      observed: [expect.objectContaining({ path: 'README.md', status: 'modified', preExisting: false })],
    })
    if (!attribution.available) throw new Error('expected Git attribution')
    expect(attribution.headAfter).not.toBe(attribution.headBefore)
    expect(attribution.observed[0]?.patch).toContain('+committed by run')
  })
})
