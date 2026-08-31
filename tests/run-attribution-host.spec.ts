// @vitest-environment node
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'
import { addTestHarness, discoverTestHarnesses } from './test-harnesses.ts'

const execFileAsync = promisify(execFile)
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd })
}

describe('host run attribution', () => {
  it('binds repository changes made during a run to the resulting agent reply', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-host-run-attribution-'))
    roots.push(root)
    const workspace = join(root, 'workspace')
    await mkdir(workspace)
    await writeFile(join(workspace, 'README.md'), 'baseline\n')
    await git(workspace, ['init', '-b', 'main'])
    await git(workspace, ['config', 'user.email', 'commonspace@example.test'])
    await git(workspace, ['config', 'user.name', 'Commonspace Test'])
    await git(workspace, ['add', 'README.md'])
    await git(workspace, ['commit', '-m', 'baseline'])
    await writeFile(join(workspace, 'README.md'), 'pre-existing\n')

    const service = new CommonspaceHostService({} as never, { root: join(root, 'state') }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => {
        await writeFile(join(workspace, 'result.txt'), 'created by agent\n')
        return 'Implemented and verified.'
      },
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Writer')
    const project = (await service.mutate({ action: 'create-project', name: 'App', paths: [workspace] })).projects[0]!

    await service.send({ conversation: { kind: 'dm', id: 'codex' }, projectId: project.id, text: 'Implement it.' })
    await service.whenIdle()

    const reply = service.snapshot().messages['dm:codex']?.find(message => message.authorType === 'agent')
    expect(reply?.runAttribution).toMatchObject({
      roots: [{
        available: true,
        rootIndex: 0,
        preExisting: [expect.objectContaining({ path: 'README.md' })],
        observed: [expect.objectContaining({ path: 'result.txt', preExisting: false, status: 'added' })],
      }],
    })
    expect(reply?.runAttribution?.roots[0]).not.toHaveProperty('root')

    await service.close()
    const reloaded = new CommonspaceHostService({} as never, { root: join(root, 'state') }, { discoverAgents: discoverTestHarnesses })
    await reloaded.initialize()
    const persistedReply = reloaded.snapshot().messages['dm:codex']?.find(message => message.authorType === 'agent')
    expect(persistedReply?.runAttribution).toEqual(reply?.runAttribution)
    await reloaded.close()
  })
})
