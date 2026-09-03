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
	onOpenDirectory: (kind: "projects" | "channels" | "agents") => void;
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

function runLabel(session: CommonspaceSessionItem): string {
	if (session.status === "running") return "Live";
	if (session.attentionKind === "input-request") return "Needs input";
	if (session.attentionKind === "permission-request") return "Permission";
	if (session.attentionKind === "timeout") return "Timed out";
	if (session.attentionKind === "failure") return "Failed";
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

function normalizedCopy(value: string): string {
	return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function runRequestText(
	session: CommonspaceSessionItem,
	sourceMessages: ReadonlyMap<string, string>,
): string {
	return sourceMessages.get(session.sourceMessageId) ?? "Agent request";
}

function runOutcomeText(
	session: CommonspaceSessionItem,
	sourceMessages: ReadonlyMap<string, string>,
): string {
	const source = sourceMessages.get(session.sourceMessageId);
	if (source === undefined) return session.summary;
	const normalizedSource = normalizedCopy(source);
	const normalizedSummary = normalizedCopy(session.summary);
	const repeatsRequest =
		normalizedSource === normalizedSummary ||
		(normalizedSource.length >= 24 &&
			normalizedSummary.length >= 24 &&
			(normalizedSource.startsWith(normalizedSummary) ||
				normalizedSummary.startsWith(normalizedSource)));
	if (!repeatsRequest) return session.summary;
	if (session.status === "running") return "Working on this request";
	if (session.attentionKind === "input-request") return "Waiting for your input";
	if (session.attentionKind === "permission-request") return "Permission needed";
	if (session.attentionKind === "timeout") return "Run timed out";
	if (session.attentionKind === "failure") return "Run failed — review details";
	return "Response ready";
}

function StartWorkAction({
	symbol,
	title,
	description,
	onClick,
}: {
	symbol: string;
	title: string;
	description: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className="group grid min-h-[104px] grid-cols-[34px_minmax(0,1fr)_16px] items-start gap-3 border-0 bg-background px-4 py-4 text-left hover:bg-surface focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
			onClick={onClick}
		>
			<span
				className="grid size-[30px] place-items-center rounded-sm border bg-surface font-mono text-sm font-semibold text-muted-foreground transition-colors group-hover:border-foreground/30 group-hover:text-foreground"
				aria-hidden="true"
			>
				{symbol}
			</span>
			<span className="min-w-0">
				<strong className="block text-sm font-semibold">{title}</strong>
				<small className="mt-1 block text-xs leading-[1.4] text-muted-foreground">
					{description}
				</small>
			</span>
			<span
				className="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
				aria-hidden="true"
			>
				→
			</span>
		</button>
	);
}

export function CommonspaceHome({
	bootstrap,
	onOpenSession,
	onOpenConversation,
	onStopSession,
	onOpenDirectory,
}: CommonspaceHomeProps) {
	const [filter, setFilter] = useState<RunFilter>("needs-attention");
	const [showAllRuns, setShowAllRuns] = useState(false);
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
	const displayedSessions = showAllRuns
		? visibleSessions
		: visibleSessions.slice(0, 3);
	const runningCount = sessions.filter(
		(session) => session.status === "running",
	).length;

	return (
		<main
			className="flex h-full min-h-0 flex-col bg-background"
			aria-label="Workspace home"
		>
			<WorkspaceHeader
				title="Workspace"
				subtitle="Resume a conversation or start something new."
				mark={<CommonspaceLogo decorative className="size-5" />}
			/>
			<div className="mx-auto grid min-h-0 w-full max-w-[920px] flex-1 auto-rows-max content-start gap-[18px] overflow-y-auto px-[clamp(20px,3vw,40px)] py-8 pb-12 max-[780px]:px-4 max-[780px]:py-6 max-[520px]:px-3">
				<div className="grid gap-[18px]">
					<section
						className="min-w-0 overflow-hidden rounded-md border bg-background"
						aria-labelledby="workspace-start-title"
					>
						<header className="border-b bg-surface px-5 py-5">
							<p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								Start here
							</p>
							<h2
								className="mt-1.5 font-heading text-[20px] font-bold leading-[1.25] tracking-[-0.02em]"
								id="workspace-start-title"
							>
								What are you working on?
							</h2>
							<p className="mt-1.5 max-w-[62ch] text-sm leading-[1.45] text-muted-foreground">
								Keep the work in the right place: a shared channel, a direct agent
								conversation, or a local project.
							</p>
						</header>
						<div className="grid grid-cols-1 divide-y min-[720px]:grid-cols-3 min-[720px]:divide-x min-[720px]:divide-y-0">
							<StartWorkAction
								symbol="#"
								title="Open a channel"
								description="Bring agents into one shared room."
								onClick={() => {
									onOpenDirectory("channels");
								}}
							/>
							<StartWorkAction
								symbol="@"
								title="Message an agent"
								description="Continue a private native session."
								onClick={() => {
									onOpenDirectory("agents");
							}}
							/>
							<StartWorkAction
								symbol="+"
								title="Add a project"
								description="Bind work to a local folder."
								onClick={() => {
									onOpenDirectory("projects");
							}}
							/>
						</div>
					</section>
					<section
						className="min-w-0 overflow-hidden rounded-md border bg-background"
						aria-labelledby="workspace-runs-title"
					>
						<header className="flex min-h-[72px] items-center justify-between gap-4 border-b px-[18px] py-[14px] max-[520px]:items-start">
							<div>
								<h2
									className="font-heading text-[17px] font-bold leading-[1.3] tracking-[-0.01em]"
									id="workspace-runs-title"
								>
									Agent runs
								</h2>
								<p className="mt-[3px] max-w-[58ch] text-xs text-muted-foreground">
									Start with agent work that needs your decision, review, or follow-up.
								</p>
							</div>
							<span className="inline-flex min-h-[30px] shrink-0 items-center gap-2 rounded-full border border-[color-mix(in_oklch,var(--status-success)_34%,var(--border))] bg-[color-mix(in_oklch,var(--status-success)_7%,var(--background))] px-2.5 font-mono text-xs whitespace-nowrap">
								<i
									className="size-[7px] rounded-full bg-[var(--status-success)] motion-safe:animate-[pulse_1.8s_var(--ease-standard)_infinite]"
									aria-hidden="true"
								/>
								{String(runningCount)} running
							</span>
						</header>
						<fieldset
							aria-label="Filter agent runs"
							className="m-0 flex min-h-[46px] min-w-0 items-stretch gap-0.5 overflow-x-auto border-0 border-b border-border/70 bg-surface px-2.5 py-0 [scrollbar-width:none]"
						>
							{RUN_FILTERS.map((item) => (
								<button
									key={item.value}
									type="button"
									aria-pressed={filter === item.value}
									className="relative inline-flex min-h-11 shrink-0 items-center gap-[7px] rounded-none border-0 bg-transparent px-[11px] text-xs font-semibold text-muted-foreground hover:bg-background hover:text-foreground aria-pressed:text-foreground aria-pressed:shadow-[inset_0_-2px_0_var(--foreground)] focus-visible:outline-0 focus-visible:ring-2 focus-visible:ring-ring/50"
									onClick={() => {
										setFilter(item.value);
										setShowAllRuns(false);
									}}
								>
									{item.label}
									<span className="inline-grid size-5 min-w-5 place-items-center rounded-full bg-[var(--border)] px-[5px] font-mono text-xs text-muted-foreground">
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
							<Empty className="min-h-40 rounded-none border-0 px-5 py-10 text-center">
								<EmptyHeader>
									<EmptyTitle>No matching runs</EmptyTitle>
									<EmptyDescription>
										Agent work will appear here when a conversation starts it.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<div className="grid">
								{displayedSessions.map((session) => {
									const requestText = runRequestText(session, sourceMessages);
									const outcomeText = runOutcomeText(session, sourceMessages);
									return (
										<article
											key={session.id}
											className={cn(
												"grid min-h-[84px] grid-cols-[64px_minmax(260px,1.5fr)_minmax(210px,1fr)_64px_68px] items-center gap-[14px] border-b border-border/70 bg-background px-4 py-2.5 last:border-b-0 hover:bg-surface max-[1120px]:grid-cols-[64px_minmax(180px,1.5fr)_minmax(150px,1fr)_64px_68px] max-[780px]:grid-cols-[64px_minmax(0,1fr)_68px] max-[780px]:gap-x-3 max-[520px]:grid-cols-[minmax(0,1fr)_68px] max-[520px]:p-3",
												session.status === "running" &&
													"min-h-[94px] bg-[color-mix(in_oklch,var(--status-success)_4%,var(--background))] hover:bg-[color-mix(in_oklch,var(--status-success)_7%,var(--background))]",
											)}
											data-run-status={session.status}
										>
											<span
												className={cn(
													"relative inline-flex min-h-[26px] w-fit items-center gap-[7px] rounded-full border bg-background px-2 font-mono text-xs text-muted-foreground before:size-[7px] before:rounded-full before:bg-border max-[780px]:col-start-1 max-[780px]:row-start-1 max-[780px]:self-start max-[780px]:mt-2 max-[520px]:m-0 max-[520px]:self-center",
													session.status === "running" &&
														"border-[color-mix(in_oklch,var(--status-success)_38%,var(--border))] text-foreground before:bg-[var(--status-success)] before:shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-success)_14%,transparent)]",
													session.status === "needs-attention" &&
														"border-[color-mix(in_oklch,var(--status-danger)_32%,var(--border))] text-foreground before:bg-[var(--status-danger)]",
												)}
												data-state={
													session.status === "needs-attention"
														? "attention"
														: session.status
												}
												role="status"
											>
															{runLabel(session)}
											</span>
											<button
												type="button"
												className="grid min-h-[58px] min-w-0 grid-cols-[36px_minmax(0,1fr)] items-center gap-[11px] border-0 bg-transparent p-0 text-left max-[780px]:col-start-2 max-[520px]:col-span-2 max-[520px]:col-start-1 max-[520px]:row-start-2 max-[520px]:grid-cols-[32px_minmax(0,1fr)]"
												onClick={() => {
													onOpenSession(session);
												}}
											>
												<span
													className={cn(
														"grid size-9 place-items-center rounded-md border bg-surface font-mono text-xs font-semibold",
														session.status === "running" &&
															"border-[color-mix(in_oklch,var(--status-success)_52%,var(--border))] bg-[color-mix(in_oklch,var(--status-success)_8%,var(--background))] text-[var(--status-success)]",
														session.status === "needs-attention" &&
															"border-[color-mix(in_oklch,var(--status-danger)_52%,var(--border))] bg-[color-mix(in_oklch,var(--status-danger)_8%,var(--background))] text-destructive",
													)}
												>
													{session.agentName.slice(0, 1).toLocaleUpperCase()}
												</span>
												<span className="min-w-0 max-[780px]:col-start-2 max-[780px]:row-start-2 max-[520px]:col-span-2 max-[520px]:col-start-1 max-[520px]:row-start-3">
													<strong className="line-clamp-2 max-h-[2.64rem] block overflow-hidden text-sm leading-[1.32] tracking-[-0.006em] text-pretty">
														{requestText}
													</strong>
													<small className="mt-[3px] block truncate text-xs text-muted-foreground">
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
												<strong className="mt-1 line-clamp-2 max-h-[2.7rem] block overflow-hidden text-[13px] leading-[1.35] text-pretty">
													{outcomeText}
												</strong>
											</span>
											<span className="max-[780px]:col-start-2 max-[780px]:row-start-3 max-[520px]:col-start-1 max-[520px]:row-start-4">
												<small className="block text-xs text-muted-foreground">
													{session.status === "running" ? "Elapsed" : "Updated"}
												</small>
												<strong className="mt-1 block whitespace-nowrap font-mono text-xs">
													{relativeTime(session.updatedAt)}
												</strong>
											</span>
											<button
												type="button"
												className={cn(
													"min-h-11 rounded-sm border bg-background px-[11px] text-xs font-semibold hover:bg-[var(--border)] max-[780px]:col-start-3 max-[780px]:row-start-1 max-[520px]:col-start-2 max-[520px]:row-start-4 max-[520px]:justify-self-end",
													session.status === "running" &&
														"border-[color-mix(in_oklch,var(--status-danger)_48%,var(--border))] text-destructive hover:border-destructive hover:bg-[color-mix(in_oklch,var(--status-danger)_8%,var(--background))]",
												)}
												aria-label={
													session.status === "running"
														? `Stop ${session.agentName} run`
														: `${actionLabel(session.status)} ${session.agentName} run`
												}
												onClick={() => {
													if (session.status === "running") {
														void onStopSession(session);
														return;
													}
													onOpenSession(session);
												}}
											>
												{actionLabel(session.status)}
											</button>
										</article>
									);
								})}
							</div>
						)}
						{visibleSessions.length > 3 && (
							<div className="flex min-h-[52px] items-center justify-center border-t bg-surface px-4">
								<button
									type="button"
									className="min-h-9 rounded-sm border px-3 text-xs font-semibold hover:bg-background"
									onClick={() => {
										setShowAllRuns((current) => !current);
									}}
								>
									{showAllRuns
										? "Show fewer runs"
										: `View all ${String(visibleSessions.length)} runs`}
								</button>
							</div>
						)}
					</section>

					<section
						className="min-w-0 overflow-hidden rounded-md border bg-background"
						aria-labelledby="recent-conversations-title"
					>
						<header className="flex min-h-[72px] items-center justify-between gap-4 border-b px-[18px] py-[14px]">
							<div>
								<h2
									className="font-heading text-[17px] font-bold leading-[1.3] tracking-[-0.01em]"
									id="recent-conversations-title"
								>
									Recent conversations
								</h2>
								<p className="mt-[3px] max-w-[58ch] text-xs text-muted-foreground">
									Continue the exact channel thread or agent session.
								</p>
							</div>
						</header>
						{recent.length === 0 ? (
							<Empty className="min-h-[190px] rounded-none border-0 px-6 py-6 text-center">
								<EmptyHeader>
									<EmptyTitle>No conversations yet</EmptyTitle>
									<EmptyDescription>
										Choose a channel or agent to start working together.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<div>
								{recent.map((item) => (
									<button
										key={item.id}
										type="button"
										className="grid min-h-[72px] w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-0 border-b bg-background px-4 py-2.5 text-left last:border-b-0 hover:bg-surface"
										onClick={() => {
											onOpenConversation(item.conversation);
										}}
									>
										<span
											className={cn(
												"grid size-8 place-items-center rounded-sm border bg-surface font-mono text-[13px] font-semibold",
												item.conversation.kind === "dm" &&
													"rounded-full bg-primary text-primary-foreground",
											)}
										>
											{item.conversation.kind === "channel"
												? "#"
												: item.title.slice(0, 1).toLocaleUpperCase()}
										</span>
										<span className="min-w-0">
											<strong className="block truncate">{item.title}</strong>
											<small className="mt-[3px] block truncate text-xs text-muted-foreground">
												{item.detail}
											</small>
										</span>
										<span className="text-right">
											<small className="block text-xs text-muted-foreground">
												{item.context}
											</small>
											<b className="mt-[3px] block font-mono text-xs font-medium text-muted-foreground">
												{relativeTime(item.updatedAt)}
											</b>
										</span>
									</button>
								))}
							</div>
						)}
					</section>
				</div>
			</div>
		</main>
	);
}
