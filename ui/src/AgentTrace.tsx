import { useId, useState } from 'react'
import type { CommonspaceAgentTrace, CommonspaceTraceEntry } from '@commonspace/shared'

interface AgentTraceProps {
  authorName: string
  trace: CommonspaceAgentTrace
}

function runtimeName(trace: CommonspaceAgentTrace): string {
  return trace.adapter === 'codex' ? 'Codex' : 'Hermes'
}

function durationLabel(startedAt: string, completedAt: string): string {
  const duration = Date.parse(completedAt) - Date.parse(startedAt)
  if (!Number.isFinite(duration) || duration < 0) return 'completed'
  if (duration < 1_000) return `${String(Math.round(duration))}ms`
  if (duration < 60_000) return `${(duration / 1_000).toFixed(duration < 10_000 ? 1 : 0)}s`
  const minutes = Math.floor(duration / 60_000)
  const seconds = Math.round((duration % 60_000) / 1_000)
  return `${String(minutes)}m ${String(seconds)}s`
}

function statusLabel(status: Extract<CommonspaceTraceEntry, { type: 'tool' }>['status']): string {
  if (status === 'in_progress') return 'Running'
  if (status === 'completed') return 'Complete'
  if (status === 'failed') return 'Failed'
  return 'Pending'
}

function planStatusLabel(status: Extract<CommonspaceTraceEntry, { type: 'plan' }>['steps'][number]['status']): string {
  if (status === 'in_progress') return 'In progress'
  if (status === 'completed') return 'Complete'
  return 'Pending'
}

function TraceEntry({ entry }: { entry: CommonspaceTraceEntry }) {
  if (entry.type === 'reasoning') {
    return (
      <li className="csp-trace-entry" data-trace-kind="reasoning">
        <span className="csp-trace-node" aria-hidden="true">◇</span>
        <div className="csp-trace-entry-main">
          <header><strong>Reasoning summary</strong><span>Emitted by harness</span></header>
          <p className="csp-trace-text">{entry.text}</p>
        </div>
      </li>
    )
  }

  if (entry.type === 'plan') {
    return (
      <li className="csp-trace-entry" data-trace-kind="plan">
        <span className="csp-trace-node" aria-hidden="true">☷</span>
        <div className="csp-trace-entry-main">
          <header><strong>Plan</strong><span>{String(entry.steps.length)} steps</span></header>
          {entry.markdown !== undefined && <p className="csp-trace-text">{entry.markdown}</p>}
          {entry.steps.length > 0 && (
            <ol className="csp-trace-plan">
              {entry.steps.map((step, index) => (
                <li key={`${entry.id}-${String(index)}`} data-status={step.status}>
                  <span className="csp-trace-plan-check" aria-hidden="true">{step.status === 'completed' ? '✓' : step.status === 'in_progress' ? '•' : '○'}</span>
                  <span>{step.text}</span>
                  <small>{planStatusLabel(step.status)}</small>
                </li>
              ))}
            </ol>
          )}
        </div>
      </li>
    )
  }

  if (entry.type === 'tool') {
    return (
      <li className="csp-trace-entry" data-trace-kind="tool">
        <span className="csp-trace-node" aria-hidden="true">⌘</span>
        <div className="csp-trace-entry-main">
          <header>
            <strong>{entry.title}</strong>
            <span className={`csp-trace-status csp-trace-status--${entry.status}`}>{statusLabel(entry.status)}</span>
          </header>
          {(entry.toolName !== undefined || entry.toolKind !== undefined) && (
            <div className="csp-trace-tool-meta">
              {entry.toolKind !== undefined && <span>{entry.toolKind}</span>}
              {entry.toolName !== undefined && <code>{entry.toolName}</code>}
            </div>
          )}
          {entry.input !== undefined && <TracePayload label="Input" value={entry.input} />}
          {entry.output !== undefined && <TracePayload label="Output" value={entry.output} />}
        </div>
      </li>
    )
  }

  return (
    <li className="csp-trace-entry csp-trace-entry--usage" data-trace-kind="usage">
      <span className="csp-trace-node" aria-hidden="true">◴</span>
      <div className="csp-trace-entry-main">
        <header><strong>Context usage</strong><span>{entry.usedTokens.toLocaleString()} / {entry.contextWindow.toLocaleString()} tokens</span></header>
        {entry.costAmount !== undefined && <p className="csp-trace-cost">{entry.costAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {entry.costCurrency ?? ''}</p>}
      </div>
    </li>
  )
}

function TracePayload({ label, value }: { label: string; value: string }) {
  return (
    <div className="csp-trace-payload">
      <span>{label}</span>
      <pre><code>{value}</code></pre>
    </div>
  )
}

export function AgentTrace({ authorName, trace }: AgentTraceProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  if (trace.entries.length === 0) return null
  const runtime = runtimeName(trace)
  const tools = trace.entries.filter(entry => entry.type === 'tool').length
  const toolLabel = `${String(tools)} tool${tools === 1 ? '' : 's'}`

  return (
    <div className={`csp-trace${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="csp-trace-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Hide' : 'Show'} ${runtime} activity for ${authorName}`}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className="csp-trace-toggle-mark" aria-hidden="true">⌁</span>
        <span>{runtime} activity</span>
        <span className="csp-trace-summary">{String(trace.entries.length)} events · {toolLabel} · {durationLabel(trace.startedAt, trace.completedAt)}</span>
        <span className="csp-trace-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <section id={panelId} className="csp-trace-panel" role="region" aria-label={`${authorName} activity trace`}>
          <div className="csp-trace-intro">
            <strong>Native harness trace</strong>
            <span>Reasoning summaries and tool activity reported by {runtime}.</span>
          </div>
          <ol className="csp-trace-timeline">
            {trace.entries.map(entry => <TraceEntry key={`${entry.type}-${entry.id}`} entry={entry} />)}
          </ol>
        </section>
      )}
    </div>
  )
}
