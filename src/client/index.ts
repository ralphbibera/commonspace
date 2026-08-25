/** Commonspace browser plugin: one additive action in the stock DSH sidebar. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { CommonspaceLauncher } from './CommonspaceLauncher.tsx'
import { commonspaceStyles } from './styles.ts'

export { CommonspaceLauncher } from './CommonspaceLauncher.tsx'
export type { CommonspaceLauncherProps } from './CommonspaceLauncher.tsx'

/** The stock sidebar declares the additive footer-action slot. */
export const inject = ['slots']

function mountStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.commonspace = 'navigation'
  style.textContent = commonspaceStyles
  document.head.append(style)
  return () => { style.remove() }
}

/** Register the Commonspace launcher without replacing the Harness sidebar. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposeStyles = mountStyles()
    const disposeSlot = ctx.slots.inject('sidebar.footer.action', () =>
      ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'commonspace',
        order: -20,
      }, CommonspaceLauncher))

    return () => {
      disposeSlot()
      disposeStyles()
    }
  }, 'commonspace: sidebar launcher')
}
