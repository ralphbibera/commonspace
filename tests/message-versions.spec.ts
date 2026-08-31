import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService, type AgentRunInput } from '../server/src/service.ts'
import { addTestHarness, discoverTestHarnesses } from './test-harnesses.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('message versions', () => {
  it('branches an edited human message into a new Thread and native session', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-message-version-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => ({ text: `Reply to: ${input.message}` }))
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent,
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const channel = (await service.mutate({ action: 'create-channel', name: 'versions', agentIds: ['codex'] })).channels[0]!
    const original = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: '@review-bot inspect the original boundary.',
    })
    await service.whenIdle()
    const editMessage = (service as unknown as {
      editMessage(request: { messageId: string; text: string; projectIds?: string[] }): Promise<{ accepted: { id: string }; thread?: { id: string } }>
    }).editMessage

    const edited = await editMessage.call(service, {
      messageId: original.accepted.id,
      text: '@review-bot inspect only the corrected boundary.',
    })
    await service.whenIdle()

    const messages = service.snapshot().messages[`channel:${channel.id}`] ?? []
    const editedMessage = messages.find(message => message.id === edited.accepted.id)
    expect(edited.thread?.id).not.toBe(original.thread?.id)
    expect(editedMessage).toMatchObject({
      text: '@review-bot inspect only the corrected boundary.',
      versionRootMessageId: original.accepted.id,
      supersedesMessageId: original.accepted.id,
      branchId: expect.any(String),
    })
    expect(messages.find(message => message.id === original.accepted.id)?.text).toBe('@review-bot inspect the original boundary.')
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceMessageId: original.accepted.id, text: 'Reply to: @review-bot inspect the original boundary.' }),
      expect.objectContaining({ sourceMessageId: edited.accepted.id, text: 'Reply to: @review-bot inspect only the corrected boundary.' }),
    ]))
    expect(runAgent.mock.calls.map(call => call[0].sessionName)).toHaveLength(2)
    expect(runAgent.mock.calls[0]?.[0].sessionName).not.toBe(runAgent.mock.calls[1]?.[0].sessionName)

    const agentReply = messages.find(message => message.authorType === 'agent')!
    await expect(editMessage.call(service, { messageId: agentReply.id, text: 'Pretend this was native output.' }))
      .rejects.toThrow('only human messages can be edited')
    await service.close()
  })

  it('rotates the native DM generation for an edited human message', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-dm-version-'))
    roots.push(root)
    const runAgent = vi.fn(async (input: AgentRunInput) => ({ text: `Reply to: ${input.message}` }))
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent,
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const original = await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Inspect the original DM boundary.' })
    await service.whenIdle()

    const edited = await service.editMessage({
      messageId: original.accepted.id,
      text: 'Inspect only the corrected DM boundary.',
    })
    await service.whenIdle()

    expect(runAgent.mock.calls.map(call => call[0].sessionName)).toEqual([
      'Bot Chat',
      expect.stringMatching(/^Commonspace DM: /u),
    ])
    expect(service.snapshot().messages['dm:codex']).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: original.accepted.id, text: 'Inspect the original DM boundary.' }),
      expect.objectContaining({
        id: edited.accepted.id,
        text: 'Inspect only the corrected DM boundary.',
        versionRootMessageId: original.accepted.id,
        supersedesMessageId: original.accepted.id,
      }),
      expect.objectContaining({ authorType: 'system', text: expect.stringContaining('New session started') }),
    ]))
    await service.close()
  })

  it('does not rotate a DM generation when the edited version is invalid', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-invalid-dm-version-'))
    roots.push(root)
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'Reply.' }),
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const original = await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Valid original.' })
    await service.whenIdle()

    await expect(service.editMessage({ messageId: original.accepted.id, text: '   ' }))
      .rejects.toThrow('message text or image is required')

    expect(service.snapshot().dmSessions.codex).toBeUndefined()
    expect(service.snapshot().messages['dm:codex']?.some(message => message.authorType === 'system')).toBe(false)
    await service.close()
  })

  it('carries only pre-branch Thread history into an edited reply branch', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-thread-reply-version-'))
    roots.push(root)
    const scopes: NonNullable<AgentRunInput['commonspaceScope']>[] = []
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async (input) => {
        if (input.commonspaceScope !== undefined) scopes.push(input.commonspaceScope)
        return { text: `Reply to: ${input.message}` }
      },
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const channel = (await service.mutate({ action: 'create-channel', name: 'reply-branches', agentIds: ['codex'] })).channels[0]!
    const first = await service.send({ conversation: { kind: 'channel', id: channel.id }, text: '@review-bot establish branch context.' })
    await service.whenIdle()
    const followup = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      threadId: first.thread!.id,
      targetAgentId: 'codex',
      text: 'Superseded follow-up body.',
    })
    await service.whenIdle()

    const edited = await service.editMessage({
      messageId: followup.accepted.id,
      text: '@review-bot corrected follow-up body.',
    })
    await service.whenIdle()

    expect(edited.thread).toMatchObject({
      branchedFromThreadId: first.thread!.id,
      branchPointMessageId: followup.accepted.id,
    })
    const context = await service.readContext(scopes.at(-1)!) as { messages: Array<{ text: string }> }
    expect(context.messages.map(message => message.text)).toEqual([
      '@review-bot establish branch context.',
      'Reply to: @review-bot establish branch context.',
      '@review-bot corrected follow-up body.',
      'Reply to: @review-bot corrected follow-up body.',
    ])
    await service.close()
  })

  it('replaces delivered content with a durable deletion marker', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-message-deletion-'))
    roots.push(root)
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'Deletion-safe reply.' }),
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const channel = (await service.mutate({ action: 'create-channel', name: 'deletions', agentIds: ['codex'] })).channels[0]!
    const sent = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: '@review-bot remove secret-delete-body after delivery.',
      attachments: [{ name: 'remove.png', mimeType: 'image/png', data: 'AA==' }],
    })
    await service.whenIdle()
    const attachmentId = sent.accepted.attachments?.[0]?.id
    expect(attachmentId).toBeDefined()
    await expect(service.readImageAttachment(attachmentId!)).resolves.toBeDefined()
    const deleteMessage = (service as unknown as {
      deleteMessage(messageId: string): Promise<unknown>
    }).deleteMessage

    await deleteMessage.call(service, sent.accepted.id)

    const messages = service.snapshot().messages[`channel:${channel.id}`] ?? []
    expect(messages.find(message => message.id === sent.accepted.id)).toMatchObject({
      text: '',
      deletedAt: expect.any(String),
      routing: expect.objectContaining({ source: 'explicit' }),
    })
    expect(messages.find(message => message.id === sent.accepted.id)?.attachments).toBeUndefined()
    expect(messages.some(message => message.authorType === 'agent' && message.text === 'Deletion-safe reply.')).toBe(true)
    expect(JSON.stringify(service.snapshot())).not.toContain('secret-delete-body')
    await expect(service.readImageAttachment(attachmentId!)).rejects.toThrow('unknown image attachment')
    await expect(service.editMessage({ messageId: sent.accepted.id, text: 'Revive deleted content.' }))
      .rejects.toThrow('deleted messages cannot be edited')
    await service.close()

    const restarted = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'No run expected.' }),
    })
    await restarted.initialize()
    expect(restarted.snapshot().messages[`channel:${channel.id}`]?.find(message => message.id === sent.accepted.id))
      .toMatchObject({ text: '', deletedAt: expect.any(String) })
    expect(JSON.stringify(restarted.snapshot())).not.toContain('secret-delete-body')
    await expect(restarted.readImageAttachment(attachmentId!)).rejects.toThrow('unknown image attachment')
    await restarted.close()
  })
})
