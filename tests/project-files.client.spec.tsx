// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { COMMONSPACE_STATE_VERSION } from '@commonspace/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceProjectView } from '../ui/src/CommonspaceProjectView.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function projectStore() {
  const snapshot = {
    bootstrap: {
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
        projects: [{ id: 'viewer', name: 'Viewer', paths: ['/work/viewer'], createdAt: '' }],
        channels: [],
        threads: [],
        messages: {},
      },
    },
    loading: false,
    sending: false,
    error: null,
    activeConversation: null,
    activeProjectId: 'viewer',
    activeThreadId: null,
  }
  return {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  }
}

function responseJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

describe('project Files and Changes views', () => {
  it('renders text, image, and video project files', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://commonspace.test')
      if (url.pathname.endsWith('/files')) {
        return responseJson({
          projectId: 'viewer',
          rootIndex: 0,
          path: '',
          truncated: false,
          entries: [
            { name: 'src', path: 'src', kind: 'directory' },
            { name: 'README.md', path: 'README.md', kind: 'file', size: 13, preview: 'text', contentType: 'text/markdown; charset=utf-8' },
            { name: 'cover.png', path: 'cover.png', kind: 'file', size: 4, preview: 'image', contentType: 'image/png' },
            { name: 'demo.mp4', path: 'demo.mp4', kind: 'file', size: 8, preview: 'video', contentType: 'video/mp4' },
          ],
        })
      }
      if (url.pathname.endsWith('/file') && url.searchParams.get('path') === 'README.md') {
        return new Response('# Viewer\nHello\n', { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
      }
      throw new Error(`unexpected request ${url.toString()}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<CommonspaceProjectView
      projectId="viewer"
      store={projectStore() as never}
      onBack={() => undefined}
      onOpenConversation={() => undefined}
    />)

    expect(screen.getByRole('tab', { name: 'Files' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(await screen.findByRole('button', { name: 'Open file README.md' }))
    expect(await screen.findByText(/^# Viewer/u)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open file cover.png' }))
    const image = await screen.findByRole('img', { name: 'Preview cover.png' })
    expect(image.getAttribute('src')).toContain('/api/projects/viewer/file?')
    expect(image.getAttribute('src')).toContain('path=cover.png')

    fireEvent.click(screen.getByRole('button', { name: 'Open file demo.mp4' }))
    const video = await screen.findByLabelText('Preview demo.mp4')
    expect(video.tagName).toBe('VIDEO')
    expect(video.getAttribute('src')).toContain('path=demo.mp4')
  })

  it('shows Git change counts and a unified diff', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://commonspace.test')
      if (url.pathname.endsWith('/files')) {
        return responseJson({ projectId: 'viewer', rootIndex: 0, path: '', truncated: false, entries: [] })
      }
      if (url.pathname.endsWith('/changes')) {
        return responseJson({
          available: true,
          branch: 'main',
          head: 'abc1234',
          clean: false,
          truncated: false,
          files: [{
            path: 'README.md',
            status: 'modified',
            indexStatus: ' ',
            worktreeStatus: 'M',
            additions: 1,
            deletions: 1,
            preview: 'text',
          }],
        })
      }
      if (url.pathname.endsWith('/diff')) {
        return responseJson({
          path: 'README.md',
          binary: false,
          truncated: false,
          patch: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-before\n+after\n',
        })
      }
      throw new Error(`unexpected request ${url.toString()}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<CommonspaceProjectView
      projectId="viewer"
      store={projectStore() as never}
      onBack={() => undefined}
      onOpenConversation={() => undefined}
    />)

    fireEvent.click(screen.getByRole('tab', { name: 'Changes' }))
    expect(await screen.findByText('main')).toBeTruthy()
    expect(screen.getByText('+1')).toBeTruthy()
    expect(screen.getByText('−1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open change README.md' }))
    await waitFor(() => {
      expect(screen.getByText('-before')).toBeTruthy()
      expect(screen.getByText('+after')).toBeTruthy()
    })
  })
})
