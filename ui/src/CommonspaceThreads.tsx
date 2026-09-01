import {
	type CommonspaceBootstrap,
	type ConversationRef,
	deriveCommonspaceInboxItems,
	deriveCommonspaceSessions,
} from "@commonspace/shared";
import {
	BellPlusIcon,
	CheckCheckIcon,
	MessageSquareTextIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { WorkspaceHeader } from "@/design-system/WorkspaceHeader";
import type { CommonspaceStore } from "./commonspace-store.ts";

interface ThreadRow {
	id: string;
	messageId: string;
	conversation: ConversationRef;
	channelName: string;
	title: string;
	detail: string;
	agentNames: string[];
	replyCount: number;
	updatedAt: string;
	unread: boolean;
	followed: boolean;
	sessionId?: string;
}

export interface CommonspaceThreadsProps {
	bootstrap: CommonspaceBootstrap | null;
	store: CommonspaceStore;
	onOpenThread: (target: {
		messageId: string;
		conversation: ConversationRef;
		threadId: string;
	}) => void;
}

function threadRows(bootstrap: CommonspaceBootstrap | null): ThreadRow[] {
	if (bootstrap === null) return [];
	const { state } = bootstrap;
	const unreadThreadIds = new Set(
		deriveCommonspaceInboxItems(state).flatMap((item) =>
			item.unread && item.threadId !== undefined ? [item.threadId] : [],
		),
	);
	const sessions = deriveCommonspaceSessions(
		state,
		bootstrap.liveActivities ?? [],
	);
	const agents = new Map(
		state.agents.map((agent) => [agent.id, agent.displayName]),
	);
	const channels = new Map(
		state.channels.map((channel) => [channel.id, channel.name]),
	);

	return state.threads
		.flatMap((thread) => {
			const conversation = { kind: "channel" as const, id: thread.channelId };
			const messages = state.messages[`channel:${thread.channelId}`] ?? [];
			const root = messages.find(
				(message) => message.id === thread.rootMessageId,
			);
			if (root === undefined) return [];
			const replies = messages.filter(
				(message) =>
					message.threadId === thread.id &&
					message.parentMessageId === thread.rootMessageId,
			);
			const latest = replies.at(-1) ?? root;
			const session = sessions.find(
				(candidate) => candidate.threadId === thread.id,
			);
			return [
				{
					id: thread.id,
					messageId: root.id,
					conversation,
					channelName: channels.get(thread.channelId) ?? thread.channelId,
					title: root.text,
					detail: latest === root ? "No replies yet." : latest.text,
					agentNames: thread.agentIds.flatMap(
						(agentId) => agents.get(agentId) ?? [],
					),
					replyCount: replies.length,
					updatedAt: latest.createdAt,
					unread: unreadThreadIds.has(thread.id),
					followed: session?.followed ?? false,
					...(session === undefined ? {} : { sessionId: session.id }),
				},
			];
		})
		.toSorted(
			(left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
		);
}

function formattedTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.valueOf())) return "";
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

export function CommonspaceThreads({
	bootstrap,
	store,
	onOpenThread,
}: CommonspaceThreadsProps) {
	const [filter, setFilter] = useState<"all" | "unread" | "following">("all");
	const rows = useMemo(() => threadRows(bootstrap), [bootstrap]);
	const unreadCount = rows.filter((row) => row.unread).length;
	const followingCount = rows.filter((row) => row.followed).length;
	const visibleRows =
		filter === "unread"
			? rows.filter((row) => row.unread)
			: filter === "following"
				? rows.filter((row) => row.followed)
				: rows;

	return (
		<main
			className="flex h-full min-h-0 flex-col bg-background"
			aria-label="Threads"
		>
			<WorkspaceHeader
				title="Threads"
				subtitle="Followed and unread channel conversations"
				mark={<MessageSquareTextIcon className="size-[17px]" />}
			/>

			<div className="mx-auto flex min-h-[52px] w-full max-w-[1020px] items-center justify-between gap-3 border-b px-10 font-mono text-xs text-muted-foreground max-[640px]:px-4">
				<div className="flex items-center gap-4">
					<span>{String(unreadCount)} unread</span>
					<span className="border-l pl-4">
						{String(followingCount)} following
					</span>
				</div>
				<button
					type="button"
					className="inline-flex min-h-9 items-center gap-2 rounded-sm border bg-background px-3 text-[13px] font-semibold text-foreground hover:bg-muted disabled:text-muted-foreground"
					disabled={unreadCount === 0}
					onClick={() => {
						void store
							.mutate({ action: "mark-inbox-read" })
							.catch(() => undefined);
					}}
				>
					<CheckCheckIcon className="size-4" aria-hidden="true" />
					Mark all read
				</button>
			</div>

			<div className="mx-auto flex min-h-[54px] w-full max-w-[1020px] items-center justify-end border-b px-9 max-[640px]:px-3">
				<div
					role="group"
					aria-label="Thread filter"
					className="flex items-center gap-0.5"
				>
					<button
						type="button"
						aria-pressed={filter === "all"}
						onClick={() => {
							setFilter("all");
						}}
						className="inline-flex min-h-9 items-center rounded-sm border border-transparent px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-border aria-pressed:bg-muted aria-pressed:text-foreground"
					>
						All
					</button>
					<button
						type="button"
						aria-pressed={filter === "unread"}
						onClick={() => {
							setFilter("unread");
						}}
						className="inline-flex min-h-9 items-center rounded-sm border border-transparent px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-border aria-pressed:bg-muted aria-pressed:text-foreground"
					>
						Unread {String(unreadCount)}
					</button>
					<button
						type="button"
						aria-pressed={filter === "following"}
						onClick={() => {
							setFilter("following");
						}}
						className="inline-flex min-h-9 items-center rounded-sm border border-transparent px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-border aria-pressed:bg-muted aria-pressed:text-foreground"
					>
						Following
					</button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
				{visibleRows.length === 0 ? (
					<Empty className="min-h-72 border-0">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<CheckCheckIcon aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No threads match</EmptyTitle>
							<EmptyDescription>
								Change the filter or open a conversation from a channel.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ol className="mx-auto w-full max-w-[1020px] px-7 pb-10">
						{visibleRows.map((row) => (
							<li
								key={row.id}
								className="group relative grid min-h-[88px] grid-cols-[minmax(0,1fr)_44px] items-center border-b [contain-intrinsic-size:88px] [content-visibility:auto]"
							>
								<button
									type="button"
									className="relative grid min-h-[88px] min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-[13px] rounded-sm px-2.5 py-3 text-left hover:bg-muted"
									aria-label={`Open thread ${row.title}${row.unread ? ", unread" : ""}`}
									onClick={() => {
										onOpenThread({
											messageId: row.messageId,
											conversation: row.conversation,
											threadId: row.id,
										});
									}}
								>
									{row.unread && (
										<span
											className="absolute left-px size-1.5 rounded-full bg-destructive"
											aria-hidden="true"
										/>
									)}
									<span className="grid size-10 place-items-center rounded-sm border bg-background font-mono text-xs font-semibold">
										{row.agentNames[0]?.slice(0, 1).toLocaleUpperCase() ?? "#"}
									</span>
									<span className="min-w-0">
										<span className="flex min-w-0 items-center gap-[7px]">
											<strong className="truncate text-sm tracking-[-0.006em]">
												{row.title}
											</strong>
											<span className="shrink-0 text-xs text-muted-foreground">
												# {row.channelName}
											</span>
										</span>
										<span className="mt-1 block truncate text-[13px]">
											{row.detail}
										</span>
										<span className="mt-1 flex items-center gap-2 text-xs">
											<span
												className={
													row.unread
														? "font-mono font-semibold text-[var(--status-success)]"
														: "font-mono font-semibold text-muted-foreground"
												}
											>
												{String(row.replyCount)}{" "}
												{row.replyCount === 1 ? "reply" : "replies"}
											</span>
											<span className="truncate text-muted-foreground">
												{row.followed ? "followed" : "not followed"}
											</span>
										</span>
									</span>
									<time
										className="self-start pt-1 font-mono text-xs text-muted-foreground"
										dateTime={row.updatedAt}
									>
										{formattedTime(row.updatedAt)}
									</time>
								</button>
								<button
									type="button"
									className="grid size-11 place-items-center rounded-sm border-0 bg-transparent text-primary opacity-0 hover:bg-[color-mix(in_oklch,var(--primary)_9%,var(--background))] group-hover:opacity-100 focus:opacity-100 aria-pressed:opacity-100"
									aria-label={
										row.followed ? "Unfollow thread" : "Follow thread"
									}
									aria-pressed={row.followed}
									disabled={row.sessionId === undefined}
									onClick={() => {
										if (row.sessionId !== undefined)
											void store
												.mutate({
													action: "set-session-followed",
													sessionId: row.sessionId,
													followed: !row.followed,
												})
												.catch(() => undefined);
									}}
								>
									<BellPlusIcon className="size-[17px]" aria-hidden="true" />
								</button>
							</li>
						))}
					</ol>
				)}
			</div>
		</main>
	);
}
