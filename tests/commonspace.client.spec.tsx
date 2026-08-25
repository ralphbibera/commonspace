// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceLauncher } from '../src/client/CommonspaceLauncher.tsx'
import { apply, inject } from '../src/client/index.ts'


afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Commonspace launcher', () => {
  it('embeds the three requested collapsible groups inside the sidebar action', () => {
    render(<CommonspaceLauncher wide />)

    const trigger = screen.getByRole('button', { name: 'Open Commonspace' })
    fireEvent.click(trigger)

    const navigation = screen.getByRole('navigation', { name: 'Commonspace navigation' })
    expect(trigger.closest('.csp-launcher')?.contains(navigation)).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Projects' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Channels' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'Direct Messages' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('expands sections and closes with Escape', () => {
    render(<CommonspaceLauncher wide />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }))

    expect(screen.getByText('No projects yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Projects' }).getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('navigation', { name: 'Commonspace navigation' })).toBeNull()
  })

  it('closes the embedded navigation when the stock sidebar collapses', () => {
    const view = render(<CommonspaceLauncher wide />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))
    expect(screen.getByRole('navigation', { name: 'Commonspace navigation' })).toBeTruthy()

    view.rerender(<CommonspaceLauncher wide={false} />)
    expect(screen.queryByRole('navigation', { name: 'Commonspace navigation' })).toBeNull()
  })

  it('adds projects, channels, and direct messages inline', () => {
    render(<CommonspaceLauncher wide />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), { target: { value: 'Apollo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
    expect(screen.getByRole('button', { name: 'Select project Apollo' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add channel' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Channel name' }), { target: { value: 'Design Team' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create channel' }))
    expect(screen.getByRole('button', { name: 'Select channel #design-team' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add direct message' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Direct message name' }), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create direct message' }))
    expect(screen.getByRole('button', { name: 'Select direct message Ada' })).toBeTruthy()
  })

  it('normalizes and de-duplicates channel names', () => {
    render(<CommonspaceLauncher wide />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))

    for (const value of ['  Design Team  ', '#design---team']) {
      fireEvent.click(screen.getByRole('button', { name: 'Add channel' }))
      fireEvent.change(screen.getByRole('textbox', { name: 'Channel name' }), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: 'Create channel' }))
    }

    expect(screen.getAllByRole('button', { name: 'Select channel #design-team' })).toHaveLength(1)
  })

  it('persists selection and supports removal', () => {
    const first = render(<CommonspaceLauncher wide />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), { target: { value: 'Apollo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select project Apollo' }))
    expect(screen.getByRole('button', { name: 'Select project Apollo' }).getAttribute('aria-pressed')).toBe('true')

    first.unmount()
    render(<CommonspaceLauncher wide />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }))
    expect(screen.getByRole('button', { name: 'Select project Apollo' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Remove project Apollo' }))
    expect(screen.queryByRole('button', { name: 'Select project Apollo' })).toBeNull()
    expect(screen.getByText('No projects yet')).toBeTruthy()
  })

  it('binds a project to a Harness workspace and reopens the mapped channel session', async () => {
    const activate = vi.fn(async () => ({ sessionId: 'session-1', workspaceId: 'workspace-1' }))
    const runtime = {
      listWorkspaces: () => [{
        workspaceId: 'workspace-1',
        title: 'Developer',
        path: '/workspace/apollo',
        recent: true,
      }],
      activate,
    }
    const first = render(<CommonspaceLauncher wide runtime={runtime} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    expect(screen.getByRole('combobox', { name: 'Project workspace' })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), { target: { value: 'Apollo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add channel' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Channel name' }), { target: { value: 'Delivery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create channel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select channel #delivery' }))

    await waitFor(() => {
      expect(activate).toHaveBeenCalledWith({
        kind: 'channel',
        label: 'delivery',
        project: { label: 'Apollo', workspaceId: 'workspace-1' },
      })
    })

    first.unmount()
    activate.mockClear()
    render(<CommonspaceLauncher wide runtime={runtime} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Channels' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select channel #delivery' }))

    await waitFor(() => {
      expect(activate).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session-1' }))
    })
  })

  it('registers additively in the stock sidebar footer and withdraws on dispose', () => {
    const disposeRegistration = vi.fn()
    const disposeInjection = vi.fn()
    const register = vi.fn(() => disposeRegistration)
    const injectSlot = vi.fn((_name: string, mount: () => () => void) => {
      mount()
      return disposeInjection
    })
    let disposeEffect: (() => void) | undefined
    const ctx = {
      slots: { inject: injectSlot, register },
      effect: (mount: () => () => void) => { disposeEffect = mount() },
    }

    expect(inject).toEqual(['slots', 'connection', 'sessions', 'workspaces'])
    apply(ctx as never)

    expect(injectSlot).toHaveBeenCalledWith('sidebar.footer.action', expect.any(Function))
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'sidebar.footer.action',
        id: 'commonspace',
        order: -20,
        inject: expect.any(Function),
      }),
      CommonspaceLauncher,
    )

    disposeEffect?.()
    expect(disposeInjection).toHaveBeenCalledOnce()
    expect(document.querySelector('style[data-commonspace="navigation"]')).toBeNull()
  })
})
