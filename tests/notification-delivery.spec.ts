import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deriveCommonspaceInboxItems, type CommonspaceDesktopNotification } from '@commonspace/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceHostService } from '../server/src/service.ts'
import { addTestHarness, discoverTestHarnesses } from './test-harnesses.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('desktop notification delivery', () => {
  it('delivers only new enabled Inbox events and does not replay them after restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-notifications-'))
    roots.push(root)
    const delivered: CommonspaceDesktopNotification[] = []
    const notify = vi.fn(async (notification: CommonspaceDesktopNotification) => { delivered.push(notification) })
    const dependencies = {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'Finished notification work.' }),
      notify,
    }
    const service = new CommonspaceHostService({}, { root }, dependencies)
    await service.initialize()
    service.attachClientUrl('http://127.0.0.1:3100')
    await addTestHarness(service, 'codex', 'Codex')

    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Disabled notification.' })
    await service.whenIdle()
    expect(notify).not.toHaveBeenCalled()

    await service.mutate({
      action: 'set-notifications',
      notifications: { enabled: true, replies: true, mentions: true, permissions: true, failures: true, sound: false },
    })
    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Enabled notification.' })
    await service.whenIdle()

    expect(delivered).toHaveLength(1)
    expect(delivered[0]).toMatchObject({ category: 'reply', title: 'Codex replied in Codex' })
    expect(new URL(delivered[0]!.url).searchParams.get('messageId')).toBeTruthy()
    expect(deriveCommonspaceInboxItems(service.snapshot()).filter(item => item.kind === 'completion')).toHaveLength(2)
    await service.close()

    const restarted = new CommonspaceHostService({}, { root }, dependencies)
    await restarted.initialize()
    restarted.attachClientUrl('http://127.0.0.1:3100')
    await restarted.whenIdle()
    expect(delivered).toHaveLength(1)
    expect(restarted.snapshot().notifications.enabled).toBe(true)
    await restarted.close()
  })

  it('delivers mentions, permission requests, and failures through their own categories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-notification-categories-'))
    roots.push(root)
    const delivered: CommonspaceDesktopNotification[] = []
    let mode: 'mention' | 'permission' | 'failure' = 'mention'
    const service = new CommonspaceHostService({}, { root }, {
      discoverAgents: discoverTestHarnesses,
      notify: async notification => { delivered.push(notification) },
      runAgent: async input => {
        if (mode === 'failure') throw new Error('native run failed')
        if (mode === 'permission') {
          await input.onPermissionRequest!({
            toolCallId: 'tool-1',
            title: 'Allow focused test execution?',
            options: [{ optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' }],
          })
          return { text: 'Permission granted.' }
        }
        return { text: '@Ralph please review the result.' }
      },
    })
    await service.initialize()
    service.attachClientUrl('http://127.0.0.1:3100')
    await addTestHarness(service, 'codex', 'Codex')
    await service.mutate({
      action: 'set-notifications',
      notifications: { enabled: true, replies: true, mentions: true, permissions: true, failures: true, sound: false },
    })

    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Mention me.' })
    await service.whenIdle()
    expect(delivered.some(notification => notification.category === 'mention')).toBe(true)

    mode = 'failure'
    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Fail visibly.' })
    await service.whenIdle()
    expect(delivered.some(notification => notification.category === 'failure')).toBe(true)

    mode = 'permission'
    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Request permission.' })
    await vi.waitFor(() => { expect(delivered.some(notification => notification.category === 'permission')).toBe(true) })
    const permission = service.snapshot().permissions.find(candidate => candidate.status === 'pending')!
    await service.respondPermission(permission.id, 'allow-once')
    await service.whenIdle()
    await service.close()
  })

  it('keeps the durable result when native notification delivery fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commonspace-notification-failure-'))
    roots.push(root)
    const warn = vi.fn()
    const service = new CommonspaceHostService({ logger: { warn } }, { root }, {
      discoverAgents: discoverTestHarnesses,
      runAgent: async () => ({ text: 'Durable despite notification failure.' }),
      notify: async () => { throw new Error('notification center unavailable') },
    })
    await service.initialize()
    service.attachClientUrl('http://127.0.0.1:3100')
    await addTestHarness(service, 'codex', 'Codex')
    await service.mutate({
      action: 'set-notifications',
      notifications: { enabled: true, replies: true, mentions: true, permissions: true, failures: true, sound: false },
    })

    await service.send({ conversation: { kind: 'dm', id: 'codex' }, text: 'Persist this result.' })
    await service.whenIdle()

    expect(service.snapshot().messages['dm:codex']?.some(message => message.text === 'Durable despite notification failure.')).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('notification center unavailable'))
    await service.close()
  })
})
