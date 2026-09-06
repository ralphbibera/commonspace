import type { CommonspaceQueuedFollowup } from "@commonspace/shared";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CornerUpRightIcon,
	ListPlusIcon,
	SquareArrowUpIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const deliveryOptions = {
	queue: {
		label: "Queue",
		status: "Queued",
		description: "Send after the current run finishes",
		icon: ListPlusIcon,
	},
	steer: {
		label: "Steer",
		status: "Steer",
		description: "Interrupt with new guidance",
		icon: CornerUpRightIcon,
	},
	"stop-and-send": {
		label: "Stop and send",
		status: "Stop and send",
		description: "Stop the current run and send this next",
		icon: SquareArrowUpIcon,
	},
} satisfies Record<
	CommonspaceQueuedFollowup["delivery"],
	{
		label: string;
		status: string;
		description: string;
		icon: typeof ListPlusIcon;
	}
>;

export function RunDeliveryControls({
	disabled,
	thread = false,
}: {
	disabled: boolean;
	thread?: boolean;
}) {
	return (
		<fieldset
			aria-label={thread ? "Active thread run delivery" : "Active run delivery"}
			disabled={disabled}
			className="order-2 m-0 ml-auto flex shrink-0 items-center gap-0.5 rounded-md border-0 bg-muted p-0.5"
		>
			{(["queue", "steer", "stop-and-send"] as const).map((delivery) => {
				const option = deliveryOptions[delivery];
				const Icon = option.icon;
				const label =
					thread && delivery === "stop-and-send"
						? "Stop and send thread follow-up"
						: option.label;
				return (
					<Tooltip key={delivery}>
						<TooltipTrigger
							render={
								<Button
									type="submit"
									name="delivery"
									value={delivery}
									variant={delivery === "queue" ? "outline" : "ghost"}
									size={delivery === "queue" ? "sm" : "icon-xs"}
									className={delivery === "queue" ? "h-8" : "size-8"}
									disabled={disabled}
								/>
							}
							aria-label={label}
						>
							<Icon data-icon="inline-start" aria-hidden="true" />
							{delivery === "queue" && "Queue"}
						</TooltipTrigger>
						<TooltipContent>
							<strong>{option.label}</strong>
							<br />
							{option.description}
						</TooltipContent>
					</Tooltip>
				);
			})}
		</fieldset>
	);
}

export interface QueuedFollowupsProps {
	followups: CommonspaceQueuedFollowup[];
	thread?: boolean;
	className?: string;
	onMove: (messageId: string, direction: "up" | "down") => void;
	onRemove: (messageId: string) => void;
}

export function QueuedFollowups({
	followups,
	thread = false,
	className,
	onMove,
	onRemove,
}: QueuedFollowupsProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	if (followups.length === 0) return null;
	const itemLabel = thread ? "queued thread follow-up" : "queued follow-up";
	return (
		<section
			aria-label={thread ? "Queued thread follow-ups" : "Queued follow-ups"}
			className={cn(
				"min-w-0 overflow-hidden rounded-md border bg-background",
				className,
			)}
		>
			<header className="flex min-h-9 items-center gap-2 border-b bg-muted/50 px-3">
				<ListPlusIcon
					aria-hidden="true"
					className="size-3.5 text-muted-foreground"
				/>
				<h2 className="text-xs font-medium">Up next</h2>
				<Badge variant="outline">{followups.length}</Badge>
			</header>
			<ol className="max-h-44 divide-y overflow-y-auto overscroll-contain">
				{followups.map((followup, index) => {
					const option = deliveryOptions[followup.delivery];
					const Icon = option.icon;
					const expanded = expandedId === followup.messageId;
					return (
						<li
							key={followup.messageId}
							className="flex min-w-0 items-start gap-2 px-2 py-2"
						>
							<div className="min-w-0 flex-1">
								<button
									type="button"
									aria-expanded={expanded}
									aria-label={`${expanded ? "Collapse" : "Expand"} ${itemLabel} ${index + 1}`}
									className="block w-full rounded-sm px-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
									onClick={() =>
										setExpandedId(expanded ? null : followup.messageId)
									}
								>
									<span
										className={cn(
											"block whitespace-pre-wrap text-xs leading-5 [overflow-wrap:anywhere]",
											!expanded && "line-clamp-2",
										)}
									>
										{followup.text || "Message with attachments"}
									</span>
								</button>
								<span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
									<Icon className="size-3" aria-hidden="true" />
									{option.status}
								</span>
							</div>
							<div className="flex shrink-0 items-center">
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant="ghost"
												size="icon-xs"
												className="size-7"
												disabled={index === 0}
												onClick={() => onMove(followup.messageId, "up")}
											/>
										}
										aria-label={`Move ${itemLabel} up`}
									>
										<ArrowUpIcon aria-hidden="true" />
									</TooltipTrigger>
									<TooltipContent>Move earlier</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant="ghost"
												size="icon-xs"
												className="size-7"
												disabled={index === followups.length - 1}
												onClick={() => onMove(followup.messageId, "down")}
											/>
										}
										aria-label={`Move ${itemLabel} down`}
									>
										<ArrowDownIcon aria-hidden="true" />
									</TooltipTrigger>
									<TooltipContent>Move later</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant="ghost"
												size="icon-xs"
												className="size-7"
												onClick={() => onRemove(followup.messageId)}
											/>
										}
										aria-label={`Remove ${itemLabel}`}
									>
										<XIcon aria-hidden="true" />
									</TooltipTrigger>
									<TooltipContent>Remove from queue</TooltipContent>
								</Tooltip>
							</div>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
