import { SearchIcon } from 'lucide-react'
import { CommonspaceLogo } from '@/design-system/CommonspaceLogo'

export interface CommonspaceTopbarProps {
  homeActive: boolean
  onOpenHome: () => void
  onOpenSearch: () => void
}

export function CommonspaceTopbar({ homeActive, onOpenHome, onOpenSearch }: CommonspaceTopbarProps) {
  return (
    <header className="relative z-30 grid min-h-[52px] grid-cols-[240px_minmax(260px,640px)_240px] items-center justify-between gap-[18px] bg-sidebar-deep px-3.5 py-1 text-sidebar-foreground max-[780px]:grid-cols-[36px_minmax(0,1fr)] max-[780px]:gap-3 max-[780px]:px-3">
      <button type="button" aria-label="Open Commonspace home" aria-current={homeActive ? 'page' : undefined} onClick={onOpenHome} className="flex min-h-11 w-fit items-center gap-2.5 rounded-sm border-0 bg-transparent px-0 text-left text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground max-[780px]:px-2">
        <CommonspaceLogo decorative className="size-6" />
        <strong className="font-heading text-[13px] font-semibold max-[780px]:sr-only">Commonspace</strong>
      </button>
      <button type="button" aria-label="Search messages, channels, and agents" onClick={onOpenSearch} className="grid min-h-11 w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-2.5 text-left text-sidebar-foreground/80 hover:border-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground">
        <SearchIcon className="size-4" aria-hidden="true" />
        <span className="truncate">Search messages, channels, and agents</span>
        <kbd className="rounded-sm border border-sidebar-border px-1.5 font-mono text-xs">⌘K</kbd>
      </button>
      <span className="flex items-center justify-end gap-2 font-mono text-xs text-sidebar-foreground/70 max-[780px]:hidden"><i className="size-2 rounded-full bg-[var(--status-success)]" aria-hidden="true" />Local</span>
    </header>
  )
}
