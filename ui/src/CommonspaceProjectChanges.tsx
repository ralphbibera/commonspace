import { useEffect, useState } from 'react'
import type { ProjectGitDiffResponse, ProjectGitFileChange, ProjectGitStatusResponse } from '@commonspace/shared'
import { fetchProjectJson, projectApiUrl } from './project-files-api.ts'

export interface CommonspaceProjectChangesProps {
  projectId: string
}

function statusMark(change: ProjectGitFileChange): string {
  if (change.status === 'untracked') return '?'
  if (change.status === 'conflicted') return '!'
  if (change.status === 'renamed') return 'R'
  if (change.status === 'deleted') return 'D'
  if (change.status === 'added') return 'A'
  return 'M'
}

function Diff({ diff }: { diff: ProjectGitDiffResponse }) {
  if (diff.binary) return <div className="csp-project-preview-empty"><strong>Binary change</strong><p>Git cannot produce a text patch for this file.</p></div>
  if (diff.patch === '') return <div className="csp-project-preview-empty"><strong>No text difference</strong><p>Working file matches HEAD.</p></div>
  return (
    <div className="csp-project-diff" role="region" aria-label={`Diff ${diff.path}`}>
      {diff.patch.split('\n').map((line, index) => {
        const kind = line.startsWith('+++') || line.startsWith('---')
          ? 'meta'
          : line.startsWith('+')
            ? 'add'
            : line.startsWith('-')
              ? 'remove'
              : line.startsWith('@@')
                ? 'hunk'
                : 'context'
        return <code key={`${String(index)}:${line}`} className={`csp-project-diff-line csp-project-diff-line--${kind}`}>{line === '' ? ' ' : line}</code>
      })}
      {diff.truncated && <div className="csp-project-limit-note">Patch truncated after 2,000 lines.</div>}
    </div>
  )
}

export function CommonspaceProjectChanges({ projectId }: CommonspaceProjectChangesProps) {
  const [refresh, setRefresh] = useState(0)
  const [status, setStatus] = useState<ProjectGitStatusResponse | null>(null)
  const [selected, setSelected] = useState<ProjectGitFileChange | null>(null)
  const [diff, setDiff] = useState<ProjectGitDiffResponse | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus(null)
    setStatusError(null)
    setSelected(null)
    setDiff(null)
    void fetchProjectJson<ProjectGitStatusResponse>(
      projectApiUrl(projectId, 'changes', 0),
      controller.signal,
    ).then(setStatus).catch((error: unknown) => {
      if (!controller.signal.aborted) setStatusError(error instanceof Error ? error.message : String(error))
    })
    return () => { controller.abort() }
  }, [projectId, refresh])

  useEffect(() => {
    setDiff(null)
    setDiffError(null)
    if (selected === null) return
    const controller = new AbortController()
    void fetchProjectJson<ProjectGitDiffResponse>(
      projectApiUrl(projectId, 'diff', 0, selected.path),
      controller.signal,
    ).then(setDiff).catch((error: unknown) => {
      if (!controller.signal.aborted) setDiffError(error instanceof Error ? error.message : String(error))
    })
    return () => { controller.abort() }
  }, [projectId, selected])

  const mediaUrl = selected === null ? null : projectApiUrl(projectId, 'file', 0, selected.path)

  return (
    <section className="csp-project-workbench" aria-label="Project changes">
      <aside className="csp-project-file-rail">
        <header className="csp-project-pane-header">
          <div>
            <strong>Working changes</strong>
            <small>{status?.available === true ? `${status.branch ?? 'Detached HEAD'} · ${status.head ?? 'No commit'}` : 'Compared with HEAD'}</small>
          </div>
          <button type="button" className="csp-project-refresh" aria-label="Refresh changes" onClick={() => { setRefresh(value => value + 1) }}>↻</button>
        </header>
        <div className="csp-project-change-summary">
          {status?.available === true && <><strong>{status.clean ? 'Clean' : `${String(status.files.length)} changed`}</strong><span>{status.branch ?? 'Detached'}</span></>}
          {status === null && statusError === null && <span>Reading Git status…</span>}
        </div>
        <div className="csp-project-file-list" aria-live="polite">
          {statusError !== null && <div className="csp-project-pane-state csp-project-pane-state--error">{statusError}</div>}
          {status?.available === false && <div className="csp-project-pane-state"><strong>Git unavailable</strong><p>{status.reason}</p></div>}
          {status?.available === true && status.clean && <div className="csp-project-pane-state"><strong>Working tree clean</strong><p>No differences from HEAD.</p></div>}
          {status?.available === true && status.files.map(change => (
            <button
              key={`${change.oldPath ?? ''}:${change.path}`}
              type="button"
              className="csp-project-file-row csp-project-change-row"
              aria-label={`Open change ${change.path}`}
              aria-pressed={selected?.path === change.path}
              onClick={() => { setSelected(change) }}
            >
              <span className={`csp-project-change-mark csp-project-change-mark--${change.status}`} aria-hidden="true">{statusMark(change)}</span>
              <span className="csp-project-file-name"><strong>{change.path.split('/').at(-1)}</strong><small>{change.oldPath === undefined ? change.path : `${change.oldPath} → ${change.path}`}</small></span>
              <span className="csp-project-change-counts">
                {change.additions === null ? <i>—</i> : <b>+{change.additions}</b>}
                {change.deletions === null ? <i>—</i> : <em>−{change.deletions}</em>}
              </span>
            </button>
          ))}
          {status?.available === true && status.truncated && <div className="csp-project-limit-note">Showing first 500 changed files.</div>}
        </div>
      </aside>

      <div className="csp-project-preview-pane">
        {selected === null
          ? <div className="csp-project-preview-empty"><span aria-hidden="true">±</span><strong>Select a change</strong><p>Review exact working-tree differences from HEAD.</p></div>
          : <>
              <header className="csp-project-pane-header csp-project-preview-header">
                <div><strong>{selected.path}</strong><small>{selected.status} · working tree vs HEAD</small></div>
                <span>{statusMark(selected)}</span>
              </header>
              <div className="csp-project-preview-body csp-project-preview-body--diff">
                {selected.status !== 'deleted' && selected.preview === 'image' && mediaUrl !== null && <div className="csp-project-media-change"><small>Current image</small><img src={mediaUrl} alt={`Preview ${selected.path}`} /></div>}
                {selected.status !== 'deleted' && selected.preview === 'video' && mediaUrl !== null && <div className="csp-project-media-change"><small>Current video</small><video src={mediaUrl} aria-label={`Preview ${selected.path}`} controls playsInline preload="metadata" /></div>}
                {diffError !== null && <div className="csp-project-pane-state csp-project-pane-state--error">{diffError}</div>}
                {diffError === null && diff === null && <div className="csp-project-pane-state">Reading diff…</div>}
                {diffError === null && diff !== null && <Diff diff={diff} />}
              </div>
            </>}
      </div>
    </section>
  )
}
