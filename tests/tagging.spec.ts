import { describe, expect, it } from 'vitest'
import { mentionedAgents, mentionedChannelAgents, parseHermesProfileDescription, parseHermesProfileList, parseTags, rankChannelAgents, routeChannelAgents } from '../server/src/relay.ts'

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

  it('routes an unmentioned request to the agent whose description best matches the work', () => {
    const agents = [
      { id: 'frontend', displayName: 'Frontend', description: 'Owns React UI, browser interactions, styling, and accessibility.' },
      { id: 'backend', displayName: 'Backend', description: 'Authoritative backend engineering specialist for APIs, services, data, auth, jobs, integrations, migrations, testing, runtime correctness, and application observability.' },
      { id: 'infrastructure', displayName: 'Infrastructure', description: 'Owns deployment, containers, runtime operations, and observability.' },
    ]

    expect(routeChannelAgents(
      agents.map(agent => agent.id),
      'Please fix how messages are persisted and add database validation.',
      agents,
    )).toEqual(['backend'])
  })

  it('gives the AI router inspectable local ranking evidence', () => {
    expect(rankChannelAgents(['frontend', 'backend'], 'Fix persisted message validation.', [
      { id: 'frontend', displayName: 'Frontend', description: 'Owns React UI and styling.' },
      { id: 'backend', displayName: 'Backend', description: 'Owns persistence, validation, APIs, and services.' },
    ])).toEqual([
      { id: 'backend', score: 2, matchedTerms: ['persisted', 'validation'] },
      { id: 'frontend', score: 0, matchedTerms: [] },
    ])
  })

  it('falls back to one agent instead of broadcasting when no routing metadata is available', () => {
    expect(routeChannelAgents(['backend', 'frontend'], 'Please take a look.', [
      { id: 'backend', displayName: 'Backend' },
      { id: 'frontend', displayName: 'Frontend' },
    ])).toEqual(['backend'])
  })

  it('expands @all to every seated agent as an explicit mention', () => {
    const agents = [
      { id: 'frontend', displayName: 'Frontend' },
      { id: 'backend', displayName: 'Backend' },
      { id: 'reviewer', displayName: 'Reviewer' },
    ]

    expect(mentionedChannelAgents(['frontend', 'backend'], '@all please check', agents))
      .toEqual(['frontend', 'backend'])
  })

  it('routes unique workspace names without exposing native profile ids', () => {
    const agents = [
      { id: 'default', displayName: 'AgentOps' },
      { id: 'backend', displayName: 'Backend' },
    ]

    expect(routeChannelAgents(['default', 'backend'], '@agentops please check', agents)).toEqual(['default'])
    expect(mentionedAgents('@default does not address a hidden id', agents)).toEqual([])
  })

  it('routes renamed workspace handles when native harness names collide', () => {
    const agents = [
      { id: 'default', displayName: 'default' },
      { id: 'codex-default', displayName: 'default (Codex)' },
    ]

    expect(routeChannelAgents(agents.map(agent => agent.id), '@default-codex hello', agents))
      .toEqual(['codex-default'])
    expect(routeChannelAgents(agents.map(agent => agent.id), '@default hello', agents))
      .toEqual(['default'])
  })

  it('discovers default and named Hermes profiles as agent identities', () => {
    expect(parseHermesProfileList(PROFILE_TABLE)).toEqual([
      { id: 'default', displayName: 'AgentOps', adapter: 'hermes', model: 'gpt-5.6-sol', status: 'running' },
      { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'gpt-5.6-luna', status: 'stopped' },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'gpt-5.6-luna', status: 'stopped' },
    ])
  })

  it('parses a Hermes profile description for routing and peer discovery', () => {
    expect(parseHermesProfileDescription('Owns APIs, persistence, and migrations.\n'))
      .toBe('Owns APIs, persistence, and migrations.')
    expect(parseHermesProfileDescription('Backend: Owns APIs and migrations.\n'))
      .toBe('Backend: Owns APIs and migrations.')
    expect(parseHermesProfileDescription('Backend has no description.')).toBeUndefined()
  })
})
