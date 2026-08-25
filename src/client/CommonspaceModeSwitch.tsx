import { useSyncExternalStore } from 'react'
import type { CommonspaceModeController } from './commonspace-mode.ts'

export interface CommonspaceModeSwitchProps {
  wide: boolean
  mode: CommonspaceModeController
}

function CommonspaceMark() {
  return (
    <span className="csp-mark" aria-hidden="true">
      <span /><span /><span /><span />
    </span>
  )
}

function FolderMark() {
  return <span className="csp-folder-mark" aria-hidden="true">▱</span>
}

export function CommonspaceModeSwitch({ wide, mode }: CommonspaceModeSwitchProps) {
  const current = useSyncExternalStore(mode.subscribe, mode.getSnapshot, mode.getSnapshot)
  const commonspace = current === 'commonspace'
  const label = commonspace ? 'Workspaces' : 'Commonspace'
  return (
    <div className="csp-switch">
      <button
        type="button"
        className={`csp-trigger${wide ? '' : ' csp-trigger--rail'}`}
        aria-label={`Switch to ${label}`}
        aria-pressed={commonspace}
        title={wide ? undefined : label}
        onClick={mode.toggle}
      >
        {commonspace ? <FolderMark /> : <CommonspaceMark />}
        {wide && <span className="csp-trigger-label">{label}</span>}
        {wide && <span className="csp-switch-arrow" aria-hidden="true">⇄</span>}
      </button>
    </div>
  )
}
