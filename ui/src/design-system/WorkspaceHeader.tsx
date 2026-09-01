import type { ReactNode } from 'react'

export interface WorkspaceHeaderProps {
  title: string
  subtitle?: string
  mark: ReactNode
  actions?: ReactNode
}

export function WorkspaceHeader({ title, subtitle, mark, actions }: WorkspaceHeaderProps) {
  return (
    <header className="flex min-h-16 items-center gap-3 border-b bg-background px-[18px] py-2 max-[780px]:pl-[60px]">
      <span className="grid size-[30px] shrink-0 place-items-center rounded-sm border bg-muted font-mono text-[15px] font-semibold text-muted-foreground" aria-hidden="true">{mark}</span>
      <div className="min-w-0 flex-1"><h1 className="truncate font-heading text-lg font-bold tracking-[-0.015em]">{title}</h1>{subtitle === undefined ? null : <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}</div>
      {actions}
    </header>
  )
}
