import {
	type CommonspaceInboxItem,
	type CommonspaceSessionItem,
	type ConversationRef,
	deriveCommonspaceInboxItems,
	deriveCommonspaceSessions,
} from "@commonspace/shared";
import {
	BookmarkIcon,
	CheckCheckIcon,
	ChevronRightIcon,
	Clock3Icon,
	InboxIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { WorkspaceHeader } from "@/design-system/WorkspaceHeader";
import { cn } from "@/lib/utils";
import type { CommonspaceStore } from "./commonspace-store.ts";

export interface CommonspaceInboxTarget {
	messageId: string;
	conversation: ConversationRef;
	threadId?: string;
}

export interface CommonspaceInboxProps {
	store: CommonspaceStore;
	onOpenItem: (item: CommonspaceInboxTarget) => void;
	viewRequest?: { view: "attention" | "sessions"; token: number } | null;
}

function kindLabel(item: CommonspaceInboxItem): string {
	switch (item.kind) {
		case "agent-reply":
			return "Agent reply";
		case "thread-reply":
			return "Thread reply";
		case "mention":
			return "Mention";
		case "failure":
			return "Failed";
		case "completion":
			return "Completed";
		case "timeout":
			return "Timed out";
		case "input-request":
			return "Needs input";
		case "permission-request":
			return "Permission";
	}
}

function formattedTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.valueOf())) return "";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

function sessionStatusLabel(session: CommonspaceSessionItem): string {
	if (session.status === "running") return "Running";
	if (session.status === "completed") return "Completed";
	if (session.attentionKind === "input-request") return "Needs input";
	if (session.attentionKind === "permission-request") return "Permission";
	if (session.attentionKind === "timeout") return "Timed out";
	return "Failed";
}

function statusClass(label: string): string {
	if (label === "Running") return "text-[var(--status-success)]";
	if (label === "Mention") return "text-primary";
	if (
		label === "Needs input" ||
		label === "Permission" ||
		label === "Timed out"
	)
		return "text-[color-mix(in_oklch,var(--status-warning)_72%,var(--foreground))]";
	if (label === "Failed") return "text-destructive";
	return "text-muted-foreground";
}

function isAttentionItem(item: CommonspaceInboxItem): boolean {
	return (
		item.kind !== "agent-reply" &&
		item.kind !== "thread-reply" &&
		item.kind !== "completion"
	);
}

export function CommonspaceInbox({
	store,
	onOpenItem,
	viewRequest = null,
}: CommonspaceInboxProps) {
	const snapshot = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
	const [view, setView] = useState<"attention" | "sessions">("attention");
	const [filter, setFilter] = useState<"all" | "unread" | "saved">("all");
	const [sessionFilter, setSessionFilter] = useState<
		"all" | CommonspaceSessionItem["status"]
	>("all");
	const [markingRead, setMarkingRead] = useState(false);
	useEffect(() => {
		if (viewRequest !== null) setView(viewRequest.view);
	}, [viewRequest]);
	const state = snapshot.bootstrap?.state;
	const items = useMemo(
		() => (state === undefined ? [] : deriveCommonspaceInboxItems(state)),
		[state],
	);
	const attentionItems = useMemo(() => items.filter(isAttentionItem), [items]);
	const sessions = useMemo(
		() =>
			state === undefined
				? []
				: deriveCommonspaceSessions(
						state,
						snapshot.bootstrap?.liveActivities ?? [],
					),
		[snapshot.bootstrap?.liveActivities, state],
	);
	const unreadCount = items.filter((item) => item.unread).length;
	const attentionCount = sessions.filter(
		(session) => session.status === "needs-attention",
	).length;
	const runningCount = sessions.filter(
		(session) => session.status === "running",
	).length;
	const visibleItems =
		filter === "unread"
			? attentionItems.filter((item) => item.unread)
			: filter === "saved"
				? attentionItems.filter((item) => item.saved)
				: attentionItems;
	const visibleSessions =
		sessionFilter === "all"
			? sessions
			: sessions.filter((session) => session.status === sessionFilter);

	const markAllRead = async () => {
		if (unreadCount === 0 || markingRead) return;
		setMarkingRead(true);
		try {
			await store.mutate({ action: "mark-inbox-read" });
		} finally {
			setMarkingRead(false);
		}
	};

	const openItem = (item: CommonspaceInboxItem) => {
		if (item.unread)
			void store
				.mutate({ action: "mark-inbox-item-read", messageId: item.messageId })
				.catch(() => undefined);
		onOpenItem(item);
	};

	const openSession = (session: CommonspaceSessionItem) => {
		const target: CommonspaceInboxTarget = {
			messageId: session.messageId,
			conversation: session.conversation,
		};
		if (session.threadId !== undefined) target.threadId = session.threadId;
		onOpenItem(target);
	};

	return (
		<main
			className="flex h-full min-h-0 flex-col bg-background"
			aria-label="Inbox"
		>
			<WorkspaceHeader
				title="Inbox"
				subtitle="Agent replies, requests, and native session outcomes"
				mark={<InboxIcon className="size-[17px]" />}
			/>

			<section
				className="mx-auto flex min-h-[52px] w-full max-w-[1020px] items-center gap-4 border-b px-9 font-mono text-xs text-muted-foreground max-[780px]:gap-2 max-[780px]:px-5 max-[480px]:gap-2.5 max-[480px]:px-3.5"
				aria-label="Inbox summary"
			>
				<span>
					<i
						className="mr-1.5 inline-block size-1.5 rounded-full bg-destructive"
						aria-hidden="true"
					/>
					{String(unreadCount)} unread
				</span>
				<span className="border-l pl-4 max-[780px]:pl-2">
					<i
						className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--status-warning)]"
						aria-hidden="true"
					/>
					{String(attentionCount)} need action
				</span>
				<span className="border-l pl-4 max-[780px]:pl-2">
					<i
						className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--status-success)]"
						aria-hidden="true"
					/>
					{String(runningCount)} running
				</span>
				{view === "attention" && (
					<button
						type="button"
						className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-2 rounded-sm border bg-background px-3 text-xs font-semibold hover:bg-muted disabled:text-muted-foreground max-[480px]:size-11 max-[480px]:justify-center max-[480px]:px-0"
						disabled={unreadCount === 0 || markingRead}
						onClick={() => {
							void markAllRead().catch(() => undefined);
						}}
					>
						<CheckCheckIcon className="size-4" aria-hidden="true" />
						<span className="max-[480px]:sr-only">
							{markingRead ? "Marking read…" : "Mark all read"}
						</span>
					</button>
				)}
			</section>

			<div className="mx-auto flex min-h-[54px] w-full max-w-[1020px] items-center justify-between gap-3 border-b px-9 max-[780px]:overflow-x-auto max-[780px]:px-5 max-[480px]:px-3">
				<fieldset
					aria-label="Inbox view"
					className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
				>
					<button
						type="button"
						aria-pressed={view === "attention"}
						onClick={() => {
							setView("attention");
						}}
						className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-transparent px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-border aria-pressed:bg-muted aria-pressed:text-foreground"
					>
						<InboxIcon className="size-4" aria-hidden="true" />
						Attention{" "}
						<span className="grid size-5 place-items-center rounded-full border bg-background font-mono">
							{String(attentionItems.length)}
						</span>
					</button>
					<button
						type="button"
						aria-pressed={view === "sessions"}
						onClick={() => {
							setView("sessions");
						}}
						className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-transparent px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-border aria-pressed:bg-muted aria-pressed:text-foreground"
					>
						<Clock3Icon className="size-4" aria-hidden="true" />
						Sessions{" "}
						<span className="grid size-5 place-items-center rounded-full border bg-background font-mono">
							{String(sessions.length)}
						</span>
					</button>
				</fieldset>
				{view === "attention" ? (
					<fieldset
						aria-label="Inbox filter"
						className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
					>
						{(["all", "unread", "saved"] as const).map((value) => (
							<button
								key={value}
								type="button"
								aria-pressed={filter === value}
								onClick={() => {
									setFilter(value);
								}}
								className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-transparent px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-border aria-pressed:bg-muted aria-pressed:text-foreground"
							>
								{value === "all" ? (
									"All"
								) : value === "unread" ? (
									`Unread${unreadCount === 0 ? "" : ` ${String(unreadCount)}`}`
								) : (
									<>
										<BookmarkIcon className="size-3.5" aria-hidden="true" />
										Saved
									</>
								)}
							</button>
						))}
					</fieldset>
				) : (
					<fieldset
						aria-label="Session status filter"
						className="m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
					>
						{(["all", "running", "needs-attention", "completed"] as const).map(
							(value) => (
								<button
									key={value}
									type="button"
									aria-pressed={sessionFilter === value}
									onClick={() => {
										setSessionFilter(value);
									}}
									className="inline-flex min-h-9 items-center rounded-sm border border-transparent px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-border aria-pressed:bg-muted aria-pressed:text-foreground"
								>
									{value === "all"
										? "All"
										: value === "needs-attention"
											? "Needs attention"
											: `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`}
								</button>
							),
						)}
					</fieldset>
				)}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
				{view === "attention" ? (
					visibleItems.length === 0 ? (
						<Empty className="min-h-72 border-0">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<CheckCheckIcon aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>You’re all caught up.</EmptyTitle>
								<EmptyDescription>
									New agent activity will appear here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<ol className="mx-auto w-full max-w-[1020px] px-7 pb-10 max-[780px]:px-3">
							{visibleItems.map((item) => {
								const label = kindLabel(item);
								return (
									<li
										key={item.id}
										className="group relative grid min-h-[88px] grid-cols-[minmax(0,1fr)_44px] items-center border-b border-border/70 bg-background transition-colors [contain-intrinsic-size:88px] [content-visibility:auto] hover:bg-surface focus-within:bg-surface"
									>
										<button
											className="relative grid min-h-[88px] min-w-0 grid-cols-[40px_minmax(0,1fr)_18px] items-center gap-[13px] rounded-sm border-0 bg-transparent px-2.5 py-3 text-left hover:bg-transparent focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-ring/50 max-[480px]:grid-cols-[36px_minmax(0,1fr)] max-[480px]:gap-2.5 max-[480px]:px-2"
											type="button"
											aria-label={`Open ${label.toLowerCase()} from ${item.actorName} in ${item.conversationName}${item.unread ? ", unread" : ""}`}
											onClick={() => {
												openItem(item);
											}}
										>
											{item.unread && (
												<span
													className="absolute left-px size-1.5 rounded-full bg-destructive"
													aria-hidden="true"
												/>
											)}
											<span className="relative grid size-10 place-items-center rounded-md border bg-background font-mono text-xs font-semibold max-[480px]:size-9">
												{item.actorName.slice(0, 1).toLocaleUpperCase()}
												<span
													className={cn(
														"absolute right-[-2px] bottom-[-2px] size-2 rounded-full border-2 border-background bg-muted-foreground",
														label === "Mention" && "bg-primary",
														(label === "Needs input" ||
															label === "Permission" ||
															label === "Timed out") &&
															"bg-[var(--status-warning)]",
														label === "Failed" && "bg-destructive",
													)}
													aria-hidden="true"
												/>
											</span>
											<span className="min-w-0">
												<span className="flex min-w-0 items-center gap-[7px]">
													<strong className="shrink-0 text-sm tracking-[-0.006em]">
														{item.actorName}
													</strong>
													<span className="truncate text-xs text-muted-foreground">
														{item.conversationName}
													</span>
													<time
														className="ml-auto shrink-0 font-mono text-xs text-muted-foreground"
														dateTime={item.createdAt}
													>
														{formattedTime(item.createdAt)}
													</time>
												</span>
												<span className="mt-1 block truncate text-[13px]">
													{item.text}
												</span>
												<span className="mt-1 flex min-w-0 items-center gap-2 text-xs">
													<span
														className={cn(
															"inline-flex min-h-5 items-center gap-1.5 font-mono text-xs font-semibold",
															statusClass(label),
														)}
													>
														{label}
													</span>
													<span className="truncate text-muted-foreground">
														{item.conversationName}
													</span>
												</span>
											</span>
											<ChevronRightIcon
												className="size-[17px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-[480px]:hidden"
												aria-hidden="true"
											/>
										</button>
										<button
											type="button"
											className="grid size-11 place-items-center rounded-sm border-0 bg-transparent text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100 max-[480px]:opacity-100 aria-pressed:bg-[color-mix(in_oklch,var(--primary)_9%,var(--background))] aria-pressed:text-primary"
											aria-label={
												item.saved ? "Remove from saved" : "Save for later"
											}
											aria-pressed={item.saved}
											onClick={() => {
												void store
													.mutate({
														action: "set-inbox-item-saved",
														messageId: item.messageId,
														saved: !item.saved,
													})
													.catch(() => undefined);
											}}
										>
											<BookmarkIcon
												className="size-[17px]"
												fill={item.saved ? "currentColor" : "none"}
												aria-hidden="true"
											/>
										</button>
									</li>
								);
							})}
						</ol>
					)
				) : visibleSessions.length === 0 ? (
					<Empty className="min-h-72 border-0">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Clock3Icon aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No matching sessions.</EmptyTitle>
							<EmptyDescription>
								Change the status filter to see other work.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ol className="mx-auto w-full max-w-[1020px] px-7 pb-10">
						{visibleSessions.map((session) => {
							const label = sessionStatusLabel(session);
							return (
								<li
									key={session.id}
									className="group relative grid min-h-[88px] grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border/70 bg-background transition-colors [contain-intrinsic-size:88px] [content-visibility:auto] hover:bg-surface focus-within:bg-surface"
								>
									<button
										className="grid min-h-[88px] min-w-0 grid-cols-[40px_minmax(0,1fr)_18px] items-center gap-[13px] rounded-sm border-0 bg-transparent px-2.5 py-3 text-left hover:bg-transparent focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-ring/50 max-[480px]:grid-cols-[36px_minmax(0,1fr)] max-[480px]:gap-2.5 max-[480px]:px-2"
										type="button"
										aria-label={`Open ${label.toLowerCase()} session for ${session.agentName} in ${session.conversationName}`}
										onClick={() => {
											openSession(session);
										}}
									>
										<span className="relative grid size-10 place-items-center rounded-md border bg-background font-mono text-xs font-semibold max-[480px]:size-9">
											{session.agentName.slice(0, 1).toLocaleUpperCase()}
											<span
												className={cn(
													"absolute right-[-2px] bottom-[-2px] size-2 rounded-full border-2 border-background bg-muted-foreground",
													session.status === "running" &&
														"bg-[var(--status-success)]",
													session.status === "needs-attention" &&
														"bg-[var(--status-warning)]",
												)}
												aria-hidden="true"
											/>
										</span>
										<span className="min-w-0">
											<span className="flex min-w-0 items-center gap-[7px]">
												<strong className="shrink-0 text-sm">
													{session.agentName}
												</strong>
												<span className="truncate text-xs text-muted-foreground">
													{session.projectName === null
														? session.conversationName
														: `${session.projectName} · ${session.conversationName}`}
												</span>
												<time
													className="ml-auto shrink-0 font-mono text-xs text-muted-foreground"
													dateTime={session.updatedAt}
												>
													{formattedTime(session.updatedAt)}
												</time>
											</span>
											<span className="mt-1 block truncate text-[13px]">
												{session.summary}
											</span>
											<span
												className={cn(
													"mt-1 block font-mono text-xs font-semibold",
													statusClass(label),
												)}
											>
												{label}
											</span>
										</span>
										<ChevronRightIcon
											className="size-[17px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-[480px]:hidden"
											aria-hidden="true"
										/>
									</button>
									<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-[780px]:opacity-100">
										<button
											type="button"
											className="min-h-11 rounded-sm border-0 bg-transparent px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
											aria-pressed={session.followed}
											onClick={() => {
												void store
													.mutate({
														action: "set-session-followed",
														sessionId: session.id,
														followed: !session.followed,
													})
													.catch(() => undefined);
											}}
										>
											{session.followed ? "Following" : "Follow"}
										</button>
										<button
											type="button"
											className="min-h-11 rounded-sm border-0 bg-transparent px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
											aria-pressed={session.muted}
											onClick={() => {
												void store
													.mutate({
														action: "set-session-muted",
														sessionId: session.id,
														muted: !session.muted,
													})
													.catch(() => undefined);
											}}
										>
											{session.muted ? "Muted" : "Mute"}
										</button>
									</div>
								</li>
							);
						})}
					</ol>
				)}
			</div>
		</main>
	);
}
