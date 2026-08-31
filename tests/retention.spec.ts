import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'
import { addTestHarness, discoverTestHarnesses } from './test-harnesses.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('explicit retention', () => {
  it('previews and revision-guards a scoped conversation purge', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-retention-'))
    roots.push(root)
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'Retained reply.' }),
    })
    await service.initialize()
    await addTestHarness(service, 'codex', 'Review Bot')
    const channel = (await service.mutate({ action: 'create-channel', name: 'retention', agentIds: ['codex'] })).channels[0]!
    const sent = await service.send({
      conversation: { kind: 'channel', id: channel.id },
      text: '@review-bot retain until explicit purge.',
      files: [{ name: 'retention.txt', mimeType: 'text/plain', data: Buffer.from('retention').toString('base64') }],
    })
    await service.whenIdle()
    await service.addPin({ scope: { kind: 'thread', id: sent.thread!.id }, kind: 'message', messageId: sent.accepted.id })
    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Unrelated DM history.' })
    await service.whenIdle()
    const fileId = sent.accepted.files![0]!.id
    const previewRetention = (service as unknown as {
      previewRetention(conversation: { kind: 'channel'; id: string }): unknown
    }).previewRetention
    const applyRetention = (service as unknown as {
      applyRetention(request: { conversation: { kind: 'channel'; id: string }; expectedRevision: number }): Promise<unknown>
    }).applyRetention
    expect(() => previewRetention.call(service, { kind: 'bogus', id: 'codex' } as never))
      .toThrow('invalid retention conversation')

    const preview = previewRetention.call(service, { kind: 'channel', id: channel.id }) as {
      revision: number
      messages: number
      threads: number
      attachments: number
      pins: number
    }
    expect(preview).toMatchObject({ messages: 2, threads: 1, attachments: 1, pins: 1 })
    expect(service.snapshot().messages[`channel:${channel.id}`]).toHaveLength(2)
    await service.mutate({ action: 'set-channel-context', channelId: channel.id, instructions: 'Changed after preview.' })
    await expect(applyRetention.call(service, { conversation: { kind: 'channel', id: channel.id }, expectedRevision: preview.revision }))
      .rejects.toThrow('retention preview is stale')

    const current = previewRetention.call(service, { kind: 'channel', id: channel.id }) as typeof preview
    const internals = service as unknown as { channelMemoryTails: Map<string, Promise<unknown>> }
    internals.channelMemoryTails.set(channel.id, Promise.resolve())
    await expect(applyRetention.call(service, { conversation: { kind: 'channel', id: channel.id }, expectedRevision: current.revision }))
      .rejects.toThrow('conversation has active work')
    internals.channelMemoryTails.delete(channel.id)
    await applyRetention.call(service, { conversation: { kind: 'channel', id: channel.id }, expectedRevision: current.revision })

    expect(service.snapshot().channels.some(candidate => candidate.id === channel.id)).toBe(true)
    expect(service.snapshot().messages[`channel:${channel.id}`]).toBeUndefined()
    expect(service.snapshot().threads.some(thread => thread.channelId === channel.id)).toBe(false)
    expect(service.snapshot().pins).toHaveLength(0)
    expect(service.snapshot().messages['dm:codex']?.map(message => message.text)).toEqual(['Unrelated DM history.', 'Retained reply.'])
    await expect(service.readFileAttachment(fileId)).rejects.toThrow('unknown file attachment')
    await service.close()
  })
})
