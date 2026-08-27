import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import type { CommonspaceAgentProfile } from '@commonspace/shared'
import { managedAgentId } from './state.js'

const MAX_PROFILE_BYTES = 256 * 1024

export interface CodexAgentProfileConfig {
  name: string
  description: string
  developerInstructions: string
  model: string | null
  modelReasoningEffort?: string
  sandboxMode?: string
}

export interface CodexAgentCandidate {
  profile: CommonspaceAgentProfile
  config: CodexAgentProfileConfig
  profilePath?: string
}

const BUILTIN_PROFILES: readonly CodexAgentProfileConfig[] = [
  {
    name: 'default',
    description: 'General-purpose fallback agent.',
    developerInstructions: 'Act as Codex default: solve the requested task directly and report the result.',
    model: null,
  },
  {
    name: 'worker',
    description: 'Execution-focused agent for implementation and fixes.',
    developerInstructions: 'Act as Codex worker: execute the requested implementation or fix, then report evidence.',
    model: null,
  },
  {
    name: 'explorer',
    description: 'Read-heavy codebase exploration agent.',
    developerInstructions: 'Act as Codex explorer: inspect the codebase, trace behavior, and report evidence without editing.',
    model: null,
  },
]

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rawValue(source: string, key: string): string | undefined {
  const escapedKey = escapeRegex(key)
  const multiline = new RegExp(`(?:^|\\n)\\s*${escapedKey}\\s*=\\s*("""[\\s\\S]*?"""|'''[\\s\\S]*?''')\\s*(?:#.*)?(?=\\n|$)`, 'm').exec(source)
  if (multiline?.[1] !== undefined) return multiline[1]
  const singleLine = new RegExp(`(?:^|\\n)\\s*${escapedKey}\\s*=\\s*("(?:\\\\.|[^"\\\\])*"|'[^']*'|[^\\n#]+)\\s*(?:#.*)?(?=\\n|$)`, 'm').exec(source)
  return singleLine?.[1]
}

function unescapeBasicString(value: string): string {
  const escapes: Record<string, string> = {
    '"': '"',
    '\\': '\\',
    n: '\n',
    r: '\r',
    t: '\t',
    b: '\b',
    f: '\f',
  }
  return value.replace(/\\(["\\nrtbf])/g, (match, character: string) => escapes[character] ?? match)
}

function stringValue(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const value = raw.trim()
  if (value.startsWith('"""') && value.endsWith('"""')) {
    const body = value.slice(3, -3)
    return unescapeBasicString(body.startsWith('\n') ? body.slice(1) : body)
  }
  if (value.startsWith("'''") && value.endsWith("'''")) {
    const body = value.slice(3, -3)
    return body.startsWith('\n') ? body.slice(1) : body
  }
  if (value.startsWith('"') && value.endsWith('"')) return unescapeBasicString(value.slice(1, -1))
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1)
  return undefined
}

export function parseCodexAgentProfile(source: string): CodexAgentProfileConfig | undefined {
  const name = stringValue(rawValue(source, 'name'))?.trim()
  const description = stringValue(rawValue(source, 'description'))?.trim()
  const developerInstructions = stringValue(rawValue(source, 'developer_instructions'))?.trim()
  if (name === undefined || name === '' || description === undefined || description === '' || developerInstructions === undefined || developerInstructions === '') return undefined
  const model = stringValue(rawValue(source, 'model'))?.trim()
  const modelReasoningEffort = stringValue(rawValue(source, 'model_reasoning_effort'))?.trim()
  const sandboxMode = stringValue(rawValue(source, 'sandbox_mode'))?.trim()
  return {
    name,
    description,
    developerInstructions,
    model: model === undefined || model === '' ? null : model.slice(0, 200),
    ...(modelReasoningEffort === undefined || modelReasoningEffort === '' ? {} : { modelReasoningEffort: modelReasoningEffort.slice(0, 80) }),
    ...(sandboxMode === undefined || sandboxMode === '' ? {} : { sandboxMode: sandboxMode.slice(0, 80) }),
  }
}

export async function readCodexAgentProfile(profilePath: string): Promise<CodexAgentProfileConfig | undefined> {
  try {
    if ((await stat(profilePath)).size > MAX_PROFILE_BYTES) return undefined
    return parseCodexAgentProfile(await readFile(profilePath, 'utf8'))
  } catch {
    return undefined
  }
}

function profileFromConfig(config: CodexAgentProfileConfig): CommonspaceAgentProfile {
  return {
    id: managedAgentId('codex', config.name),
    displayName: config.name,
    adapter: 'codex',
    nativeProfile: config.name,
    model: config.model,
    status: 'unknown',
    description: config.description,
  }
}

async function profilePaths(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && extname(entry.name).toLocaleLowerCase() === '.toml')
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(entry => join(directory, entry.name))
  } catch {
    return []
  }
}

function sourceDirectories(options: { cwd: string; projectPaths?: readonly string[]; codexHome?: string }): string[] {
  const projectRoots = [options.cwd, ...(options.projectPaths ?? [])]
    .filter(path => path.trim() !== '')
    .map(path => resolve(path))
  const codexHome = options.codexHome ?? process.env.CODEX_HOME ?? join(homedir(), '.codex')
  return [...new Set([
    ...projectRoots.map(path => join(path, '.codex', 'agents')),
    join(resolve(codexHome), 'agents'),
  ])]
}

export async function discoverCodexAgents(options: { cwd: string; projectPaths?: readonly string[]; codexHome?: string }): Promise<CodexAgentCandidate[]> {
  const candidates = new Map<string, CodexAgentCandidate>()
  for (const directory of sourceDirectories(options)) {
    for (const profilePath of await profilePaths(directory)) {
      const config = await readCodexAgentProfile(profilePath)
      if (config === undefined) continue
      const profile = profileFromConfig(config)
      if (!candidates.has(profile.id)) candidates.set(profile.id, { profile, config, profilePath })
    }
  }
  for (const config of BUILTIN_PROFILES) {
    const profile = profileFromConfig(config)
    if (!candidates.has(profile.id)) candidates.set(profile.id, { profile, config })
  }
  return [...candidates.values()]
}

export async function findCodexAgentProfile(options: { nativeProfile: string; cwd: string; projectPaths?: readonly string[]; codexHome?: string }): Promise<CodexAgentCandidate | undefined> {
  const candidates = await discoverCodexAgents(options)
  return candidates.find(candidate => candidate.config.name === options.nativeProfile)
}

export function codexProfileRuntimeConfig(config: CodexAgentProfileConfig): Record<string, string> {
  return {
    developer_instructions: config.developerInstructions,
    ...(config.model === null ? {} : { model: config.model }),
    ...(config.modelReasoningEffort === undefined ? {} : { model_reasoning_effort: config.modelReasoningEffort }),
    ...(config.sandboxMode === undefined ? {} : { sandbox_mode: config.sandboxMode }),
  }
}
