export type CommonspaceMode = 'workspaces' | 'commonspace'

type Listener = () => void

export class CommonspaceModeController {
  private mode: CommonspaceMode = 'workspaces'
  private readonly listeners = new Set<Listener>()

  getSnapshot = (): CommonspaceMode => this.mode

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  showCommonspace = (): void => { this.set('commonspace') }
  showWorkspaces = (): void => { this.set('workspaces') }
  toggle = (): void => { this.set(this.mode === 'commonspace' ? 'workspaces' : 'commonspace') }

  private set(mode: CommonspaceMode): void {
    if (mode === this.mode) return
    this.mode = mode
    for (const listener of this.listeners) listener()
  }
}
