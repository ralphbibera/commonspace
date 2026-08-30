import { execFile } from 'node:child_process'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import type {
  CommonspaceAgentConfiguration,
  CommonspaceAgentProfile,
  CommonspaceCapabilityItem,
  CommonspaceReasoning,
  UpdateAgentConfigurationRequest,
} from '@commonspace/shared'

const execFileAsync = promisify(execFile)
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
const SERVICE_TOOLSETS = new Set(['discord', 'discord_admin', 'feishu_doc', 'feishu_drive', 'homeassistant', 'spotify', 'yuanbao'])
const REASONING_VALUES = new Set<CommonspaceReasoning>(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])

function parseBoolean(value: string): boolean | null {
  if (value.trim().toLocaleLowerCase() === 'true') return true
  if (value.trim().toLocaleLowerCase() === 'false') return false
  return null
}

async function readHermesInstructions(profileOutput: string): Promise<string | null> {
  const profilePath = /^Path:\s+(.+)$/mu.exec(profileOutput)?.[1]?.trim()
  if (profilePath === undefined || !isAbsolute(profilePath)) return null
  try { return (await readFile(join(profilePath, 'SOUL.md'), 'utf8')).slice(0, 64_000) } catch { return null }
}

function emptyRuntime(adapter: CommonspaceAgentProfile['adapter']) {
  return {
    sessionHealth: { status: adapter === 'hermes' ? 'idle' as const : 'unavailable' as const, activeSessions: 0, knownSessions: 0, lastRunAt: null },
    lastRuns: [],
    cost: { amount: 0, currency: null },
  }
}

export function parseHermesFastMode(value: string): boolean | null {
  const tier = value.trim().toLocaleLowerCase()
  if (tier === '' || ['normal', 'default', 'standard', 'off', 'none'].includes(tier)) return false
  if (['fast', 'priority', 'on'].includes(tier)) return true
  return null
}

function cleanDetail(value: string): string | undefined {
  const cleaned = value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim()
  return cleaned === '' ? undefined : cleaned
}

export function parseHermesToolCapabilities(output: string): CommonspaceCapabilityItem[] {
  const items: CommonspaceCapabilityItem[] = []
  for (const line of output.split(/\r?\n/u)) {
    const match = /^\s*[✓✗]\s+(enabled|disabled)\s+([a-z0-9_-]+)\s*(.*)$/iu.exec(line)
    if (match === null) continue
    const detail = cleanDetail(match[3] ?? '')
    items.push({
      id: match[2]!,
      label: match[2]!,
      state: match[1] === 'enabled' ? 'enabled' : 'blocked',
      ...(detail === undefined ? {} : { detail }),
    })
  }
  return items
}

export function parseHermesMcpCapabilities(output: string): CommonspaceCapabilityItem[] {
  const items: CommonspaceCapabilityItem[] = []
  for (const line of output.split(/\r?\n/u)) {
    const match = /^\s*([a-z0-9_-]+)\s+\S+\s+\S+\s+[✓✗]\s+(enabled|disabled)\s*$/iu.exec(line)
    if (match === null) continue
    items.push({
      id: match[1]!,
      label: match[1]!,
      state: match[2] === 'enabled' ? 'configured' : 'blocked',
      detail: match[2]!,
    })
  }
  return items
}

export function parseHermesSkillCapabilities(output: string): CommonspaceCapabilityItem[] {
  const items: CommonspaceCapabilityItem[] = []
  for (const line of output.split(/\r?\n/u)) {
    const cells = line.split('│').map(cell => cell.trim()).filter(Boolean)
    if (cells.length !== 5 || cells[0] === 'Name' || (cells[4] !== 'enabled' && cells[4] !== 'disabled')) continue
    items.push({
      id: cells[0]!,
      label: cells[0]!,
      state: cells[4] === 'enabled' ? 'enabled' : 'available',
      detail: [cells[1], cells[2]].filter(Boolean).join(' · '),
    })
  }
  return items
}

type HermesRunner = (hermesPath: string, profileId: string, args: string[]) => Promise<string>

async function runHermes(hermesPath: string, profileId: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(hermesPath, ['-p', profileId, ...args], {
    encoding: 'utf8',
    env: { ...process.env, COLUMNS: '240', NO_COLOR: '1', TERM: 'dumb' },
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: 30_000,
  })
  return stdout.trim()
}

function blockedConfiguration(agent: CommonspaceAgentProfile): CommonspaceAgentConfiguration {
  return {
    agentId: agent.id,
    adapter: agent.adapter,
    model: agent.model,
    reasoning: null,
    fastMode: null,
    editable: false,
    editBlockedReason: 'Codex ACP does not expose a supported native capability/configuration API.',
    instructions: null,
    memoryPolicy: { enabled: null, userProfileEnabled: null, writeApproval: null },
    permissions: { approvalMode: null, secretRedaction: null },
    ...emptyRuntime(agent.adapter),
    capabilities: {
      tools: [{ id: 'codex-acp', label: 'Codex ACP tools', state: 'available', detail: 'Provider-managed inventory' }],
      mcp: [{ id: 'commonspace', label: 'Commonspace MCP', state: 'configured', detail: 'Injected per native session' }],
      skills: [{ id: 'codex-native', label: 'Codex native profiles', state: 'available', detail: agent.nativeProfile ?? 'managed profile' }],
      services: [],
    },
    refreshedAt: new Date().toISOString(),
  }
}

export async function inspectAgentConfiguration(
  hermesPath: string,
  agent: CommonspaceAgentProfile,
  runner: HermesRunner = runHermes,
): Promise<CommonspaceAgentConfiguration> {
  if (agent.adapter !== 'hermes') return blockedConfiguration(agent)
  const [model, reasoning, serviceTier, toolsOutput, mcpOutput, skillsOutput, profileOutput, memoryEnabled, userProfileEnabled, writeApproval, approvalMode, secretRedaction] = await Promise.all([
    runner(hermesPath, agent.id, ['config', 'get', 'model.default']),
    runner(hermesPath, agent.id, ['config', 'get', 'agent.reasoning_effort']),
    runner(hermesPath, agent.id, ['config', 'get', 'agent.service_tier']),
    runner(hermesPath, agent.id, ['tools', 'list']),
    runner(hermesPath, agent.id, ['mcp', 'list']),
    runner(hermesPath, agent.id, ['skills', 'list']),
    runner(hermesPath, agent.id, ['profile', 'show', agent.id]),
    runner(hermesPath, agent.id, ['config', 'get', 'memory.memory_enabled']),
    runner(hermesPath, agent.id, ['config', 'get', 'memory.user_profile_enabled']),
    runner(hermesPath, agent.id, ['config', 'get', 'memory.write_approval']),
    runner(hermesPath, agent.id, ['config', 'get', 'approvals.mode']),
    runner(hermesPath, agent.id, ['config', 'get', 'security.redact_secrets']),
  ])
  const toolsets = parseHermesToolCapabilities(toolsOutput)
  return {
    agentId: agent.id,
    adapter: agent.adapter,
    model: model === '' ? null : model,
    reasoning: REASONING_VALUES.has(reasoning as CommonspaceReasoning) ? reasoning as CommonspaceReasoning : null,
    fastMode: parseHermesFastMode(serviceTier),
    editable: true,
    instructions: await readHermesInstructions(profileOutput),
    memoryPolicy: { enabled: parseBoolean(memoryEnabled), userProfileEnabled: parseBoolean(userProfileEnabled), writeApproval: writeApproval.trim() || null },
    permissions: { approvalMode: approvalMode.trim() || null, secretRedaction: parseBoolean(secretRedaction) },
    ...emptyRuntime(agent.adapter),
    capabilities: {
      tools: toolsets.filter(item => !SERVICE_TOOLSETS.has(item.id)),
      mcp: parseHermesMcpCapabilities(mcpOutput),
      skills: parseHermesSkillCapabilities(skillsOutput),
      services: toolsets.filter(item => SERVICE_TOOLSETS.has(item.id)),
    },
    refreshedAt: new Date().toISOString(),
  }
}

export async function updateAgentConfiguration(
  hermesPath: string,
  agent: CommonspaceAgentProfile,
  update: UpdateAgentConfigurationRequest,
  runner: HermesRunner = runHermes,
): Promise<CommonspaceAgentConfiguration> {
  if (agent.adapter !== 'hermes') throw new Error('Codex native configuration is read-only because Codex ACP does not expose a supported configuration API')
  const model = update.model.normalize('NFKC').trim()
  if (model === '' || model.length > 200 || /\s/u.test(model)) throw new Error('model must be a non-empty provider model id')
  if (!REASONING_VALUES.has(update.reasoning)) throw new Error('unsupported reasoning')
  if (typeof update.fastMode !== 'boolean') throw new Error('fastMode must be a boolean')
  const instructions = update.instructions?.normalize('NFKC')
  if (instructions !== undefined && instructions.length > 64_000) throw new Error('instructions are too long')
  if (update.permissions !== undefined && !['smart', 'manual', 'off'].includes(update.permissions.approvalMode)) throw new Error('unsupported approval mode')
  const optionalKeys = [
    ...(update.memoryPolicy === undefined ? [] : ['memory.memory_enabled', 'memory.user_profile_enabled', 'memory.write_approval']),
    ...(update.permissions === undefined ? [] : ['approvals.mode', 'security.redact_secrets']),
  ]
  const keys = ['model.default', 'agent.reasoning_effort', 'agent.service_tier', ...optionalKeys] as const
  const originalValues = await Promise.all(keys.map(key => runner(hermesPath, agent.id, ['config', 'get', key])))
  const profileOutput = instructions === undefined ? '' : await runner(hermesPath, agent.id, ['profile', 'show', agent.id])
  const profilePath = /^Path:\s+(.+)$/mu.exec(profileOutput)?.[1]?.trim()
  if (instructions !== undefined && (profilePath === undefined || !isAbsolute(profilePath))) throw new Error('Hermes profile path is unavailable')
  const soulPath = profilePath === undefined ? undefined : join(profilePath, 'SOUL.md')
  const originalInstructions = soulPath === undefined ? undefined : await readFile(soulPath, 'utf8').catch(() => '')
  const toolStates = update.toolStates ?? {}
  const originalTools = toolStates === undefined ? new Map<string, boolean>() : new Map(parseHermesToolCapabilities(await runner(hermesPath, agent.id, ['tools', 'list'])).map(item => [item.id, item.state === 'enabled']))
  const changedTools: string[] = []
  try {
    await runner(hermesPath, agent.id, ['config', 'set', 'model.default', model])
    await runner(hermesPath, agent.id, ['config', 'set', 'agent.reasoning_effort', update.reasoning])
    await runner(hermesPath, agent.id, ['config', 'set', 'agent.service_tier', update.fastMode ? 'fast' : 'normal'])
    if (update.memoryPolicy !== undefined) {
      await runner(hermesPath, agent.id, ['config', 'set', 'memory.memory_enabled', String(update.memoryPolicy.enabled)])
      await runner(hermesPath, agent.id, ['config', 'set', 'memory.user_profile_enabled', String(update.memoryPolicy.userProfileEnabled)])
      await runner(hermesPath, agent.id, ['config', 'set', 'memory.write_approval', update.memoryPolicy.writeApproval])
    }
    if (update.permissions !== undefined) {
      await runner(hermesPath, agent.id, ['config', 'set', 'approvals.mode', update.permissions.approvalMode])
      await runner(hermesPath, agent.id, ['config', 'set', 'security.redact_secrets', String(update.permissions.secretRedaction)])
    }
    for (const [toolId, enabled] of Object.entries(toolStates)) {
      if (!/^[a-z0-9_-]+$/u.test(toolId) || typeof enabled !== 'boolean' || originalTools.get(toolId) === undefined) throw new Error('invalid Hermes tool update')
      if (originalTools.get(toolId) === enabled) continue
      await runner(hermesPath, agent.id, ['tools', enabled ? 'enable' : 'disable', toolId])
      changedTools.push(toolId)
    }
    if (soulPath !== undefined && instructions !== undefined) {
      const temporary = `${soulPath}.${process.pid}.tmp`
      try { await writeFile(temporary, instructions, { encoding: 'utf8', mode: 0o600 }); await rename(temporary, soulPath) } finally { await rm(temporary, { force: true }) }
    }
    const result = await inspectAgentConfiguration(hermesPath, agent, runner)
    if (result.model !== model || result.reasoning !== update.reasoning || result.fastMode !== update.fastMode) throw new Error('Hermes configuration readback did not match the requested values')
    if (instructions !== undefined && result.instructions !== instructions) throw new Error('Hermes instructions readback did not match the requested value')
    return result
  } catch (error) {
    const rollback = await Promise.allSettled([
      ...keys.map((key, index) => runner(hermesPath, agent.id, ['config', 'set', key, originalValues[index]!])),
      ...changedTools.map(toolId => runner(hermesPath, agent.id, ['tools', originalTools.get(toolId) === true ? 'enable' : 'disable', toolId])),
      ...(soulPath === undefined || originalInstructions === undefined ? [] : [writeFile(soulPath, originalInstructions, { encoding: 'utf8', mode: 0o600 }).then(() => '')]),
    ])
    const rollbackErrors = rollback.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], 'Hermes configuration update failed and rollback was incomplete')
    }
    throw error
  }
}
