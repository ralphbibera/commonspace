import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface CommonspaceLauncherProps {
  /** Whether the stock DSH sidebar is in its expanded state. */
  wide: boolean
}

type SectionId = 'projects' | 'channels' | 'direct-messages'

interface PanelPosition {
  left: number
  top: number
}

const PANEL_WIDTH = 280
const VIEWPORT_GUTTER = 8
const PANEL_GAP = 8

const sections: readonly {
  id: SectionId
  label: string
  count: number
  content: React.ReactNode
}[] = [
  {
    id: 'projects',
    label: 'Projects',
    count: 0,
    content: 'No projects yet',
  },
  {
    id: 'channels',
    label: 'Channels',
    count: 1,
    content: (
      <span className="csp-channel-preview">
        <span className="csp-channel-hash" aria-hidden="true">#</span>
        general
      </span>
    ),
  },
  {
    id: 'direct-messages',
    label: 'Direct Messages',
    count: 0,
    content: 'No messages yet',
  },
]

/** Compact Commonspace mark: four rooms meeting around one shared center. */
function CommonspaceMark() {
  return (
    <span className="csp-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}

/** Small dependency-free chevron so the dynamic plugin imports only baseline React modules. */
function Chevron({ open, className }: { open: boolean; className: string }) {
  return (
    <svg
      className={`${className}${open ? ` ${className}--open` : ''}`}
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <path d="M3.25 5.25 7 9l3.75-3.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Additive Commonspace launcher for the stock DSH sidebar footer.
 * The portal keeps the panel out of the sidebar's clipping and scrollbar layers.
 */
export function CommonspaceLauncher({ wide }: CommonspaceLauncherProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<SectionId>>(() => new Set())
  const [position, setPosition] = useState<PanelPosition>({ left: VIEWPORT_GUTTER, top: VIEWPORT_GUTTER })

  const placePanel = (): void => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (trigger === null || panel === null) return

    const anchor = trigger.getBoundingClientRect()
    const panelBox = panel.getBoundingClientRect()
    const maxLeft = Math.max(VIEWPORT_GUTTER, window.innerWidth - PANEL_WIDTH - VIEWPORT_GUTTER)
    const left = Math.min(Math.max(VIEWPORT_GUTTER, anchor.left), maxLeft)
    const roomAbove = anchor.top - PANEL_GAP - VIEWPORT_GUTTER
    const top = roomAbove >= panelBox.height
      ? anchor.top - panelBox.height - PANEL_GAP
      : Math.min(anchor.bottom + PANEL_GAP, window.innerHeight - panelBox.height - VIEWPORT_GUTTER)

    setPosition({ left, top: Math.max(VIEWPORT_GUTTER, top) })
  }

  useLayoutEffect(() => {
    if (!open) return
    placePanel()
  }, [open, expanded])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target === null) return
      if (triggerRef.current?.contains(target) === true) return
      if (panelRef.current?.contains(target) === true) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    const onViewportChange = (): void => { placePanel() }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open])

  const toggleSection = (id: SectionId): void => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="csp-panel"
          role="dialog"
          aria-label="Commonspace navigation"
          style={{ left: position.left, top: position.top }}
        >
          <div className="csp-panel-header">
            <CommonspaceMark />
            <span>Commonspace</span>
          </div>
          <div className="csp-sections">
            {sections.map(section => {
              const sectionOpen = expanded.has(section.id)
              const regionId = `commonspace-${section.id}`
              return (
                <div key={section.id}>
                  <button
                    type="button"
                    className="csp-section-button"
                    aria-label={section.label}
                    aria-expanded={sectionOpen}
                    aria-controls={regionId}
                    onClick={() => { toggleSection(section.id) }}
                  >
                    <Chevron open={sectionOpen} className="csp-section-chevron" />
                    <span className="csp-section-label">{section.label}</span>
                    <span className="csp-section-count" aria-label={`${section.count} items`}>{section.count}</span>
                  </button>
                  {sectionOpen && (
                    <div id={regionId} className="csp-section-content">
                      {section.content}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="csp-launcher">
      <button
        ref={triggerRef}
        type="button"
        className={`csp-trigger${wide ? '' : ' csp-trigger--rail'}`}
        aria-label={open ? 'Close Commonspace' : 'Open Commonspace'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={wide ? undefined : 'Commonspace'}
        onClick={() => { setOpen(current => !current) }}
      >
        <CommonspaceMark />
        {wide && (
          <>
            <span className="csp-trigger-label">Commonspace</span>
            <Chevron open={open} className="csp-trigger-chevron" />
          </>
        )}
      </button>
      {panel}
    </div>
  )
}
