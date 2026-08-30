import { useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  COMMONSPACE_SEARCH_KINDS,
  type CommonspaceProject,
  type CommonspaceSearchHighlight,
  type CommonspaceSearchKind,
  type CommonspaceSearchResponse,
  type CommonspaceSearchResult,
} from '@commonspace/shared'

export interface CommonspaceSearchDialogProps {
  projects: readonly CommonspaceProject[]
  onClose: () => void
  onSelect: (result: CommonspaceSearchResult) => void
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useSearchModal(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const restoreFocus = useRef<HTMLElement | null>(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  useLayoutEffect(() => { closeRef.current = onClose }, [onClose])
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const backdrop = backdropRef.current
    if (dialog === null || backdrop === null) return
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialog && element !== backdrop)
      .map(element => ({ element, inert: element.inert, hadInert: element.hasAttribute('inert') }))
    for (const { element } of background) { element.inert = true; element.setAttribute('inert', '') }
    ;(dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog).focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => !element.hidden)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) { event.preventDefault(); dialog.focus(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    dialog.addEventListener('keydown', handleKeyDown)
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown)
      for (const item of background) {
        item.element.inert = item.inert
        if (item.hadInert) item.element.setAttribute('inert', '')
        else item.element.removeAttribute('inert')
      }
      if (restoreFocus.current?.isConnected === true) restoreFocus.current.focus()
    }
  }, [])
  return { backdropRef, dialogRef }
}

function searchUrl(query: string, kinds: readonly CommonspaceSearchKind[], projectId: string): string {
  const params = new URLSearchParams({ q: query, limit: '24' })
  if (kinds.length > 0) params.set('types', kinds.join(','))
  if (projectId !== '') params.set('project', projectId)
  return `/api/search?${params.toString()}`
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string' && body.error !== '') return body.error
  } catch {
    // Keep stable fallback below.
  }
  return `Search failed (${String(response.status)})`
}

function HighlightedText({ text, field, highlights }: {
  text: string
  field: CommonspaceSearchHighlight['field']
  highlights: readonly CommonspaceSearchHighlight[]
}) {
  const ranges = highlights
    .filter(range => range.field === field && range.start >= 0 && range.end > range.start && range.end <= text.length)
    .sort((left, right) => left.start - right.start)
  if (ranges.length === 0) return <>{text}</>
  const parts: Array<{ text: string; highlighted: boolean }> = []
  let offset = 0
  for (const range of ranges) {
    if (range.start < offset) continue
    if (range.start > offset) parts.push({ text: text.slice(offset, range.start), highlighted: false })
    parts.push({ text: text.slice(range.start, range.end), highlighted: true })
    offset = range.end
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), highlighted: false })
  return <>{parts.map((part, index) => part.highlighted ? <mark key={index}>{part.text}</mark> : part.text)}</>
}

function kindLabel(kind: CommonspaceSearchKind): string {
  if (kind === 'dm') return 'DM'
  return `${kind.slice(0, 1).toLocaleUpperCase()}${kind.slice(1)}`
}

function resultGlyph(kind: CommonspaceSearchKind): string {
  if (kind === 'channel') return '#'
  if (kind === 'agent') return '@'
  if (kind === 'file') return '⌁'
  if (kind === 'decision') return '✓'
  if (kind === 'trace') return '⋯'
  if (kind === 'run') return '▶'
  if (kind === 'brief') return '≡'
  return '↳'
}

export function CommonspaceSearchDialog({ projects, onClose, onSelect }: CommonspaceSearchDialogProps) {
  const titleId = useId()
  const resultsId = useId()
  const [query, setQuery] = useState('')
  const [selectedKinds, setSelectedKinds] = useState<CommonspaceSearchKind[]>([])
  const [projectId, setProjectId] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [response, setResponse] = useState<CommonspaceSearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)
  const deferredKinds = useDeferredValue(selectedKinds)
  const deferredProjectId = useDeferredValue(projectId)
  const requestUrl = useMemo(() => searchUrl(deferredQuery, deferredKinds, deferredProjectId), [deferredKinds, deferredProjectId, deferredQuery])
  const pending = deferredQuery !== query || deferredKinds !== selectedKinds || deferredProjectId !== projectId || response?.query !== deferredQuery
  const results = response?.results ?? []
  const boundedActiveIndex = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1)
  const activeResult = results[boundedActiveIndex]
  const { backdropRef, dialogRef } = useSearchModal(onClose)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    void fetch(requestUrl, { headers: { accept: 'application/json' }, signal: controller.signal }).then(async result => {
      if (!result.ok) throw new Error(await responseError(result))
      return result.json() as Promise<CommonspaceSearchResponse>
    }).then(setResponse).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    })
    return () => { controller.abort() }
  }, [requestUrl])

  if (typeof document === 'undefined') return null

  const moveSelection = (offset: number) => {
    if (results.length === 0) return
    setActiveIndex(current => (Math.min(current, results.length - 1) + offset + results.length) % results.length)
  }
  const toggleKind = (kind: CommonspaceSearchKind) => {
    setSelectedKinds(current => current.includes(kind) ? current.filter(item => item !== kind) : [...current, kind])
    setActiveIndex(0)
  }

  return createPortal(
    <>
      <div ref={backdropRef} className="csp-dialog-backdrop csp-search-backdrop" aria-hidden="true" onMouseDown={onClose} />
      <section ref={dialogRef} className="csp-dialog csp-search-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="csp-search-header">
          <h2 id={titleId} className="csp-visually-hidden">Search everything</h2>
          <span className="csp-search-icon" aria-hidden="true" />
          <input
            autoFocus
            type="search"
            aria-label="Search Commonspace"
            aria-controls={resultsId}
            aria-activedescendant={activeResult === undefined ? undefined : `${resultsId}-${String(boundedActiveIndex)}`}
            placeholder="Search messages, files, runs, traces…"
            value={query}
            onChange={event => { setQuery(event.target.value); setActiveIndex(0) }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') { event.preventDefault(); moveSelection(1) }
              else if (event.key === 'ArrowUp') { event.preventDefault(); moveSelection(-1) }
              else if (event.key === 'Enter' && activeResult !== undefined) { event.preventDefault(); onSelect(activeResult) }
            }}
          />
          <kbd aria-hidden="true">ESC</kbd>
        </header>
        <div className="csp-search-filters" aria-label="Search filters">
          <select aria-label="Filter search by project" value={projectId} onChange={event => { setProjectId(event.target.value); setActiveIndex(0) }}>
            <option value="">All projects</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <div className="csp-search-kind-filters">
            {COMMONSPACE_SEARCH_KINDS.map(kind => (
              <button key={kind} type="button" aria-pressed={selectedKinds.includes(kind)} onClick={() => { toggleKind(kind) }}>{kindLabel(kind)}</button>
            ))}
          </div>
        </div>
        <div className="csp-search-result-head">
          <span>{query.trim() === '' ? 'Browse' : 'Results'}</span>
          <span>{pending ? 'Searching…' : response?.truncated === true ? `${String(results.length)}+` : results.length}</span>
        </div>
        <div id={resultsId} className="csp-search-results" role="listbox" aria-label="Commonspace search results" aria-busy={pending}>
          {error !== null && <div className="csp-search-empty" role="alert">{error}</div>}
          {error === null && !pending && results.length === 0 && <div className="csp-search-empty">No results for “{query.trim()}”.</div>}
          {results.map((result, index) => (
            <button
              id={`${resultsId}-${String(index)}`}
              key={result.id}
              type="button"
              role="option"
              aria-label={`Open ${kindLabel(result.kind)}: ${result.title}`}
              aria-selected={index === boundedActiveIndex}
              className="csp-search-result"
              onMouseEnter={() => { setActiveIndex(index) }}
              onClick={() => { onSelect(result) }}
            >
              <span className="csp-search-result-glyph" aria-hidden="true">{resultGlyph(result.kind)}</span>
              <span className="csp-search-result-main">
                <strong><HighlightedText text={result.title} field="title" highlights={result.highlights} /></strong>
                <small><HighlightedText text={result.detail} field="detail" highlights={result.highlights} /></small>
                <small className="csp-search-result-receipt">{result.receipt}</small>
              </span>
              <span className="csp-search-result-meta">{kindLabel(result.kind)}</span>
            </button>
          ))}
        </div>
        <footer className="csp-search-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>esc</kbd> Close</span>
        </footer>
      </section>
    </>,
    document.body,
  )
}
