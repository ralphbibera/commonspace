import { describe, expect, it } from 'vitest'
import {
  parseHermesFastMode,
  parseHermesMcpCapabilities,
  parseHermesSkillCapabilities,
  parseHermesToolCapabilities,
  updateAgentConfiguration,
} from '../server/src/agent-configuration.ts'

describe('provider-native agent configuration', () => {
  it('maps Hermes native service tiers to the fast-mode control', () => {
    expect(parseHermesFastMode('fast')).toBe(true)
    expect(parseHermesFastMode('priority')).toBe(true)
    expect(parseHermesFastMode('normal')).toBe(false)
    expect(parseHermesFastMode('')).toBe(false)
    expect(parseHermesFastMode('turbo')).toBeNull()
  })

  it('parses Hermes tools with their native enabled state', () => {
    expect(parseHermesToolCapabilities(`
Built-in toolsets (cli):
  ✓ enabled  web  Web Search
  ✗ disabled  computer_use  Computer Use
`)).toEqual([
      { id: 'web', label: 'web', state: 'enabled', detail: 'Web Search' },
      { id: 'computer_use', label: 'computer_use', state: 'blocked', detail: 'Computer Use' },
    ])
  })

  it('parses configured Hermes MCP servers and skills', () => {
    expect(parseHermesMcpCapabilities(`
  clickup          https://mcp.clickup.com/mcp    all          ✓ enabled
  datadog          https://example.test/mcp       all          ✗ disabled
`)).toEqual([
      { id: 'clickup', label: 'clickup', state: 'configured', detail: 'enabled' },
      { id: 'datadog', label: 'datadog', state: 'blocked', detail: 'disabled' },
    ])
    expect(parseHermesSkillCapabilities(`
│ hermes-agent                    │ autonomous-ai-agents │ builtin │ builtin │ enabled │
│ private-skill                   │ local                │ local   │ local   │ disabled │
`)).toEqual([
      { id: 'hermes-agent', label: 'hermes-agent', state: 'enabled', detail: 'autonomous-ai-agents · builtin' },
      { id: 'private-skill', label: 'private-skill', state: 'available', detail: 'local · local' },
    ])
  })

  it('restores every original Hermes setting when a configuration write fails', async () => {
    const values = new Map([
      ['model.default', 'old-model'],
      ['agent.reasoning_effort', 'high'],
      ['agent.service_tier', 'normal'],
    ])
    const writes: string[][] = []
    const runHermes = async (_path: string, _profile: string, args: string[]): Promise<string> => {
      if (args[0] === 'config' && args[1] === 'get') return values.get(args[2]!) ?? ''
      if (args[0] === 'config' && args[1] === 'set') {
        writes.push(args)
        if (args[2] === 'agent.service_tier' && args[3] === 'fast') throw new Error('native write failed')
        values.set(args[2]!, args[3]!)
        return ''
      }
      return ''
    }

    await expect(updateAgentConfiguration('hermes', {
      id: 'default',
      displayName: 'AgentOps',
      adapter: 'hermes',
      model: 'old-model',
      status: 'running',
    }, {
      model: 'new-model',
      reasoning: 'max',
      fastMode: true,
    }, runHermes)).rejects.toThrow('native write failed')

    expect(Object.fromEntries(values)).toEqual({
      'model.default': 'old-model',
      'agent.reasoning_effort': 'high',
      'agent.service_tier': 'normal',
    })
    expect(writes.slice(-3)).toEqual([
      ['config', 'set', 'model.default', 'old-model'],
      ['config', 'set', 'agent.reasoning_effort', 'high'],
      ['config', 'set', 'agent.service_tier', 'normal'],
    ])
  })
})
