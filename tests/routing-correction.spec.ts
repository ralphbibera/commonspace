import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService, type AgentRunInput } from '../server/src/service.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('routing correction', () => {
  it('reroutes only one assignment while preserving every attempt and reply', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-correction-'))
    roots.push(root)
    const firstRoot = join(root, 'first')
    const secondRoot = join(root, 'second')
    await Promise.all([mkdir(firstRoot), mkdir(secondRoot)])
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: null, status: 'stopped' as const },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes' as const, model: null, status: 'stopped' as const },
      { id: 'reviewer', displayName: 'Reviewer', adapter: 'hermes' as const, model: null, status: 'stopped' as const },
      { id: 'outsider', displayName: 'Outsider', adapter: 'hermes' as const, model: null, status: 'stopped' as const },
    ]
    const runAgent = vi.fn(async (input: AgentRunInput) => `${input.agent.id}: ${input.message}`)
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: async () => agents,
      runAgent,
      routeAgents: async input => ({
        assignments: [
          { agentId: 'backend', subRequest: 'Change the API.', projectIds: [input.projects[0]!.id] },
          { agentId: 'frontend', subRequest: 'Change the UI.', projectIds: [input.projects[1]!.id] },
        ],
        reason: 'Backend and frontend own separate work.',
      }),
    })
    await service.initialize()
    for (const agent of agents) await service.mutate({ action: 'add-discovered-agent', agentId: agent.id })
    const first = (await service.mutate({ action: 'create-project', name: 'First', paths: [firstRoot] })).projects[0]!
    const second = (await service.mutate({ action: 'create-project', name: 'Second', paths: [secondRoot] })).projects[1]!
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'engineering',
      agentIds: ['backend', 'frontend', 'reviewer'],
    })).channels[0]!

    const sent = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      projectIds: [first.id, second.id],
      text: 'Change the API and UI.',
    })
    await service.whenIdle()
    const original = service.snapshot().messages[`channel:${channel.id}`]
      ?.find(message => message.id === sent.accepted.id)
    expect(original?.routing).toMatchObject({
      startedAt: expect.any(String),
      resolvedAt: expect.any(String),
      durationMs: expect.any(Number),
    })
    const frontendAssignment = original?.routing?.assignments.find(assignment => assignment.agentId === 'frontend')
    expect(frontendAssignment).toBeDefined()

    const reroute = (service as unknown as {
      rerouteAssignment(request: {
        sourceMessageId: string
        assignmentId: string
        agentId: string
        subRequest: string
        projectIds: string[]
      }): Promise<unknown>
    }).rerouteAssignment
    await expect(reroute.call(service, {
      sourceMessageId: sent.accepted.id,
      assignmentId: frontendAssignment!.id,
      agentId: 'outsider',
      subRequest: 'Review only the UI change.',
      projectIds: [second.id],
    })).rejects.toThrow('reroute agent must belong to the channel')
    await reroute.call(service, {
      sourceMessageId: sent.accepted.id,
      assignmentId: frontendAssignment!.id,
      agentId: 'reviewer',
      subRequest: 'Review only the UI change.',
      projectIds: [second.id],
    })
    await service.whenIdle()

    const state = service.snapshot()
    const messages = state.messages[`channel:${channel.id}`] ?? []
    const source = messages.find(message => message.id === sent.accepted.id)!
    const correction = source.routing?.corrections[0]
    const replacement = source.routing?.assignments.find(assignment => assignment.id === correction?.toAssignmentId)
    expect(source.routing?.assignments).toHaveLength(3)
    expect(correction).toMatchObject({
      id: expect.any(String),
      fromAssignmentId: frontendAssignment!.id,
      toAssignmentId: expect.any(String),
      createdAt: expect.any(String),
    })
    expect(replacement).toMatchObject({
      agentId: 'reviewer',
      subRequest: 'Review only the UI change.',
      projectIds: [second.id],
    })
    const deliveries = runAgent.mock.calls.map(call => ({
      agentId: call[0].agent.id,
      message: call[0].message,
    }))
    expect(deliveries).toHaveLength(3)
    expect(deliveries).toEqual(expect.arrayContaining([
      { agentId: 'backend', message: 'Change the API.' },
      { agentId: 'frontend', message: 'Change the UI.' },
      { agentId: 'reviewer', message: 'Review only the UI change.' },
    ]))
    const replies = messages.filter(message => message.authorType === 'agent').map(message => ({
      text: message.text,
      routingAssignmentId: message.routingAssignmentId,
    }))
    expect(replies).toHaveLength(3)
    expect(replies).toEqual(expect.arrayContaining([
      { text: 'backend: Change the API.', routingAssignmentId: source.routing?.assignments[0]?.id },
      { text: 'frontend: Change the UI.', routingAssignmentId: frontendAssignment!.id },
      { text: 'reviewer: Review only the UI change.', routingAssignmentId: replacement?.id },
    ]))
    expect(state.threads.find(thread => thread.id === sent.thread?.id)?.agentIds).toEqual([
      'backend',
      'frontend',
      'reviewer',
    ])
  })

  it('compacts explicit corrections into routing knowledge used by later decisions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-routing-memory-'))
    roots.push(root)
    const agents = [
      { id: 'backend', displayName: 'Backend', adapter: 'hermes' as const, model: null, status: 'stopped' as const },
      { id: 'reviewer', displayName: 'Reviewer', adapter: 'hermes' as const, model: null, status: 'stopped' as const },
    ]
    const runAgent = vi.fn(async (input: AgentRunInput) => input.sessionName.startsWith('Commonspace Inference:')
      ? '{"summary":"Route review-only requests to Reviewer."}'
      : `${input.agent.id}: done`)
    const routeAgents = vi.fn(async () => ({
      assignments: [{ agentId: 'backend', subRequest: 'Review this change.', projectIds: [] }],
      reason: 'Backend matched the request.',
    }))
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: async () => agents,
      runAgent,
      routeAgents,
    })
    await service.initialize()
    for (const agent of agents) await service.mutate({ action: 'add-discovered-agent', agentId: agent.id })
    const channel = (await service.mutate({
      action: 'create-channel',
      name: 'reviews',
      agentIds: agents.map(agent => agent.id),
    })).channels[0]!
    await service.updateRoutingConfiguration({ provider: 'harness', harnessAgentId: 'backend' })

    const first = await service.send({ conversation: { kind: 'channel', id: channel.id }, projectIds: [], text: 'Review this change.' })
    await service.whenIdle()
    const assignment = service.snapshot().messages[`channel:${channel.id}`]
      ?.find(message => message.id === first.accepted.id)?.routing?.assignments[0]
    expect(assignment).toBeDefined()
    if (assignment === undefined) return
    const corrected = await service.rerouteAssignment({
      sourceMessageId: first.accepted.id,
      assignmentId: assignment.id,
      agentId: 'reviewer',
      subRequest: 'Review this change only.',
      projectIds: [],
    })
    await service.whenIdle()

    const routingMemory = service.snapshot().channels.find(candidate => candidate.id === channel.id)?.routingMemory
    expect(routingMemory).toMatchObject({
      summary: 'Route review-only requests to Reviewer.',
      status: 'current',
      correctionCount: 1,
      compactedThroughCorrectionId: corrected.correction.id,
      updatedAt: expect.any(String),
    })

    await service.send({ conversation: { kind: 'channel', id: channel.id }, projectIds: [], text: 'Review another change.' })
    await service.whenIdle()
    expect(routeAgents.mock.calls[1]?.[0]).toMatchObject({
      routingMemory: 'Route review-only requests to Reviewer.',
    })
  })
})
