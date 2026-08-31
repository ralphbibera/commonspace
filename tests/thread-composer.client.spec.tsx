// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../ui/src/CommonspaceConversation.tsx'
import { commonspacePolish } from '../ui/src/polish.ts'
import { commonspaceStyles } from '../ui/src/styles.ts'

function renderChannelThread(
  threadStatus: 'complete' | 'queued' | 'running' = 'complete',
  includeBackendActivity = false,
  threadOpen = true,
  routingPending = false,
  routingResolved = false,
  routingCorrected = false,
  rootDeleted = false,
  rootVersioned = false,
  permissionPending = false,
) {
  const listeners = new Set<() => void>()
  const initialThreadId: string | null = threadOpen ? 'thread-1' : null
  const send = vi.fn(async () => undefined)
  const sendDirectReply = vi.fn(async () => undefined)
  const rerouteAssignment = vi.fn(async () => undefined)
  const updateThreadContext = vi.fn(async () => undefined)
  const compactThreadContext = vi.fn(async () => undefined)
  const addPin = vi.fn(async () => undefined)
  const removePin = vi.fn(async () => undefined)
  const editMessage = vi.fn(async () => undefined)
  const deleteMessage = vi.fn(async () => undefined)
  const respondPermission = vi.fn(async () => undefined)
  const mutate = vi.fn(async () => undefined)
  const selectThread = vi.fn((threadId: string | null) => {
    snapshot = { ...snapshot, activeThreadId: threadId }
    for (const listener of listeners) listener()
  })
  const liveActivities = threadStatus === 'complete' ? [] : [{
    id: 'run-1',
    agentId: 'frontend',
    agentName: 'Frontend',
    adapter: 'hermes' as const,
    conversation: { kind: 'channel' as const, id: 'general' },
    threadId: 'thread-1',
    startedAt: '2026-08-26T00:00:01.000Z',
    entries: [{
      type: 'reasoning' as const,
      id: 'reasoning-1',
      text: 'Tracing the request through the UI.',
      createdAt: '2026-08-26T00:00:01.000Z',
      updatedAt: '2026-08-26T00:00:01.000Z',
    }, {
      type: 'tool' as const,
      id: 'tool-1',
      title: 'Inspecting repository',
      toolName: 'rg',
      status: 'in_progress' as const,
      createdAt: '2026-08-26T00:00:02.000Z',
      updatedAt: '2026-08-26T00:00:02.000Z',
    }],
  }, ...(includeBackendActivity ? [{
    id: 'run-2',
    agentId: 'backend',
    agentName: 'Backend',
    adapter: 'codex' as const,
    conversation: { kind: 'channel' as const, id: 'general' },
    threadId: 'thread-1',
    startedAt: '2026-08-26T00:00:03.000Z',
    entries: [{
      type: 'reasoning' as const,
      id: 'reasoning-2',
      text: 'Checking the API lifecycle.',
      createdAt: '2026-08-26T00:00:04.000Z',
      updatedAt: '2026-08-26T00:00:04.000Z',
    }],
  }] : [])]
  let snapshot = {
    bootstrap: {
      agents: [
        { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'test', status: 'unknown' },
        { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'test', status: 'unknown' },
        { id: 'reviewer', displayName: 'Reviewer', adapter: 'hermes', model: 'test', status: 'unknown' },
      ],
      liveActivities,
      state: {
        version: 9,
        revision: 1,
        inboxReadAt: null,
        inboxReadMessageIds: [],
        defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
        agents: [],
        dmSessions: {},
        agentSessions: {},
        projects: [{ id: 'project-1', name: 'Commonspace', paths: [], createdAt: '2026-08-26T00:00:00.000Z' }],
        channels: [{
          id: 'general',
          name: 'general',
          agentIds: ['frontend', 'backend'],
          instructions: '',
          memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null },
          settings: { model: null, reasoning: null },
          createdAt: '2026-08-26T00:00:00.000Z',
        }],
        threads: [{
          id: 'thread-1',
          channelId: 'general',
          projectIds: ['project-1'],
          projectId: 'project-1',
          rootMessageId: 'root-1',
          agentIds: ['frontend'],
          context: {
            channelSnapshot: {
              summary: 'Inherited Channel summary.',
              decisions: ['Keep the original boundary.'],
              openQuestions: [],
              updatedAt: '2026-08-26T00:00:00.000Z',
              origin: 'user',
              status: 'current',
              sourceMessageCount: 2,
              estimatedTokens: 20,
              compactedThroughMessageId: 'older-message',
              capturedAt: '2026-08-26T00:00:00.000Z',
            },
            memory: {
              summary: 'Focused Thread summary.',
              decisions: ['Inspect the UI boundary.'],
              openQuestions: ['Does the fix pass?'],
              updatedAt: '2026-08-26T00:03:00.000Z',
              origin: 'automatic',
              status: 'current',
              sourceMessageCount: 4,
              estimatedTokens: 40,
              compactedThroughMessageId: 'reply-3',
            },
          },
          createdAt: '2026-08-26T00:00:00.000Z',
        }],
        pins: [{
          id: 'pin-1',
          scope: { kind: 'thread' as const, id: 'thread-1' },
          kind: 'note' as const,
          note: 'Pinned Thread guidance.',
          createdAt: '2026-08-26T00:04:00.000Z',
          removedAt: null,
        }],
        permissions: permissionPending ? [{
          id: 'permission-1',
          sourceMessageId: 'root-1',
          agentId: 'frontend',
          conversation: { kind: 'channel' as const, id: 'general' },
          threadId: 'thread-1',
          toolCallId: 'call-1',
          title: 'Run database migration',
          kind: 'execute',
          options: [
            { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
            { optionId: 'reject', name: 'Reject once', kind: 'reject_once' },
          ],
          status: 'pending' as const,
          createdAt: '2026-08-26T00:04:00.000Z',
          resolvedAt: null,
        }] : [],
        messages: {
          'channel:general': [
            {
              id: 'root-1',
              conversation: { kind: 'channel', id: 'general' },
              authorType: 'user',
              authorId: 'user',
              authorName: 'Ralph',
              text: rootDeleted ? '' : 'Start the investigation',
              projectIds: ['project-1'],
              projectId: 'project-1',
              createdAt: '2026-08-26T00:00:00.000Z',
              ...(rootDeleted ? { deletedAt: '2026-08-26T00:05:00.000Z' } : {}),
              ...(rootVersioned ? {
                versionRootMessageId: 'reply-1',
                supersedesMessageId: 'reply-1',
                branchId: 'branch-1',
              } : {}),
              threadId: 'thread-1',
              ...(routingPending
                ? { routing: { source: 'ai' as const, status: 'pending' as const, agentIds: [], assignments: [], reason: 'Routing with inference.' } }
                : routingResolved
                  ? {
                      routing: {
                        source: 'ai' as const,
                        status: 'resolved' as const,
                        agentIds: routingCorrected ? ['frontend', 'reviewer'] : ['frontend'],
                        assignments: [{
                          id: 'assignment-1',
                          agentId: 'frontend',
                          subRequest: 'Fix the UI boundary only.',
                          projectIds: ['project-1'],
                        }, ...(routingCorrected ? [{
                          id: 'assignment-2',
                          agentId: 'reviewer',
                          subRequest: 'Review only the UI boundary.',
                          projectIds: ['project-1'],
                        }] : [])],
                        corrections: routingCorrected ? [{
                          id: 'correction-1',
                          fromAssignmentId: 'assignment-1',
                          toAssignmentId: 'assignment-2',
                          createdAt: '2026-08-26T00:00:30.000Z',
                        }] : [],
                        inferredProjectIds: ['project-1'],
                        reason: 'Frontend owns this boundary.',
                      },
                    }
                  : {}),
            },
            {
              id: 'reply-1',
              conversation: { kind: 'channel', id: 'general' },
              authorType: 'user',
              authorId: 'user',
              authorName: 'Ralph',
              text: 'Please investigate',
              createdAt: '2026-08-26T00:01:00.000Z',
              threadId: 'thread-1',
              parentMessageId: 'root-1',
            },
            {
              id: 'reply-2',
              conversation: { kind: 'channel', id: 'general' },
              authorType: 'agent',
              authorId: 'frontend',
              authorName: 'Frontend',
              text: 'I found the failing boundary.',
              createdAt: '2026-08-26T00:02:00.000Z',
              threadId: 'thread-1',
              parentMessageId: 'root-1',
            },
            {
              id: 'reply-3',
              conversation: { kind: 'channel', id: 'general' },
              authorType: 'agent',
              authorId: 'backend',
              authorName: 'Backend',
              text: 'The API path has the same boundary.',
              createdAt: '2026-08-26T00:03:00.000Z',
              threadId: 'thread-1',
              parentMessageId: 'root-1',
            },
          ],
        },
      },
    },
    loading: false,
    sending: false,
    error: null,
    activeConversation: { kind: 'channel', id: 'general' },
    activeProjectId: null,
    activeThreadId: initialThreadId,
  } as const
  const store = {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => snapshot,
    messages: () => snapshot.bootstrap.state.messages['channel:general'],
    send,
    sendDirectReply,
    rerouteAssignment,
    updateThreadContext,
    compactThreadContext,
    addPin,
    removePin,
    editMessage,
    deleteMessage,
    respondPermission,
    mutate,
    selectThread,
  }
  render(<CommonspaceConversation store={store as never} />)
  return { mutate, selectThread, send, sendDirectReply, rerouteAssignment, updateThreadContext, compactThreadContext, addPin, removePin, editMessage, deleteMessage, respondPermission }
}

afterEach(cleanup)
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLElement.prototype.scrollTo = vi.fn()
})

describe('Commonspace reply-thread composer', () => {

  it('shows routing state while an accepted message awaits inference', () => {
    renderChannelThread('complete', false, true, true)

    expect(screen.getAllByRole('status', { name: 'Routing message' }).map(element => element.textContent)).toEqual(['Routing…', 'Routing…'])
    expect(screen.getAllByText('Start the investigation')).toHaveLength(2)
  })

  it('shows inspectable routing assignments with scoped Projects', () => {
    renderChannelThread('complete', false, true, false, true)

    expect(screen.getAllByText('Fix the UI boundary only.')).toHaveLength(2)
    expect(screen.getAllByText('@Frontend · Commonspace · inferred')).toHaveLength(2)
  })

  it('reroutes one assignment with corrected Agent, wording, and Projects', async () => {
    const { rerouteAssignment } = renderChannelThread('complete', false, true, false, true)

    fireEvent.click(screen.getAllByRole('button', { name: 'Reroute assignment for Frontend' })[0]!)
    const form = screen.getByRole('form', { name: 'Reroute assignment' })
    fireEvent.change(within(form).getByLabelText('Reroute agent'), { target: { value: 'reviewer' } })
    fireEvent.change(within(form).getByLabelText('Corrected sub-request'), { target: { value: 'Review only the UI boundary.' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(rerouteAssignment).toHaveBeenCalledWith({
        sourceMessageId: 'root-1',
        assignmentId: 'assignment-1',
        agentId: 'reviewer',
        subRequest: 'Review only the UI boundary.',
        projectIds: ['project-1'],
      })
    })
  })

  it('keeps superseded routing attempts visible and reroutes only the current attempt', () => {
    renderChannelThread('complete', false, true, false, true, true)

    expect(screen.getAllByText('Superseded')).toHaveLength(2)
    expect(screen.getAllByText('Correction')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Reroute assignment for Frontend' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Reroute assignment for Reviewer' })).toHaveLength(2)
  })

  it('inspects, edits, and compacts Thread context', async () => {
    const { updateThreadContext, compactThreadContext } = renderChannelThread()

    fireEvent.click(screen.getByRole('button', { name: 'Open thread context' }))
    const inspector = screen.getByRole('region', { name: 'Thread context' })
    expect(within(inspector).getByText('Inherited Channel summary.')).toBeTruthy()
    const form = within(inspector).getByRole('form', { name: 'Edit Thread context' })
    fireEvent.change(within(form).getByLabelText('Thread summary'), { target: { value: 'Human-focused Thread summary.' } })
    fireEvent.change(within(form).getByLabelText('Thread decisions'), { target: { value: 'Keep this focused.\nVerify before merge.' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(updateThreadContext).toHaveBeenCalledWith('thread-1', {
        summary: 'Human-focused Thread summary.',
        decisions: ['Keep this focused.', 'Verify before merge.'],
        openQuestions: ['Does the fix pass?'],
      })
    })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Compact Thread context' }))
    await waitFor(() => { expect(compactThreadContext).toHaveBeenCalledWith('thread-1') })
  })

  it('applies selected Projects to the next Thread reply and future defaults', async () => {
    const { send } = renderChannelThread()
    fireEvent.click(screen.getByRole('button', { name: 'Open thread context' }))
    const inspector = screen.getByRole('region', { name: 'Thread context' })
    const project = within(inspector).getByLabelText('Thread Project Commonspace') as HTMLInputElement
    expect(project.checked).toBe(true)
    fireEvent.click(project)
    const reply = screen.getByLabelText('Reply in thread')
    fireEvent.change(reply, { target: { value: 'Continue projectless.' } })
    fireEvent.submit(reply.closest('form')!)

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith('Continue projectless.', 'thread-1', [], undefined, [])
    })
  })

  it('adds, removes, and sources Thread pins', async () => {
    const { addPin, removePin } = renderChannelThread()
    fireEvent.click(screen.getByRole('button', { name: 'Open thread context' }))
    const inspector = screen.getByRole('region', { name: 'Thread context' })
    expect(within(inspector).getByText('Pinned Thread guidance.')).toBeTruthy()
    fireEvent.click(within(inspector).getByRole('button', { name: 'Remove pin Pinned Thread guidance.' }))
    expect(removePin).toHaveBeenCalledWith('pin-1')

    const note = within(inspector).getByLabelText('New Thread pin note')
    fireEvent.change(note, { target: { value: 'Keep this new evidence visible.' } })
    fireEvent.submit(note.closest('form')!)
    await waitFor(() => {
      expect(addPin).toHaveBeenCalledWith({
        scope: { kind: 'thread', id: 'thread-1' },
        kind: 'note',
        note: 'Keep this new evidence visible.',
      })
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Pin message from Ralph' })[0]!)
    expect(addPin).toHaveBeenCalledWith({
      scope: { kind: 'thread', id: 'thread-1' },
      kind: 'message',
      messageId: 'root-1',
    })
  })

  it('edits only human messages into a new branch with explicit Projects', async () => {
    const { editMessage } = renderChannelThread()
    expect(screen.queryByRole('button', { name: 'Edit message from Frontend' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit message from Ralph' })[0]!)
    const form = screen.getByRole('form', { name: 'Edit delivered message' })
    fireEvent.change(within(form).getByLabelText('Edited message'), { target: { value: 'Corrected investigation scope.' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(editMessage).toHaveBeenCalledWith('root-1', {
        text: 'Corrected investigation scope.',
        projectIds: ['project-1'],
      })
    })
  })

  it('confirms deletion of delivered content', async () => {
    const { deleteMessage } = renderChannelThread()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete message from Ralph' })[0]!)

    await waitFor(() => { expect(deleteMessage).toHaveBeenCalledWith('root-1') })
  })

  it('renders a visible marker for deleted delivered content', () => {
    renderChannelThread('complete', false, true, false, false, false, true)

    expect(screen.getAllByText(/Message deleted · content was delivered at/u)).toHaveLength(2)
    expect(screen.queryByText('Start the investigation')).toBeNull()
  })

  it('navigates from an edited message to its preserved previous version', () => {
    const { selectThread } = renderChannelThread('complete', false, true, false, false, false, false, true)

    expect(screen.getAllByText('Edited branch')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Open previous message version' })[0]!)
    expect(selectThread).toHaveBeenCalledWith('thread-1')
  })

  it('shows only harness-advertised permission choices without blocking the Thread', async () => {
    const { respondPermission } = renderChannelThread('complete', false, true, false, false, false, false, false, true)

    const request = screen.getByRole('region', { name: 'Permission request from Frontend' })
    expect(within(request).getByText('Run database migration')).toBeTruthy()
    expect(within(request).getAllByRole('button').map(button => button.textContent)).toEqual(['Allow once', 'Reject once'])
    expect((screen.getByRole('textbox', { name: 'Reply in thread' }) as HTMLTextAreaElement).disabled).toBe(false)
    fireEvent.click(within(request).getByRole('button', { name: 'Allow once' }))

    await waitFor(() => { expect(respondPermission).toHaveBeenCalledWith('permission-1', 'allow') })
  })

  it('opens at an equal split and lets the thread be widened by dragging', () => {
    const style = document.createElement('style')
    style.textContent = `${commonspaceStyles}\n${commonspacePolish}`
    document.head.append(style)
    renderChannelThread()

    const separator = screen.getByRole('separator', { name: 'Resize thread' })
    const layout = separator.parentElement as HTMLElement
    expect(layout.style.getPropertyValue('--csp-channel-width')).toBe('50fr')
    expect(layout.style.getPropertyValue('--csp-thread-width')).toBe('50fr')
    expect(getComputedStyle(layout).gridTemplateColumns)
      .toBe('minmax(0, var(--csp-channel-width, 50fr)) 6px minmax(0, var(--csp-thread-width, 50fr))')
    layout.getBoundingClientRect = vi.fn(() => ({
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }))

    fireEvent.pointerDown(separator, { clientX: 500, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 400, pointerId: 1 })
    fireEvent.pointerUp(window, { pointerId: 1 })

    expect(layout.style.getPropertyValue('--csp-channel-width')).toBe('40fr')
    expect(layout.style.getPropertyValue('--csp-thread-width')).toBe('60fr')
  })

  it('highlights the channel message for the thread currently in focus', () => {
    renderChannelThread()

    const root = document.getElementById('csp-message-root-1')
    expect(root?.classList.contains('csp-thread-root--focused')).toBe(true)
    expect(root?.getAttribute('aria-current')).toBe('true')
  })

  it('shows every agent who replied beside the thread reply count', () => {
    renderChannelThread()

    const threadSummary = screen.getByRole('button', { name: /3 replies/i })
    expect(threadSummary.querySelector('[aria-label="Frontend replied"]')).toBeTruthy()
    expect(threadSummary.querySelector('[aria-label="Backend replied"]')).toBeTruthy()
    expect(threadSummary.querySelectorAll('.csp-thread-agent-avatar')).toHaveLength(2)
  })

  it('shows a notification dot for unseen agent replies and marks them read when the thread opens', () => {
    const { mutate, selectThread } = renderChannelThread('complete', false, false)
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo)
    const scrollCallsBeforeOpen = scrollTo.mock.calls.length

    const threadSummary = screen.getByRole('button', { name: '3 replies, 2 unread' })
    expect(threadSummary.classList.contains('csp-thread-open--unread')).toBe(true)
    expect(within(threadSummary).getByText('2 new replies')).toBeTruthy()
    expect(threadSummary.querySelector('.csp-thread-unread-indicator')).toBeTruthy()

    fireEvent.click(threadSummary)

    expect(selectThread).toHaveBeenCalledWith('thread-1')
    expect(screen.getByRole('complementary', { name: 'Thread replies' })).toBeTruthy()
    expect(scrollTo).toHaveBeenCalledTimes(scrollCallsBeforeOpen + 1)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
    expect(mutate).toHaveBeenCalledWith({ action: 'mark-inbox-item-read', messageId: 'reply-2' })
    expect(mutate).toHaveBeenCalledWith({ action: 'mark-inbox-item-read', messageId: 'reply-3' })
    expect(mutate).not.toHaveBeenCalledWith({ action: 'mark-inbox-item-read', messageId: 'reply-1' })
  })

  it('shows only the responding agents as animated icons on an active reply thread', () => {
    renderChannelThread('running')

    const activity = screen.getAllByLabelText('Frontend is responding')
    expect(activity).toHaveLength(2)
    expect(activity.every(icon => icon.classList.contains('csp-thread-agent-avatar--responding'))).toBe(true)
    expect(screen.queryByLabelText('Backend is responding')).toBeNull()
    const liveActivity = screen.getByRole('status', { name: 'Live agent activity' })
    expect(liveActivity.textContent).toContain('Frontend')
    expect(liveActivity.textContent).toContain('Inspecting repository')
    expect(screen.queryByText('Agents are responding…')).toBeNull()
  })

  it('collapses live agent traces by default and shows one at a time when opened', () => {
    renderChannelThread('running', true)

    const frontend = screen.getByRole('button', { name: 'Frontend activity' })
    const backend = screen.getByRole('button', { name: 'Backend activity' })
    expect(frontend.getAttribute('aria-expanded')).toBe('false')
    expect(backend.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: 'Frontend live activity' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Backend live activity' })).toBeNull()

    fireEvent.click(frontend)

    expect(frontend.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('region', { name: 'Frontend live activity' }).textContent).toContain('Tracing the request through the UI.')

    fireEvent.click(backend)

    expect(frontend.getAttribute('aria-expanded')).toBe('false')
    expect(backend.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('region', { name: 'Frontend live activity' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Backend live activity' }).textContent).toContain('Checking the API lifecycle.')
  })

  it('allows the expanded live activity to close', () => {
    renderChannelThread('running')

    const frontend = screen.getByRole('button', { name: 'Frontend activity' })
    expect(frontend.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(frontend)

    expect(frontend.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(frontend)

    expect(frontend.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: 'Frontend live activity' })).toBeNull()
  })

  it('offers tag autocomplete and sends the selected tag in the active thread', async () => {
    const { send } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })

    fireEvent.change(composer, { target: { value: '@ba' } })
    const listbox = screen.getByRole('listbox', { name: 'Tag suggestions' })
    expect(composer.getAttribute('aria-controls')).toBe(listbox.id)
    expect(screen.getByRole('option', { name: /@backend/i })).toBeTruthy()

    fireEvent.keyDown(composer, { key: 'Enter' })
    expect((composer as HTMLTextAreaElement).value).toBe('@backend ')
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => { expect(send).toHaveBeenCalledWith('@backend', 'thread-1', [], undefined, ['project-1']) })
  })

  it('separates agents outside the channel and explains that tagging adds them', () => {
    renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })

    fireEvent.change(composer, { target: { value: '@' } })

    expect(screen.getByText('In this channel')).toBeTruthy()
    expect(screen.getByText('Not in this channel · tagging adds them')).toBeTruthy()
    expect(screen.getByRole('option', { name: /@reviewer.*will be added/i })).toBeTruthy()
  })

  it('replies directly to the agent selected from a channel message', async () => {
    const { send, sendDirectReply } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo)
    const scrollCallsBeforeReply = scrollTo.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Reply directly to Frontend' }))

    expect(document.activeElement).toBe(composer)
    expect(scrollTo).toHaveBeenCalledTimes(scrollCallsBeforeReply + 1)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
    expect(screen.getByText('Replying to Frontend')).toBeTruthy()
    fireEvent.change(composer, { target: { value: 'Check that boundary again.' } })
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => {
      expect(sendDirectReply).toHaveBeenCalledWith('Check that boundary again.', 'thread-1', 'frontend', [], ['project-1'])
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('scrolls the thread to the bottom when the Reply button sends a message', async () => {
    const { send } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })
    const messagesViewport = document.querySelector<HTMLElement>('.csp-thread-messages')!
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo)
    const scrollCallsBeforeReply = scrollTo.mock.calls.length
    Object.defineProperty(messagesViewport, 'scrollHeight', { configurable: true, value: 500 })
    messagesViewport.scrollTop = 0

    fireEvent.change(composer, { target: { value: 'A new thread reply.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))

    expect(messagesViewport.scrollTop).toBe(500)
    expect(scrollTo).toHaveBeenCalledTimes(scrollCallsBeforeReply + 1)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 500, behavior: 'auto' })
    await waitFor(() => { expect(send).toHaveBeenCalledWith('A new thread reply.', 'thread-1', [], undefined, ['project-1']) })
  })

  it('offers slash commands and executes them in the active thread', async () => {
    const { send } = renderChannelThread()
    const composer = screen.getByRole('textbox', { name: 'Reply in thread' })

    fireEvent.change(composer, { target: { value: '/' } })
    expect(screen.getByRole('listbox', { name: 'Slash commands' })).toBeTruthy()
    expect(screen.getByRole('option', { name: /\/retry/i })).toBeTruthy()

    fireEvent.change(composer, { target: { value: '/ret' } })
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect((composer as HTMLTextAreaElement).value).toBe('/retry')
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => { expect(send).toHaveBeenCalledWith('Please investigate', 'thread-1') })
    expect(send).not.toHaveBeenCalledWith('/retry', 'thread-1')
  })
})
