import { useEffect, useRef, useState } from 'react'

export interface CommonspaceLauncherProps {
  /** Whether the stock DSH sidebar is in its expanded state. */
  wide: boolean
}

type SectionId = 'projects' | 'channels' | 'direct-messages'

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
 * The navigation is embedded in the footer stack and grows upward into the
 * sidebar's available space; it never portals or floats over the application.
 */
export function CommonspaceLauncher({ wide }: CommonspaceLauncherProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<SectionId>>(() => new Set())
  const navigationOpen = open && wide

  useEffect(() => {
    if (!wide) setOpen(false)
  }, [wide])

  useEffect(() => {
    if (!navigationOpen) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [navigationOpen])

  const toggleSection = (id: SectionId): void => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="csp-launcher">
      {navigationOpen && (
        <nav id="commonspace-navigation" className="csp-inline" aria-label="Commonspace navigation">
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
                    <span className="csp-section-count" aria-hidden="true">{section.count}</span>
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
        </nav>
      )}

      <button
        ref={triggerRef}
        type="button"
        className={`csp-trigger${wide ? '' : ' csp-trigger--rail'}`}
        aria-label={navigationOpen ? 'Close Commonspace' : 'Open Commonspace'}
        aria-controls="commonspace-navigation"
        aria-expanded={navigationOpen}
        disabled={!wide}
        title={wide ? undefined : 'Expand the sidebar to open Commonspace'}
        onClick={() => { setOpen(current => !current) }}
      >
        <CommonspaceMark />
        {wide && (
          <>
            <span className="csp-trigger-label">Commonspace</span>
            <Chevron open={navigationOpen} className="csp-trigger-chevron" />
          </>
        )}
      </button>
    </div>
  )
}
