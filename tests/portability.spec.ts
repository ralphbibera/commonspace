import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'
import { addTestHarness, discoverTestHarnesses } from './test-harnesses.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('workspace portability', () => {
  it('exports non-secret data and imports it into a clean workspace with explicit Project remapping', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-export-source-'))
    roots.push(root)
    const projectRoot = join(root, 'private-source-project')
    await mkdir(projectRoot)
    const sharedRoot = await realpath('/tmp')
    const source = new CommonspaceHostService({}, { root: join(root, 'state') }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'Portable reply.', sessionId: '123e4567-e89b-42d3-a456-426614174777' }),
    })
    await source.initialize()
    await addTestHarness(source, 'codex', 'Review Bot')
    const project = (await source.mutate({ action: 'create-project', name: 'Portable App', paths: [projectRoot, sharedRoot] })).projects[0]!
    await source.send({
      conversation: { kind: 'dm', id: 'codex' },
      projectIds: [project.id],
      text: 'Keep portable history.',
      files: [{ name: 'opaque.bin', mimeType: 'application/octet-stream', data: sharedRoot }],
    })
    await source.whenIdle()
    const exportWorkspace = (source as unknown as { exportWorkspace(): Promise<Record<string, unknown>> }).exportWorkspace

    const archive = await exportWorkspace.call(source)
    const serialized = JSON.stringify(archive)
    expect(archive).toMatchObject({
      format: 'commonspace-workspace',
      version: 1,
      workspace: {
        projects: [{ id: project.id, name: 'Portable App', rootCount: 2 }],
      },
      attachments: [expect.objectContaining({ name: 'opaque.bin', data: sharedRoot })],
    })
    expect(serialized).not.toContain(await realpath(projectRoot))
    expect(serialized).not.toContain('123e4567-e89b-42d3-a456-426614174777')
    expect(serialized).not.toContain('agentSessions')
    expect(serialized).not.toContain('dmSessions')
    await source.close()

    const targetRoot = await mkdtemp(join(tmpdir(), 'commonspace-export-target-'))
    roots.push(targetRoot)
    const mappedProject = join(targetRoot, 'mapped-project')
    await mkdir(mappedProject)
    const target = new CommonspaceHostService({}, { root: join(targetRoot, 'state') }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'No run expected.' }),
    })
    await target.initialize()
    const importWorkspace = (target as unknown as {
      importWorkspace(archive: unknown, projectMappings: Record<string, string[]>): Promise<unknown>
    }).importWorkspace
    const mappings = { [project.id]: [mappedProject, targetRoot] }
    const malformed = structuredClone(archive) as unknown as { workspace: { channels: unknown[] } }
    malformed.workspace.channels.push({})
    await expect(importWorkspace.call(target, malformed, mappings))
      .rejects.toThrow('workspace archive failed structural validation')

    await importWorkspace.call(target, archive, mappings)

    expect(target.snapshot().projects[0]).toMatchObject({ id: project.id, paths: [await realpath(mappedProject), await realpath(targetRoot)] })
    expect(target.snapshot().messages['dm:codex']?.map(message => message.text)).toEqual(['Keep portable history.', 'Portable reply.'])
    expect(target.snapshot().agentSessions).toEqual({})
    expect(target.snapshot().dmSessions).toEqual({})
    const fileId = target.snapshot().messages['dm:codex']?.[0]?.files?.[0]?.id
    await expect(target.readFileAttachment(fileId!)).resolves.toMatchObject({ data: Buffer.from(sharedRoot, 'base64') })
    await expect(importWorkspace.call(target, archive, mappings))
      .rejects.toThrow('workspace import requires an empty workspace')
    await target.close()
  })
})
