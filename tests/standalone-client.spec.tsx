// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceApp } from '../ui/src/CommonspaceApp.tsx'
import { mountCommonspace } from '../ui/src/main.tsx'

const emptySnapshot = {
  bootstrap: {
    agents: [],
    state: {
      version: 6,
      revision: 0,
      defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
      agents: [],
      dmSessions: {},
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

afterEach(cleanup)

describe('standalone Commonspace application', () => {
  it('mounts navigation and conversations without host slots', () => {
    const store = {
      subscribe: () => () => undefined,
      getSnapshot: () => emptySnapshot,
      refresh: vi.fn(async () => undefined),
      connectEvents: vi.fn(),
      disconnectEvents: vi.fn(),
      messages: () => [],
      mutate: vi.fn(async () => undefined),
      selectConversation: vi.fn(),
      selectProject: vi.fn(),
      selectThread: vi.fn(),
      send: vi.fn(async () => undefined),
    }

    const view = render(<CommonspaceApp store={store as never} />)

    expect(screen.getByLabelText('Commonspace application')).toBeTruthy()
    expect(screen.getByLabelText('Commonspace browser')).toBeTruthy()
    expect(screen.getByLabelText('Commonspace conversation')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull()
    expect(store.connectEvents).toHaveBeenCalledOnce()

    const navigation = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(navigation)
    expect(navigation.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByLabelText('Commonspace application').classList.contains('csp-app--nav-open')).toBe(true)

    view.unmount()
    expect(store.disconnectEvents).toHaveBeenCalledOnce()
  })

  it('boots into a normal DOM root with standalone styles', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const mounted = mountCommonspace(root)

    expect(document.querySelector('style[data-commonspace="standalone"]')).toBeTruthy()
    expect(root.querySelector('[aria-label="Commonspace application"]')).toBeTruthy()

    mounted.unmount()
    expect(document.querySelector('style[data-commonspace="standalone"]')).toBeNull()
  })
})
