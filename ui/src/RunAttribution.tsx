import { useId, useState } from 'react'
import type { CommonspaceRunAttribution, CommonspaceRunFileChange } from '@commonspace/shared'

interface RunAttributionProps {
  attribution: CommonspaceRunAttribution
  authorName: string
  messageId: string
  projectId: string
}

function firstChangedLine(patch: string | undefined): number {
  const match = patch?.match(/^@@ -\d+(?:,\d+)? \+(\d+)/mu)
  return match?.[1] === undefined ? 1 : Number(match[1])
}

function fileAnchor(messageId: string, rootIndex: number, path: string): string {
  return `run-${encodeURIComponent(messageId)}-${String(rootIndex)}-${encodeURIComponent(path)}`
}

async function openInEditor(projectId: string, rootIndex: number, change: CommonspaceRunFileChange): Promise<void> {
  await fetch(`/api/projects/${encodeURIComponent(projectId)}/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rootIndex, path: change.path, line: firstChangedLine(change.patch) }),
  })
}

export function RunAttribution({ attribution, authorName, messageId, projectId }: RunAttributionProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const panelId = useId()
  const available = attribution.roots.filter(root => root.available)
  const observedCount = available.reduce((total, root) => total + root.observed.length, 0)
  const preExistingCount = available.reduce((total, root) => total + root.preExisting.length, 0)
  const fileLabel = `${String(observedCount)} file${observedCount === 1 ? '' : 's'} changed`

  return (
    <div className={`csp-run-evidence${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="csp-run-evidence-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Hide' : 'Show'} run evidence for ${authorName}`}
        onClick={() => { setOpen(value => !value) }}
      >
        <span aria-hidden="true">±</span>
        <strong>Run evidence</strong>
        <span>{fileLabel} · {String(preExistingCount)} pre-existing</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <section id={panelId} className="csp-run-evidence-panel" role="region" aria-label={`${authorName} run evidence`}>
          {attribution.roots.map(root => root.available
            ? (
                <div key={root.rootIndex} className="csp-run-root">
                  <header><strong>Folder {String(root.rootIndex + 1)}</strong><span>{root.branch ?? 'detached HEAD'}</span></header>
                  {root.preExisting.length > 0 && (
                    <div className="csp-run-preexisting">
                      <strong>Present before run</strong>
                      <span>{root.preExisting.map(change => change.path).join(', ')}</span>
                    </div>
                  )}
                  {root.observed.length === 0
                    ? <p className="csp-run-empty">No repository changes observed during this run.</p>
                    : <ul className="csp-run-files">
                        {root.observed.map(change => {
                          const anchor = fileAnchor(messageId, root.rootIndex, change.path)
                          const expanded = selected === anchor
                          return (
                            <li key={anchor} id={anchor}>
                              <div className="csp-run-file-row">
                                <a href={`#${anchor}`} onClick={() => { setSelected(expanded ? null : anchor) }}>{change.path}</a>
                                <span>{change.status}{change.preExisting ? ' · also pre-existing' : ''}</span>
                                <small>+{change.additions ?? '–'} / −{change.deletions ?? '–'}</small>
                                <button type="button" aria-label={`Open ${change.path} in editor`} onClick={() => {
                                  void openInEditor(root.projectId ?? projectId, root.projectRootIndex ?? root.rootIndex, change)
                                }}>Open in editor</button>
                              </div>
                              {expanded && change.patch !== undefined && <pre className="csp-run-patch"><code>{change.patch}</code></pre>}
                            </li>
                          )
                        })}
                      </ul>}
                </div>
              )
            : <p key={root.rootIndex} className="csp-run-empty">Folder {String(root.rootIndex + 1)}: {root.reason}</p>)}
        </section>
      )}
    </div>
  )
}
