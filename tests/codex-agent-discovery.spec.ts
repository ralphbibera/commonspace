import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverCodexAgents } from '../server/src/codex-agents.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Codex agent discovery', () => {
  it('discovers built-in and custom native agent profiles', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-codex-agent-discovery-'))
    roots.push(root)
    const project = join(root, 'project')
    const codexHome = join(root, 'codex-home')
    const profilePath = join(project, '.codex', 'agents', 'reviewer.toml')
    await mkdir(join(project, '.codex', 'agents'), { recursive: true })
    await mkdir(join(codexHome, 'agents'), { recursive: true })
    await writeFile(profilePath, [
      'name = "reviewer"',
      'description = "Reviews changes."',
      'model = "gpt-5.4"',
      'model_reasoning_effort = "medium"',
      'sandbox_mode = "read-only"',
      'developer_instructions = """',
      'Review code. Return findings with evidence.',
      '"""',
    ].join('\n'))

    const candidates = await discoverCodexAgents({ cwd: project, codexHome })

    expect(candidates.map(candidate => candidate.profile.id)).toEqual(expect.arrayContaining([
      'codex-default',
      'codex-worker',
      'codex-explorer',
      'codex-reviewer',
    ]))
    expect(candidates.find(candidate => candidate.profile.id === 'codex-reviewer')).toMatchObject({
      profile: {
        id: 'codex-reviewer',
        displayName: 'reviewer',
        adapter: 'codex',
        model: 'gpt-5.4',
        nativeProfile: 'reviewer',
      },
      profilePath,
    })
  })
})
