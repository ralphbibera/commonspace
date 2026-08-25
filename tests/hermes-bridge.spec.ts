import { describe, expect, it } from 'vitest'
import { buildHermesInvocation, buildRoomPrompt, parseHermesProfileList, routeChannelAgents } from '../src/host/hermes.ts'

const PROFILE_TABLE = `Profile          Model                        Gateway      Alias        Distribution
 ───────────────    ───────────────────────────    ───────────    ───────────    ────────────────────
 ◆AgentOps (default) gpt-5.6-sol                  running      —            —
  backend         gpt-5.6-luna                 stopped      backend      —
  frontend        gpt-5.6-luna                 stopped      frontend     —`

describe('Hermes agent bridge', () => {
  it('discovers default and named profiles as agent identities', () => {
    expect(parseHermesProfileList(PROFILE_TABLE)).toEqual([
      { id: 'default', displayName: 'AgentOps', adapter: 'hermes', model: 'gpt-5.6-sol', status: 'running' },
      { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'gpt-5.6-luna', status: 'stopped' },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'gpt-5.6-luna', status: 'stopped' },
    ])
  })

  it('builds a shell-free Hermes Bot Chat invocation scoped to a project path', () => {
    expect(buildHermesInvocation({
      profile: 'frontend',
      cwd: '/Users/example/Developer/app',
      sessionName: 'Bot Chat',
      queryFile: '/tmp/message.txt',
      yolo: true,
      model: 'openai/gpt-5.2',
      reasoning: 'high',
    })).toEqual({
      command: 'hermes',
      args: [
        '-p', 'frontend', 'chat', '--in', '/Users/example/Developer/app',
        '-c', 'Bot Chat', '--create-if-missing', '-Q', '--query-file',
        '/tmp/message.txt', '--source', 'tool', '--model', 'openai/gpt-5.2', '--reasoning', 'high', '--yolo',
      ],
    })
  })

  it('builds an attributed channel prompt with bounded recent history', () => {
    const prompt = buildRoomPrompt({
      channel: 'engineering',
      agent: 'backend',
      userText: 'Please investigate the checkout failure.',
      recent: [
        { authorName: 'Ralph', text: 'Checkout fails after payment.' },
        { authorName: 'Frontend', text: 'The response reaches the client.' },
      ],
    })
    expect(prompt).toContain('Commonspace channel #engineering')
    expect(prompt).toContain('Ralph: Checkout fails after payment.')
    expect(prompt).toContain('You are responding as @backend')
    expect(prompt).toContain('Other agents in Commonspace are peers')
    expect(prompt).not.toContain('Other Hermes profiles')
    expect(prompt).toContain('Please investigate the checkout failure.')
  })

  it('routes mentions only to agents seated in the channel', () => {
    const agents = [{ id: 'frontend' }, { id: 'backend' }, { id: 'infrastructure' }]
    expect(routeChannelAgents(['frontend', 'backend'], '@frontend please investigate', agents)).toEqual(['frontend'])
    expect(routeChannelAgents(['frontend', 'backend'], '@infrastructure please investigate', agents)).toEqual(['frontend', 'backend'])
    expect(routeChannelAgents(['front.end'], '@front.end investigate', [...agents, { id: 'front.end' }])).toEqual(['front.end'])
  })
})
