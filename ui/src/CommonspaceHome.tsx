import {
	type CommonspaceBootstrap,
	type CommonspaceSessionItem,
	type ConversationRef,
	deriveCommonspaceSessions,
} from "@commonspace/shared";
import { useMemo, useState } from "react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { CommonspaceLogo } from "@/design-system/CommonspaceLogo";
import { WorkspaceHeader } from "@/design-system/WorkspaceHeader";
import { cn } from "@/lib/utils";

type RunFilter = "all" | CommonspaceSessionItem["status"];

interface RecentConversation {
	id: string;
	conversation: ConversationRef;
	title: string;
	detail: string;
	context: string;
	updatedAt: string;
}

export interface CommonspaceHomeProps {
	bootstrap: CommonspaceBootstrap | null;
	onOpenSession: (session: CommonspaceSessionItem) => void;
	onOpenConversation: (conversation: ConversationRef) => void;
	onStopSession: (session: CommonspaceSessionItem) => Promise<void>;
}

const RUN_FILTERS: Array<{ value: RunFilter; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "running", label: "Running" },
	{ value: "needs-attention", label: "Needs attention" },
	{ value: "completed", label: "Completed" },
];

function recentConversations(
	bootstrap: CommonspaceBootstrap | null,
): RecentConversation[] {
	if (bootstrap === null) return [];
	const { state } = bootstrap;
	const conversations: RecentConversation[] = [];

	for (const channel of state.channels) {
		const last = (state.messages[`channel:${channel.id}`] ?? []).at(-1);
		if (last === undefined) continue;
		conversations.push({
			id: `channel:${channel.id}`,
			conversation: { kind: "channel", id: channel.id },
			title: channel.name,
			detail: last.text,
			context: "Channel",
			updatedAt: last.createdAt,
		});
	}

	for (const agent of state.agents) {
		const last = (state.messages[`dm:${agent.id}`] ?? []).at(-1);
		if (last === undefined) continue;
		conversations.push({
			id: `dm:${agent.id}`,
			conversation: { kind: "dm", id: agent.id },
			title: agent.displayName,
			detail: last.text,
			context: "Agent",
			updatedAt: last.createdAt,
		});
	}

	return conversations
		.toSorted(
			(left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
		)
		.slice(0, 3);
}

function runLabel(status: CommonspaceSessionItem["status"]): string {
	if (status === "running") return "Live";
	if (status === "needs-attention") return "Action";
	return "Done";
}

function actionLabel(status: CommonspaceSessionItem["status"]): string {
	if (status === "running") return "Stop";
	if (status === "needs-attention") return "Review";
	return "Open";
}

function relativeTime(value: string): string {
	const timestamp = Date.parse(value);
	if (Number.isNaN(timestamp)) return "Now";
	const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
	if (minutes < 1) return "Now";
	if (minutes < 60) return `${String(minutes)}m`;
	if (minutes < 1_440) return `${String(Math.round(minutes / 60))}h`;
	return "Today";
}

export function CommonspaceHome({
	bootstrap,
	onOpenSession,
	onOpenConversation,
	onStopSession,
}: CommonspaceHomeProps) {
	const [filter, setFilter] = useState<RunFilter>("all");
	const sessions = useMemo(
		() =>
			bootstrap === null
				? []
				: deriveCommonspaceSessions(
						bootstrap.state,
						bootstrap.liveActivities ?? [],
					),
		[bootstrap],
	);
	const recent = useMemo(() => recentConversations(bootstrap), [bootstrap]);
	const sourceMessages = useMemo(
		() =>
			new Map(
				Object.values(bootstrap?.state.messages ?? {})
					.flat()
					.map((message) => [message.id, message.text]),
			),
		[bootstrap],
	);
	const visibleSessions =
		filter === "all"
			? sessions
			: sessions.filter((session) => session.status === filter);
	const runningCount = sessions.filter(
		(session) => session.status === "running",
	).length;

	return (
		<main
			className="flex h-full min-h-0 flex-col bg-background"
			aria-label="Workspace home"
		>
			<WorkspaceHeader
				title="Dashboard"
				mark={<CommonspaceLogo decorative className="size-5" />}
			/>

			<div className="mx-auto grid min-h-0 w-full max-w-[920px] flex-1 auto-rows-max content-start gap-[18px] overflow-y-auto px-[clamp(20px,3vw,40px)] py-8 pb-12 max-[780px]:px-4 max-[780px]:py-6 max-[520px]:px-3">
				<section
					className="min-w-0 overflow-hidden rounded-md border bg-card"
					aria-labelledby="workspace-runs-title"
				>
					<header className="flex min-h-[72px] items-center justify-between gap-4 border-b px-[18px] py-[14px] max-[520px]:items-start">
						<div>
							<h2
								id="workspace-runs-title"
								className="font-heading text-[17px] font-bold tracking-[-0.01em]"
							>
								Agent runs
							</h2>
							<p className="mt-0.5 text-xs text-muted-foreground">
								One agent response, tied to the conversation that started it.
							</p>
						</div>
						<span className="inline-flex min-h-[30px] shrink-0 items-center gap-2 rounded-full border border-[color-mix(in_oklch,var(--status-success)_34%,var(--border))] bg-[color-mix(in_oklch,var(--status-success)_7%,var(--background))] px-2.5 font-mono text-xs">
							<i
								className="size-[7px] rounded-full bg-[var(--status-success)]"
								aria-hidden="true"
							/>
							{String(runningCount)} running
						</span>
					</header>

					<fieldset
						aria-label="Filter agent runs"
						className="m-0 flex min-h-[46px] min-w-0 items-stretch gap-0.5 overflow-x-auto border-0 border-b bg-muted px-2.5 py-0 [scrollbar-width:none]"
					>
						{RUN_FILTERS.map((item) => (
							<button
								key={item.value}
								type="button"
								aria-pressed={filter === item.value}
								onClick={() => {
									setFilter(item.value);
								}}
								className="relative inline-flex min-h-11 shrink-0 items-center gap-[7px] border-0 bg-transparent px-[11px] text-xs font-semibold text-muted-foreground hover:bg-background hover:text-foreground aria-pressed:text-foreground aria-pressed:shadow-[inset_0_-2px_0_var(--foreground)]"
							>
								{item.label}
								<span className="grid size-5 min-w-5 place-items-center rounded-full bg-accent px-1 font-mono text-xs text-muted-foreground">
									{String(
										item.value === "all"
											? sessions.length
											: sessions.filter(
													(session) => session.status === item.value,
												).length,
									)}
								</span>
							</button>
						))}
					</fieldset>

					{visibleSessions.length === 0 ? (
						<Empty className="min-h-40 rounded-none border-0">
							<EmptyHeader>
								<EmptyTitle>No matching runs</EmptyTitle>
								<EmptyDescription>
									Agent work will appear here when a conversation starts it.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<div className="grid">
							{visibleSessions.slice(0, 3).map((session) => (
								<article
									key={session.id}
									className={cn(
										"grid min-h-[84px] grid-cols-[64px_minmax(260px,1.5fr)_minmax(210px,1fr)_64px_68px] items-center gap-3.5 border-b bg-background px-4 py-2.5 last:border-b-0 hover:bg-muted max-[780px]:grid-cols-[64px_minmax(0,1fr)_68px] max-[780px]:gap-x-3 max-[520px]:grid-cols-[minmax(0,1fr)_68px] max-[520px]:p-3",
										session.status === "running" &&
											"min-h-[94px] bg-[color-mix(in_oklch,var(--status-success)_4%,var(--background))] hover:bg-[color-mix(in_oklch,var(--status-success)_7%,var(--background))]",
									)}
									data-run-status={session.status}
								>
									<span
										className={cn(
											"inline-flex min-h-[26px] w-fit items-center gap-[7px] rounded-full border bg-background px-2 font-mono text-xs text-muted-foreground before:size-[7px] before:rounded-full before:bg-border max-[780px]:col-start-1 max-[780px]:row-start-1 max-[780px]:self-start max-[780px]:mt-2 max-[520px]:m-0 max-[520px]:self-center",
											session.status === "running" &&
												"border-[color-mix(in_oklch,var(--status-success)_38%,var(--border))] text-foreground before:bg-[var(--status-success)]",
											session.status === "needs-attention" &&
												"border-[color-mix(in_oklch,var(--destructive)_32%,var(--border))] text-foreground before:bg-destructive",
										)}
									>
										{runLabel(session.status)}
									</span>
									<button
										type="button"
										className="grid min-h-[58px] min-w-0 grid-cols-[36px_minmax(0,1fr)] items-center gap-[11px] text-left max-[780px]:col-start-2 max-[520px]:col-span-2 max-[520px]:col-start-1 max-[520px]:row-start-2 max-[520px]:grid-cols-[32px_minmax(0,1fr)]"
										onClick={() => {
											onOpenSession(session);
										}}
									>
										<span
											className={cn(
												"grid size-9 place-items-center rounded-sm border bg-background font-mono text-xs font-semibold",
												session.status === "running" &&
													"border-primary bg-primary text-primary-foreground",
												session.status === "needs-attention" &&
													"border-foreground bg-foreground text-background",
											)}
										>
											{session.agentName.slice(0, 1).toLocaleUpperCase()}
										</span>
										<span className="min-w-0">
											<strong className="line-clamp-2 break-words text-sm leading-[1.32] tracking-[-0.006em]">
												{sourceMessages.get(session.sourceMessageId) ??
													session.summary}
											</strong>
											<small className="mt-1 block truncate text-xs text-muted-foreground">
												{session.agentName} ·{" "}
												{session.projectName ?? session.conversationName}
											</small>
										</span>
									</button>
									<span className="min-w-0 max-[780px]:col-start-2 max-[780px]:row-start-2 max-[520px]:col-span-2 max-[520px]:col-start-1 max-[520px]:row-start-3">
										<small className="block text-xs text-muted-foreground">
											{session.status === "running"
												? "Current activity"
												: session.status === "needs-attention"
													? "Waiting on you"
													: "Outcome"}
										</small>
										<strong className="mt-1 line-clamp-2 break-words text-[13px] leading-[1.35]">
											{session.summary}
										</strong>
									</span>
									<span className="max-[780px]:col-start-2 max-[780px]:row-start-3 max-[520px]:col-start-1 max-[520px]:row-start-4">
										<small className="block text-xs text-muted-foreground">
											{session.status === "running" ? "Elapsed" : "Updated"}
										</small>
										<strong className="mt-1 block font-mono text-xs">
											{relativeTime(session.updatedAt)}
										</strong>
									</span>
									<button
										type="button"
										aria-label={
											session.status === "running"
												? `Stop ${session.agentName} run`
												: `${actionLabel(session.status)} ${session.agentName} run`
										}
										className={cn(
											"min-h-11 rounded-sm border bg-background px-[11px] text-xs font-semibold hover:bg-accent max-[780px]:col-start-3 max-[780px]:row-start-1 max-[520px]:col-start-2 max-[520px]:row-start-4 max-[520px]:justify-self-end",
											session.status === "running" &&
												"border-[color-mix(in_oklch,var(--destructive)_48%,var(--border))] text-destructive hover:border-destructive hover:bg-[color-mix(in_oklch,var(--destructive)_8%,var(--background))]",
										)}
										onClick={() => {
											if (session.status === "running")
												void onStopSession(session);
											else onOpenSession(session);
										}}
									>
										{actionLabel(session.status)}
									</button>
								</article>
							))}
						</div>
					)}
				</section>

				<section
					className="min-w-0 overflow-hidden rounded-md border bg-card"
					aria-labelledby="recent-conversations-title"
				>
					<header className="flex min-h-[72px] items-center border-b px-[18px] py-[14px]">
						<div>
							<h2
								id="recent-conversations-title"
								className="font-heading text-[17px] font-bold tracking-[-0.01em]"
							>
								Recent conversations
							</h2>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Continue the exact channel thread or agent session.
							</p>
						</div>
					</header>
					{recent.length === 0 ? (
						<Empty className="min-h-36 rounded-none border-0">
							<EmptyHeader>
								<EmptyTitle>No conversations yet</EmptyTitle>
								<EmptyDescription>
									Choose a channel or agent to start working together.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<div className="grid">
							{recent.map((item) => (
								<button
									key={item.id}
									type="button"
									className="grid min-h-[72px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-2.5 text-left last:border-b-0 hover:bg-muted"
									onClick={() => {
										onOpenConversation(item.conversation);
									}}
								>
									<span className="grid size-[34px] place-items-center rounded-sm border bg-muted font-mono text-base">
										{item.conversation.kind === "channel"
											? "#"
											: item.title.slice(0, 1).toLocaleUpperCase()}
									</span>
									<span className="min-w-0">
										<strong className="block">{item.title}</strong>
										<small className="block truncate text-xs text-muted-foreground">
											{item.detail}
										</small>
									</span>
									<span className="text-right text-xs text-muted-foreground">
										<span className="block">{item.context}</span>
										<span className="mt-1 block font-mono">
											{relativeTime(item.updatedAt)}
										</span>
									</span>
								</button>
							))}
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
