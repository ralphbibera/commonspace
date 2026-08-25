// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonspaceLauncher } from '../src/client/CommonspaceLauncher.tsx'
import { apply, inject } from '../src/client/index.ts'


afterEach(cleanup)

describe('Commonspace launcher', () => {
  it('opens a panel with the three requested collapsible groups', () => {
    render(<CommonspaceLauncher wide />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Commonspace' }))

    expect(screen.getByRole('dialog', { name: 'Commonspace navigation' })).toBeTruthy()
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
    expect(screen.queryByRole('dialog', { name: 'Commonspace navigation' })).toBeNull()
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

    expect(inject).toEqual(['slots'])
    apply(ctx as never)

    expect(injectSlot).toHaveBeenCalledWith('sidebar.footer.action', expect.any(Function))
    expect(register).toHaveBeenCalledWith(
      { name: 'sidebar.footer.action', id: 'commonspace', order: -20 },
      CommonspaceLauncher,
    )

    disposeEffect?.()
    expect(disposeInjection).toHaveBeenCalledOnce()
    expect(document.querySelector('style[data-commonspace="navigation"]')).toBeNull()
  })
})
