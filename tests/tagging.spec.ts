import { describe, expect, it } from 'vitest'
import { parseTags, routeChannelAgents } from '../src/host/hermes.ts'

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
      { id: 'frontend' },
      { id: 'backend' },
    ])).toEqual(['backend'])
  })
})
