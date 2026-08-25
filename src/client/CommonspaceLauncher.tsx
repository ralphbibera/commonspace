import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  addNavigationItem,
  readNavigationState,
  removeNavigationItem,
  selectNavigationItem,
  writeNavigationState,
  type NavigationState,
  type SectionId,
} from './navigation-state.ts'

export interface CommonspaceLauncherProps {
  /** Whether the stock DSH sidebar is in its expanded state. */
  wide: boolean
}

interface SectionDefinition {
  id: SectionId
  label: string
  singular: string
  inputLabel: string
  empty: string
}

const sections: readonly SectionDefinition[] = [
  { id: 'projects', label: 'Projects', singular: 'project', inputLabel: 'Project name', empty: 'No projects yet' },
  { id: 'channels', label: 'Channels', singular: 'channel', inputLabel: 'Channel name', empty: 'No channels yet' },
  {
    id: 'direct-messages',
    label: 'Direct Messages',
    singular: 'direct message',
    inputLabel: 'Direct message name',
    empty: 'No messages yet',
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

function itemDisplay(section: SectionId, value: string): string {
  return section === 'channels' ? `#${value}` : value
}

function itemAria(section: SectionDefinition, value: string): string {
  return `Select ${section.singular} ${itemDisplay(section.id, value)}`
}

/**
 * Additive Commonspace launcher for the stock DSH sidebar footer.
 * Navigation and item-management controls are embedded in the footer stack and
 * grow upward into available sidebar space; nothing floats over the application.
 */
export function CommonspaceLauncher({ wide }: CommonspaceLauncherProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<SectionId>>(() => new Set())
  const [navigation, setNavigation] = useState<NavigationState>(() => readNavigationState())
  const [composer, setComposer] = useState<SectionId | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    writeNavigationState(navigation)
  }, [navigation])

  useEffect(() => {
    if (wide) return
    setOpen(false)
    setComposer(null)
    setDraft('')
  }, [wide])

  useEffect(() => {
    if (composer !== null) inputRef.current?.focus()
  }, [composer])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (composer !== null) {
        setComposer(null)
        setDraft('')
        return
      }
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [composer, open])

  const toggleSection = (id: SectionId): void => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startComposer = (id: SectionId): void => {
    setExpanded(current => new Set(current).add(id))
    setComposer(id)
    setDraft('')
  }

  const submitComposer = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (composer === null) return
    const next = addNavigationItem(navigation, composer, draft)
    if (next === navigation) return
    setNavigation(next)
    setComposer(null)
    setDraft('')
  }

  const embeddedNavigation = open && wide
    ? (
      <nav id="commonspace-navigation" className="csp-inline" aria-label="Commonspace navigation">
        <div className="csp-sections">
          {sections.map(section => {
            const sectionOpen = expanded.has(section.id)
            const regionId = `commonspace-${section.id}`
            const items = navigation.items[section.id]
            return (
              <div key={section.id} className="csp-section">
                <div className="csp-section-row">
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
                    <span className="csp-section-count" aria-hidden="true">{items.length}</span>
                  </button>
                  <button
                    type="button"
                    className="csp-add-button"
                    aria-label={`Add ${section.singular}`}
                    title={`Add ${section.singular}`}
                    onClick={() => { startComposer(section.id) }}
                  >
                    <span aria-hidden="true">+</span>
                  </button>
                </div>
                {sectionOpen && (
                  <div id={regionId} className="csp-section-content">
                    {items.length === 0 && composer !== section.id && (
                      <div className="csp-empty">{section.empty}</div>
                    )}
                    {items.map(item => {
                      const selected = navigation.selected?.section === section.id
                        && navigation.selected.value === item
                      return (
                        <div key={item} className="csp-item-row">
                          <button
                            type="button"
                            className="csp-item-button"
                            aria-label={itemAria(section, item)}
                            aria-pressed={selected}
                            onClick={() => {
                              setNavigation(current => selectNavigationItem(current, section.id, item))
                            }}
                          >
                            {section.id === 'channels' && <span className="csp-item-prefix" aria-hidden="true">#</span>}
                            <span>{item}</span>
                          </button>
                          <button
                            type="button"
                            className="csp-remove-button"
                            aria-label={`Remove ${section.singular} ${itemDisplay(section.id, item)}`}
                            title={`Remove ${itemDisplay(section.id, item)}`}
                            onClick={() => {
                              setNavigation(current => removeNavigationItem(current, section.id, item))
                            }}
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </div>
                      )
                    })}
                    {composer === section.id && (
                      <form className="csp-composer" onSubmit={submitComposer}>
                        {section.id === 'channels' && <span className="csp-composer-prefix" aria-hidden="true">#</span>}
                        <input
                          ref={inputRef}
                          className="csp-composer-input"
                          aria-label={section.inputLabel}
                          placeholder={section.inputLabel}
                          value={draft}
                          maxLength={64}
                          onChange={event => { setDraft(event.currentTarget.value) }}
                        />
                        <button
                          type="submit"
                          className="csp-composer-action"
                          aria-label={`Create ${section.singular}`}
                          title={`Create ${section.singular}`}
                        >
                          <span aria-hidden="true">✓</span>
                        </button>
                        <button
                          type="button"
                          className="csp-composer-action"
                          aria-label={`Cancel ${section.singular}`}
                          title="Cancel"
                          onClick={() => {
                            setComposer(null)
                            setDraft('')
                          }}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>
      )
    : null

  return (
    <div className="csp-launcher">
      {embeddedNavigation}
      <button
        ref={triggerRef}
        type="button"
        className={`csp-trigger${wide ? '' : ' csp-trigger--rail'}`}
        aria-label={open ? 'Close Commonspace' : 'Open Commonspace'}
        aria-controls="commonspace-navigation"
        aria-expanded={open && wide}
        disabled={!wide}
        title={wide ? undefined : 'Expand the sidebar to use Commonspace'}
        onClick={() => { if (wide) setOpen(current => !current) }}
      >
        <CommonspaceMark />
        {wide && (
          <>
            <span className="csp-trigger-label">Commonspace</span>
            <Chevron open={open} className="csp-trigger-chevron" />
          </>
        )}
      </button>
    </div>
  )
}
