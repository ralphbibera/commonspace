// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { COMMONSPACE_STATE_VERSION, type CommonspaceBootstrap } from '@commonspace/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceProjectView } from '../ui/src/CommonspaceProjectView.tsx'
import { CommonspaceSidebar } from '../ui/src/CommonspaceSidebar.tsx'

afterEach(cleanup)

function projectBootstrap(): CommonspaceBootstrap {
  return {
    agents: [],
    discoveredAgents: [],
    state: {
      version: COMMONSPACE_STATE_VERSION,
      revision: 0,
      inboxReadAt: null,
      inboxReadMessageIds: [],
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [],
      dmSessions: {},
      agentSessions: {},
      projects: [{
        id: 'storefront',
        name: 'Storefront',
        paths: ['/work/storefront'],
        createdAt: '2026-08-27T00:00:00.000Z',
      }],
      channels: [],
      threads: [],
      messages: {},
    },
  }
}

function projectStore(additions: Record<string, unknown> = {}) {
  const snapshot = {
    bootstrap: projectBootstrap(),
    loading: false,
    sending: false,
    error: null,
    activeConversation: null,
    activeProjectId: null,
    activeThreadId: null,
  }
  return {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    refresh: vi.fn(async () => undefined),
    discoverAgents: vi.fn(async () => undefined),
    mutate: vi.fn(async () => undefined),
    selectDirectory: vi.fn(async () => null),
    selectConversation: vi.fn(),
    selectProject: vi.fn(),
    ...additions,
  }
}

describe('project navigation', () => {
  it('opens the project overview directly instead of toggling a dropdown', () => {
    const store = projectStore()
    const onOpenProject = vi.fn()
    render(
      <CommonspaceSidebar
        wide
        expandSidebar={() => undefined}
        store={store as never}
        onOpenProject={onOpenProject}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select project Storefront' }))

    expect(store.selectProject).toHaveBeenCalledWith('storefront')
    expect(onOpenProject).toHaveBeenCalledWith('storefront')
    expect(screen.getByRole('button', { name: 'Browse all projects' })).toBeTruthy()
    expect(screen.queryByRole('menu', { name: 'Project Storefront' })).toBeNull()
  })

  it('adds a local folder from the project overview using the native picker', async () => {
    const selectDirectory = vi.fn(async () => '/work/shared-design-system')
    const mutate = vi.fn(async () => undefined)
    const store = projectStore({ selectDirectory, mutate })
    render(
      <CommonspaceProjectView
        projectId="storefront"
        store={store as never}
        onBack={() => undefined}
        onOpenConversation={() => undefined}
      />,
    )

    const addFolder = screen.queryByRole('button', { name: 'Add local folder' })
    expect(addFolder).not.toBeNull()
    if (addFolder === null) return
    expect(screen.getByRole('tablist', { name: 'Project views' })).toBeTruthy()
    fireEvent.click(addFolder)

    await waitFor(() => {
      expect(selectDirectory).toHaveBeenCalledOnce()
      expect(mutate).toHaveBeenCalledWith({
        action: 'add-project-path',
        projectId: 'storefront',
        path: '/work/shared-design-system',
      })
    })
  })

  it('recovers when the native folder picker fails', async () => {
    const selectDirectory = vi.fn(async () => { throw new Error('picker failed') })
    const mutate = vi.fn(async () => undefined)
    const store = projectStore({ selectDirectory, mutate })
    render(
      <CommonspaceProjectView
        projectId="storefront"
        store={store as never}
        onBack={() => undefined}
        onOpenConversation={() => undefined}
      />,
    )

    const addFolder = screen.getByRole('button', { name: 'Add local folder' }) as HTMLButtonElement
    fireEvent.click(addFolder)

    await waitFor(() => { expect(addFolder.disabled).toBe(false) })
    expect(mutate).not.toHaveBeenCalled()
  })
})
