import { useEffect, useMemo, useState } from 'react'
import type { ProjectDirectoryResponse, ProjectFileEntry } from '@commonspace/shared'
import { fetchProjectJson, fetchProjectText, folderName, formatFileSize, projectApiUrl } from './project-files-api.ts'

export interface CommonspaceProjectFilesProps {
  projectId: string
  roots: readonly string[]
}

function entryGlyph(entry: ProjectFileEntry): string {
  if (entry.kind === 'directory') return '›'
  if (entry.preview === 'image') return 'IMG'
  if (entry.preview === 'video') return 'VID'
  if (entry.preview === 'text') return 'TXT'
  return 'BIN'
}

export function CommonspaceProjectFiles({ projectId, roots }: CommonspaceProjectFilesProps) {
  const [rootIndex, setRootIndex] = useState(0)
  const [directoryPath, setDirectoryPath] = useState('')
  const [listing, setListing] = useState<ProjectDirectoryResponse | null>(null)
  const [selected, setSelected] = useState<ProjectFileEntry | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [listingError, setListingError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setListing(null)
    setListingError(null)
    setSelected(null)
    setText(null)
    void fetchProjectJson<ProjectDirectoryResponse>(
      projectApiUrl(projectId, 'files', rootIndex, directoryPath),
      controller.signal,
    ).then(setListing).catch((error: unknown) => {
      if (!controller.signal.aborted) setListingError(error instanceof Error ? error.message : String(error))
    })
    return () => { controller.abort() }
  }, [directoryPath, projectId, rootIndex])

  useEffect(() => {
    setText(null)
    setPreviewError(null)
    if (selected?.kind !== 'file' || selected.preview !== 'text') return
    const controller = new AbortController()
    void fetchProjectText(
      projectApiUrl(projectId, 'file', rootIndex, selected.path),
      controller.signal,
    ).then(setText).catch((error: unknown) => {
      if (!controller.signal.aborted) setPreviewError(error instanceof Error ? error.message : String(error))
    })
    return () => { controller.abort() }
  }, [projectId, rootIndex, selected])

  const breadcrumbs = useMemo(() => {
    const segments = directoryPath === '' ? [] : directoryPath.split('/')
    return segments.map((name, index) => ({ name, path: segments.slice(0, index + 1).join('/') }))
  }, [directoryPath])

  if (roots.length === 0) {
    return <div className="csp-project-workbench-empty"><strong>No project folder</strong><p>Add a local folder to browse files.</p></div>
  }

  const mediaUrl = selected?.kind === 'file'
    ? projectApiUrl(projectId, 'file', rootIndex, selected.path)
    : null

  return (
    <section className="csp-project-workbench" aria-label="Project files">
      <aside className="csp-project-file-rail">
        <header className="csp-project-pane-header">
          <div><strong>Files</strong><small>Read-only project browser</small></div>
          <select
            aria-label="Project folder"
            value={rootIndex}
            onChange={event => {
              setRootIndex(Number(event.target.value))
              setDirectoryPath('')
            }}
          >
            {roots.map((root, index) => (
              <option key={root} value={index}>{index === 0 ? 'Working' : 'Reference'} · {folderName(root)}</option>
            ))}
          </select>
        </header>

        <nav className="csp-project-breadcrumbs" aria-label="File path">
          <button type="button" aria-current={directoryPath === '' ? 'page' : undefined} onClick={() => { setDirectoryPath('') }}>
            {folderName(roots[rootIndex] ?? '')}
          </button>
          {breadcrumbs.map(crumb => (
            <span key={crumb.path}>
              <i aria-hidden="true">/</i>
              <button type="button" aria-current={crumb.path === directoryPath ? 'page' : undefined} onClick={() => { setDirectoryPath(crumb.path) }}>{crumb.name}</button>
            </span>
          ))}
        </nav>

        <div className="csp-project-file-list" aria-live="polite">
          {listing === null && listingError === null && <div className="csp-project-pane-state">Reading folder…</div>}
          {listingError !== null && <div className="csp-project-pane-state csp-project-pane-state--error">{listingError}</div>}
          {listing?.entries.map(entry => (
            <button
              key={entry.path}
              type="button"
              className="csp-project-file-row"
              aria-label={`${entry.kind === 'directory' ? 'Open folder' : 'Open file'} ${entry.name}`}
              aria-pressed={entry.kind === 'file' && selected?.path === entry.path}
              onClick={() => {
                if (entry.kind === 'directory') {
                  setDirectoryPath(entry.path)
                  return
                }
                setSelected(entry)
              }}
            >
              <span className={`csp-project-file-glyph csp-project-file-glyph--${entry.kind}`} aria-hidden="true">{entryGlyph(entry)}</span>
              <span className="csp-project-file-name">{entry.name}</span>
              <small>{entry.kind === 'directory' ? 'Folder' : formatFileSize(entry.size)}</small>
            </button>
          ))}
          {listing?.entries.length === 0 && <div className="csp-project-pane-state">Folder is empty.</div>}
          {listing?.truncated === true && <div className="csp-project-limit-note">Showing first 500 entries.</div>}
        </div>
      </aside>

      <div className="csp-project-preview-pane">
        {selected === null
          ? <div className="csp-project-preview-empty"><span aria-hidden="true">⌁</span><strong>Select a file</strong><p>Text, images, and videos render here.</p></div>
          : <>
              <header className="csp-project-pane-header csp-project-preview-header">
                <div><strong>{selected.name}</strong><small>{selected.path} · {formatFileSize(selected.size)}</small></div>
                <span>{selected.preview ?? 'binary'}</span>
              </header>
              <div className="csp-project-preview-body">
                {previewError !== null && <div className="csp-project-pane-state csp-project-pane-state--error">{previewError}</div>}
                {previewError === null && selected.preview === 'text' && text === null && <div className="csp-project-pane-state">Reading file…</div>}
                {previewError === null && selected.preview === 'text' && text !== null && <pre className="csp-project-text-preview"><code>{text}</code></pre>}
                {previewError === null && selected.preview === 'image' && mediaUrl !== null && <img src={mediaUrl} alt={`Preview ${selected.name}`} />}
                {previewError === null && selected.preview === 'video' && mediaUrl !== null && <video src={mediaUrl} aria-label={`Preview ${selected.name}`} controls playsInline preload="metadata" />}
                {previewError === null && selected.preview === 'binary' && <div className="csp-project-preview-empty"><strong>Preview unavailable</strong><p>Commonspace renders text, raster images, and videos only.</p></div>}
              </div>
            </>}
      </div>
    </section>
  )
}
