/** Commonspace browser plugin: a first-class alternate sidebar and conversation mode. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { CommonspaceClientStore } from './commonspace-store.ts'
import { CommonspaceConversation } from './CommonspaceConversation.tsx'
import { CommonspaceModeController } from './commonspace-mode.ts'
import { CommonspaceModeSwitch } from './CommonspaceModeSwitch.tsx'
import { CommonspaceSidebar } from './CommonspaceSidebar.tsx'
import { commonspacePolish } from './polish.ts'
import { commonspaceStyles } from './styles.ts'

export { CommonspaceConversation } from './CommonspaceConversation.tsx'
export { CommonspaceModeSwitch } from './CommonspaceModeSwitch.tsx'
export { CommonspaceSidebar } from './CommonspaceSidebar.tsx'
export { CommonspaceClientStore } from './commonspace-store.ts'
export { CommonspaceModeController } from './commonspace-mode.ts'

export const inject = ['slots']

function mountStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.commonspace = 'workspace'
  style.textContent = `${commonspaceStyles}\n${commonspacePolish}`
  document.head.append(style)
  return () => { style.remove() }
}

/** Register the switch and dynamically shadow native sidebar/conversation slots. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const mode = new CommonspaceModeController()
    const store = new CommonspaceClientStore()
    const disposeStyles = mountStyles()

    const disposeFooter = ctx.slots.inject('sidebar.footer.action', () =>
      ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'commonspace-mode',
        order: -20,
        inject: () => ({ mode }),
      }, CommonspaceModeSwitch))

    const syncEvents = () => {
      if (mode.getSnapshot() === 'commonspace') {
        store.connectEvents()
        void store.refresh()
      } else {
        store.disconnectEvents()
      }
    }
    syncEvents()
    const disposeEvents = mode.subscribe(syncEvents)

    const disposeSidebar = ctx.slots.inject('sidebar.workspaces', () => {
      let dispose: (() => void) | null = null
      const sync = () => {
        if (mode.getSnapshot() === 'commonspace' && dispose === null) {
          dispose = ctx.slots.register({
            name: 'sidebar.workspaces',
            priority: -20,
            inject: () => ({ store }),
          }, CommonspaceSidebar)

        } else if (mode.getSnapshot() === 'workspaces' && dispose !== null) {
          dispose()
          dispose = null
        }
      }
      sync()
      const unsubscribe = mode.subscribe(sync)
      return () => {
        unsubscribe()
        dispose?.()
        dispose = null
      }
    })

    const disposeConversation = ctx.slots.inject('conversation', () => {
      let dispose: (() => void) | null = null
      const sync = () => {
        if (mode.getSnapshot() === 'commonspace' && dispose === null) {
          dispose = ctx.slots.register({
            name: 'conversation',
            priority: -20,
            inject: () => ({ store }),
          }, CommonspaceConversation)
        } else if (mode.getSnapshot() === 'workspaces' && dispose !== null) {
          dispose()
          dispose = null
        }
      }
      sync()
      const unsubscribe = mode.subscribe(sync)
      return () => {
        unsubscribe()
        dispose?.()
        dispose = null
      }
    })

    return () => {
      disposeEvents()
      store.disconnectEvents()
      disposeConversation()
      disposeSidebar()
      disposeFooter()
      disposeStyles()
    }
  }, 'commonspace: workspace mode')
}
