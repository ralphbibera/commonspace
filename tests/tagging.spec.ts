import { describe, expect, it } from 'vitest'
import { parseHermesProfileList, parseTags, routeChannelAgents } from '../server/src/relay.ts'

const PROFILE_TABLE = `Profile          Model                        Gateway      Alias        Distribution
 ───────────────    ───────────────────────────    ───────────    ───────────    ────────────────────
 ◆AgentOps (default) gpt-5.6-sol                  running      —            —
  backend         gpt-5.6-luna                 stopped      backend      —
  frontend        gpt-5.6-luna                 stopped      frontend     —`

describe('Commonspace tagging', () => {
  it('parses agent, project, and channel references without confusing @@ with @', () => {
    expect(parseTags('Ask @backend to inspect @@commonspace in #general.')).toEqual({
      agents: ['backend'],
      projects: ['commonspace'],
      channels: ['general'],
    })
  })

  it('does not treat email addresses or inline punctuation as tags', () => {
    expect(parseTags('Email a@backend.test; literal @@ and #.')).toEqual({
      agents: [],
      projects: [],
      channels: [],
    })
  })

  it('routes only explicitly mentioned seated agents', () => {
    expect(routeChannelAgents(['frontend', 'backend'], '@backend please check @@api', [
      { id: 'frontend', displayName: 'Frontend' },
      { id: 'backend', displayName: 'Backend' },
    ])).toEqual(['backend'])
  })

  it('routes display handles without exposing internal profile ids', () => {
    const agents = [
      { id: 'default', displayName: 'AgentOps' },
      { id: 'backend', displayName: 'Backend' },
    ]

    expect(routeChannelAgents(['default', 'backend'], '@agentops please check', agents)).toEqual(['default'])
    expect(routeChannelAgents(['default', 'backend'], '@default still works', agents)).toEqual(['default'])
  })

  it('discovers default and named Hermes profiles as agent identities', () => {
    expect(parseHermesProfileList(PROFILE_TABLE)).toEqual([
      { id: 'default', displayName: 'AgentOps', adapter: 'hermes', model: 'gpt-5.6-sol', status: 'running' },
      { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'gpt-5.6-luna', status: 'stopped' },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'gpt-5.6-luna', status: 'stopped' },
    ])
  })
})
