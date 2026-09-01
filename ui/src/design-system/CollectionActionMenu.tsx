import { useState } from 'react'
import { FolderPlusIcon, MessageSquareIcon, MoreHorizontalIcon, PinIcon, SettingsIcon, Trash2Icon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ConfirmActionDialog } from './ConfirmActionDialog'

export type CommonspaceCollectionKind = 'project' | 'channel' | 'agent'

export interface CollectionActionMenuProps {
  kind: CommonspaceCollectionKind
  label: string
  meta: string
  pinned?: boolean
  triggerLabel?: string
  triggerClassName?: string
  onOpen: () => void
  onTogglePinned?: () => void
  onSettings?: () => void
  onAddFolder?: () => void
  onRemove?: () => void | Promise<void>
}

function openLabel(kind: CommonspaceCollectionKind): string {
  return kind === 'agent' ? 'Message agent' : `Open ${kind}`
}

function settingsLabel(kind: CommonspaceCollectionKind): string {
  if (kind === 'agent') return 'Profile & capabilities'
  return `${kind.slice(0, 1).toLocaleUpperCase()}${kind.slice(1)} settings`
}

export function CollectionActionMenu({
  kind,
  label,
  meta,
  pinned = false,
  triggerLabel,
  triggerClassName,
  onOpen,
  onTogglePinned,
  onSettings,
  onAddFolder,
  onRemove,
}: CollectionActionMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn('grid size-11 place-items-center rounded-sm border-0 bg-transparent text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30', triggerClassName)}
          aria-label={triggerLabel ?? `More actions for ${label}`}
        >
          <MoreHorizontalIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[272px] rounded-md border p-1.5 shadow-[var(--shadow-high)] ring-0">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="grid gap-0.5 border-b px-2.5 py-2.5">
              <strong className="truncate text-[13px] font-semibold text-foreground">{label}</strong>
              <span className="truncate font-mono text-xs font-normal text-muted-foreground">{meta}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuGroup>
            <DropdownMenuItem className="min-h-10 gap-2.5 px-2.5 text-[13px]" onClick={onOpen}>
              <MessageSquareIcon aria-hidden="true" />{openLabel(kind)}
            </DropdownMenuItem>
            {onSettings !== undefined && (
              <DropdownMenuItem className="min-h-10 gap-2.5 px-2.5 text-[13px]" onClick={onSettings}>
                <SettingsIcon aria-hidden="true" />{settingsLabel(kind)}
              </DropdownMenuItem>
            )}
            {kind === 'project' && onAddFolder !== undefined && (
              <DropdownMenuItem className="min-h-10 gap-2.5 px-2.5 text-[13px]" onClick={onAddFolder}>
                <FolderPlusIcon aria-hidden="true" />Add local folder
              </DropdownMenuItem>
            )}
            {onTogglePinned !== undefined && (
              <DropdownMenuItem className="min-h-10 gap-2.5 px-2.5 text-[13px]" onClick={onTogglePinned}>
                <PinIcon aria-hidden="true" />{pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {onRemove !== undefined && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="min-h-10 gap-2.5 px-2.5 text-[13px]" onClick={() => { setConfirmOpen(true) }}>
                <Trash2Icon aria-hidden="true" />Remove {kind}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {onRemove !== undefined && (
        <ConfirmActionDialog
          open={confirmOpen}
          title={`Remove ${label}?`}
          description="This can be added again later. Existing local agent credentials stay untouched."
          onOpenChange={setConfirmOpen}
          onConfirm={onRemove}
        />
      )}
    </>
  )
}
