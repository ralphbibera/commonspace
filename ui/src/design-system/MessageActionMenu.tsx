import {
	BookmarkIcon,
	CopyIcon,
	MessageCircleReplyIcon,
	MoreHorizontalIcon,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MessageActionMenuProps {
	authorName: string;
	summary: string;
	saved: boolean;
	onReplyInThread?: () => void;
	onToggleSaved: () => void;
	onMarkUnread?: () => void;
	onCopyLink: () => void;
}

export function MessageActionMenu({
	authorName,
	summary,
	saved,
	onReplyInThread,
	onToggleSaved,
	onMarkUnread,
	onCopyLink,
}: MessageActionMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className="grid size-11 place-items-center rounded-sm border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
				aria-label={`More actions for message from ${authorName}`}
			>
				<MoreHorizontalIcon className="size-4" aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[272px] rounded-md border p-1.5 shadow-[var(--shadow-high)] ring-0"
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="grid gap-0.5 border-b px-2.5 py-2.5">
						<strong className="truncate text-[13px] font-semibold text-foreground">
							{authorName}
						</strong>
						<span className="truncate text-xs font-normal text-muted-foreground">
							{summary || "Attachment"}
						</span>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuGroup>
					{onReplyInThread === undefined ? null : (
						<DropdownMenuItem
							className="min-h-10 gap-2.5 px-2.5 text-[13px]"
							onClick={onReplyInThread}
						>
							<MessageCircleReplyIcon aria-hidden="true" />
							Reply in thread
						</DropdownMenuItem>
					)}
					<DropdownMenuItem
						className="min-h-10 gap-2.5 px-2.5 text-[13px]"
						onClick={onToggleSaved}
					>
						<BookmarkIcon aria-hidden="true" />
						{saved ? "Remove from saved" : "Save for later"}
					</DropdownMenuItem>
					{onMarkUnread !== undefined && (
						<DropdownMenuItem
							className="min-h-10 px-2.5 text-[13px]"
							onClick={onMarkUnread}
						>
							Mark unread
						</DropdownMenuItem>
					)}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="min-h-10 gap-2.5 px-2.5 text-[13px]"
					onClick={onCopyLink}
				>
					<CopyIcon aria-hidden="true" />
					Copy link
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
