// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { COMMONSPACE_STATE_VERSION, type CommonspaceAgentTrace } from '@commonspace/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../ui/src/CommonspaceConversation.tsx'

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
afterEach(cleanup)

function renderAgentMessage(text: string, trace?: CommonspaceAgentTrace) {
  const messages = [{
    id: 'message-1',
    conversation: { kind: 'dm' as const, id: 'writer' },
    authorType: 'agent' as const,
    authorId: 'writer',
    authorName: 'Writer',
    text,
    createdAt: '2026-08-26T00:00:00.000Z',
    ...(trace === undefined ? {} : { trace }),
  }]
  const snapshot = {
    bootstrap: {
      agents: [{ id: 'writer', displayName: 'Writer', adapter: 'hermes' as const, model: null, status: 'running' as const }],
      discoveredAgents: [],
      state: {
        version: COMMONSPACE_STATE_VERSION,
        revision: 1,
        defaults: { model: null, reasoning: 'max' as const, maxAgentsPerTurn: 4, memoryThreads: 12 },
        agents: [],
        dmSessions: {},
        agentSessions: {},
        projects: [],
        channels: [],
        threads: [],
        messages: { 'dm:writer': messages },
      },
    },
    loading: false,
    sending: false,
    error: null,
    activeConversation: { kind: 'dm' as const, id: 'writer' },
    activeProjectId: null,
    activeThreadId: null,
  }
  const store = {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    messages: () => messages,
    send: vi.fn(),
    mutate: vi.fn(),
    selectThread: vi.fn(),
  }

  return render(<CommonspaceConversation store={store as never} />)
}

describe('Commonspace message markdown', () => {
  it('keeps an accessible message placeholder visible while the Markdown renderer loads', () => {
    renderAgentMessage('Formatting **in progress**.')

    expect(screen.getByRole('status', { name: 'Formatting agent message' })).toBeTruthy()
  })

  it('renders structured assistant markdown instead of showing its source punctuation', async () => {
    const { container } = renderAgentMessage([
      '## Result',
      '',
      'This is **important** with `inline()` code.',
      '',
      '- First item',
      '- Second item',
      '',
      '| Name | State |',
      '| --- | --- |',
      '| Commonspace | Ready |',
      '',
      '[Hermes](https://hermes-agent.nousresearch.com/docs)',
    ].join('\n'))

    expect(await screen.findByRole('heading', { level: 2, name: 'Result' })).toBeTruthy()
    expect(container.querySelector('[data-streamdown="strong"]')?.textContent).toBe('important')
    expect(container.querySelector('.csp-message-content code')?.textContent).toBe('inline()')
    expect(screen.getByRole('list').children).toHaveLength(2)
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Hermes' }).getAttribute('href')).toBe('https://hermes-agent.nousresearch.com/docs')
    expect(container.textContent).not.toContain('**important**')
  })

  it('does not load agent-provided image URLs until the user chooses to open them', async () => {
    const { container } = renderAgentMessage('![Tracking pixel](https://example.test/pixel.png)')

    const imageLink = await screen.findByRole('link', { name: 'Open image: Tracking pixel' })
    expect(container.querySelector('img')).toBeNull()
    expect(imageLink.getAttribute('href')).toBe('https://example.test/pixel.png')
    expect(imageLink.getAttribute('target')).toBe('_blank')
    expect(imageLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('reveals the harness-emitted reasoning, plan, tool calls, and usage for an agent reply', () => {
    renderAgentMessage('The change is ready.', {
      adapter: 'codex',
      startedAt: '2026-08-26T00:00:00.000Z',
      completedAt: '2026-08-26T00:00:03.200Z',
      entries: [
        {
          type: 'reasoning',
          id: 'reasoning',
          text: 'Inspecting the workspace and choosing the smallest safe change.',
          createdAt: '2026-08-26T00:00:00.100Z',
          updatedAt: '2026-08-26T00:00:00.400Z',
        },
        {
          type: 'plan',
          id: 'plan',
          steps: [
            { text: 'Inspect the relevant files', priority: 'high', status: 'completed' },
            { text: 'Implement and verify the change', priority: 'high', status: 'in_progress' },
          ],
          createdAt: '2026-08-26T00:00:00.500Z',
          updatedAt: '2026-08-26T00:00:01.000Z',
        },
        {
          type: 'tool',
          id: 'call-1',
          title: 'Read package metadata',
          toolName: 'read_file',
          toolKind: 'read',
          status: 'completed',
          input: '{\n  "path": "[host path]/package.json"\n}',
          output: 'Package metadata loaded.',
          createdAt: '2026-08-26T00:00:01.100Z',
          updatedAt: '2026-08-26T00:00:02.000Z',
        },
        {
          type: 'usage',
          id: 'usage',
          usedTokens: 640,
          contextWindow: 128000,
          createdAt: '2026-08-26T00:00:03.000Z',
          updatedAt: '2026-08-26T00:00:03.000Z',
        },
      ],
    })

    expect(screen.queryByRole('region', { name: 'Writer activity trace' })).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Show Codex activity for Writer' })
    expect(toggle.textContent).toContain('1 tool')
    expect(toggle.textContent).toContain('3.2s')
    fireEvent.click(toggle)

    const trace = screen.getByRole('region', { name: 'Writer activity trace' })
    expect(within(trace).getByText('Reasoning summary')).toBeTruthy()
    expect(trace.textContent).toContain('Inspecting the workspace and choosing the smallest safe change.')
    expect(trace.textContent).toContain('Implement and verify the change')
    expect(trace.textContent).toContain('Read package metadata')
    expect(trace.textContent).toContain('[host path]/package.json')
    expect(trace.textContent).toContain('Package metadata loaded.')
    expect(trace.textContent).toContain('640 / 128,000 tokens')
    expect(screen.getByRole('button', { name: 'Hide Codex activity for Writer' })).toBeTruthy()
  })
})
