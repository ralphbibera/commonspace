// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceConversation } from '../src/client/CommonspaceConversation.tsx'
import { CommonspaceModeController } from '../src/client/commonspace-mode.ts'
import { CommonspaceModeSwitch } from '../src/client/CommonspaceModeSwitch.tsx'
import { CommonspaceSidebar } from '../src/client/CommonspaceSidebar.tsx'
import { apply, inject } from '../src/client/index.ts'

afterEach(cleanup)

describe('Commonspace workspace mode', () => {
  it('switches between Commonspace and native Workspaces labels', () => {
    const mode = new CommonspaceModeController()
    render(<CommonspaceModeSwitch wide mode={mode} />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Commonspace' }))
    expect(mode.getSnapshot()).toBe('commonspace')
    expect(screen.getByRole('button', { name: 'Switch to Workspaces' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Workspaces' }))
    expect(mode.getSnapshot()).toBe('workspaces')
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
