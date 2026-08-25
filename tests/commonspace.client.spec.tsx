// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../src/client/CommonspaceConversation.tsx'
import { CommonspaceModeController } from '../src/client/commonspace-mode.ts'
import { CommonspaceModeSwitch } from '../src/client/CommonspaceModeSwitch.tsx'
import { CommonspaceSidebar } from '../src/client/CommonspaceSidebar.tsx'
import { apply, inject } from '../src/client/index.ts'
import { tagReferenceParts, tagSuggestions } from '../src/client/tagging.ts'

afterEach(cleanup)

describe('Commonspace workspace mode', () => {
  it('highlights supported references without changing message text', () => {
    expect(tagReferenceParts('Ask @backend about @@commonspace in #general')).toEqual([
      { text: 'Ask ', kind: 'text' },
      { text: '@backend', kind: 'agent' },
      { text: ' about ', kind: 'text' },
      { text: '@@commonspace', kind: 'project' },
      { text: ' in ', kind: 'text' },
      { text: '#general', kind: 'channel' },
    ])
  })

  it('suggests the active tag type from the current word', () => {
    expect(tagSuggestions('Please ask @ba', {
      agents: [{ id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'x', status: 'running' }],
      state: { version: 5, revision: 0, defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 }, agents: [], agentSessions: {}, projects: [{ id: 'commonspace', name: 'Commonspace', paths: [], createdAt: '' }], channels: [{ id: 'general', name: 'general', projectId: null, agentIds: [], instructions: '', memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null }, settings: { model: null, reasoning: null }, createdAt: '' }], threads: [], messages: {} },
    })).toEqual([{ kind: 'agent', id: 'backend', label: 'Backend', token: '@backend' }])
  })

  it('switches between Commonspace and native Workspaces labels', () => {
    const mode = new CommonspaceModeController()
    render(<CommonspaceModeSwitch wide mode={mode} />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Commonspace' }))
    expect(mode.getSnapshot()).toBe('commonspace')
    expect(screen.getByRole('button', { name: 'Switch to Workspaces' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Workspaces' }))
    expect(mode.getSnapshot()).toBe('workspaces')
  })

  it('adds and removes managed Codex and Claude Code agents from the sidebar', async () => {
    const mutate = vi.fn(async () => undefined)
    const snapshot = {
      bootstrap: {
        agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-5.4', status: 'unknown' }],
        state: {
          version: 5,
          revision: 1,
          defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
          agents: [{ id: 'codex-review-bot', displayName: 'Review Bot', adapter: 'codex', model: 'gpt-5.4', createdAt: '2026-08-25T00:00:00.000Z' }],
          agentSessions: {},
          projects: [],
          channels: [],
          threads: [],
          messages: {},
        },
      },
      loading: false,
      sending: false,
      error: null,
      activeConversation: null,
      activeProjectId: null,
      activeThreadId: null,
    } as const
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      refresh: vi.fn(async () => undefined),
      mutate,
      selectConversation: vi.fn(),
      selectProject: vi.fn(),
    }
    render(<CommonspaceSidebar wide expandSidebar={() => undefined} store={store as never} />)
    expect(screen.getByText('Codex CLI · gpt-5.4 · configured')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add agent' }))
    fireEvent.change(screen.getByLabelText('Agent name'), { target: { value: 'Builder' } })
    fireEvent.change(screen.getByLabelText('Agent adapter'), { target: { value: 'claude-code' } })
    fireEvent.change(screen.getByLabelText('Agent model'), { target: { value: 'claude-sonnet-4-6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'add-agent', displayName: 'Builder', adapter: 'claude-code', model: 'claude-sonnet-4-6' })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove agent Review Bot' }))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ action: 'remove-agent', agentId: 'codex-review-bot' })
    })
  })

  it('shadows sidebar and conversation only while Commonspace mode is active', () => {
    const registrations = [] as Array<{ options: Record<string, unknown>; component: unknown; dispose: ReturnType<typeof vi.fn> }>
    const register = vi.fn((options: Record<string, unknown>, component: unknown) => {
      const entry = { options, component, dispose: vi.fn() }
      registrations.push(entry)
      return entry.dispose
    })
    const injectSlot = vi.fn((_name: string, mount: () => () => void) => mount())
    let disposeEffect: (() => void) | undefined
    const ctx = {
      slots: { inject: injectSlot, register },
      effect: (mount: () => () => void) => { disposeEffect = mount() },
    }

    expect(inject).toEqual(['slots'])
    apply(ctx as never)

    const footer = registrations.find(entry => entry.component === CommonspaceModeSwitch)
    expect(footer).toBeDefined()
    expect(registrations.some(entry => entry.component === CommonspaceSidebar)).toBe(false)
    expect(registrations.some(entry => entry.component === CommonspaceConversation)).toBe(false)

    const mode = (footer?.options.inject as () => { mode: CommonspaceModeController })().mode
    mode.showCommonspace()

    const sidebar = registrations.find(entry => entry.component === CommonspaceSidebar)
    const conversation = registrations.find(entry => entry.component === CommonspaceConversation)
    expect(sidebar?.options).toMatchObject({ name: 'sidebar.workspaces', priority: -20 })
    expect(conversation?.options).toMatchObject({ name: 'conversation', priority: -20 })

    mode.showWorkspaces()
    expect(sidebar?.dispose).toHaveBeenCalledOnce()
    expect(conversation?.dispose).toHaveBeenCalledOnce()

    disposeEffect?.()
    expect(footer?.dispose).toHaveBeenCalledOnce()
    expect(document.querySelector('style[data-commonspace="workspace"]')).toBeNull()
  })
})
