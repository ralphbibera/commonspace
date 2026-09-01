import type {
	CommonspaceAgentTrace,
	CommonspaceTraceEntry,
} from "@commonspace/shared";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

interface AgentTraceProps {
	authorName: string;
	trace: CommonspaceAgentTrace;
}

function runtimeName(trace: CommonspaceAgentTrace): string {
	return trace.adapter === "codex" ? "Codex" : "Hermes";
}

function durationLabel(startedAt: string, completedAt: string): string {
	const duration = Date.parse(completedAt) - Date.parse(startedAt);
	if (!Number.isFinite(duration) || duration < 0) return "completed";
	if (duration < 1_000) return `${String(Math.round(duration))}ms`;
	if (duration < 60_000)
		return `${(duration / 1_000).toFixed(duration < 10_000 ? 1 : 0)}s`;
	const minutes = Math.floor(duration / 60_000);
	const seconds = Math.round((duration % 60_000) / 1_000);
	return `${String(minutes)}m ${String(seconds)}s`;
}

function statusLabel(
	status: Extract<CommonspaceTraceEntry, { type: "tool" }>["status"],
): string {
	if (status === "in_progress") return "Running";
	if (status === "completed") return "Complete";
	if (status === "failed") return "Failed";
	return "Pending";
}

function planStatusLabel(
	status: Extract<
		CommonspaceTraceEntry,
		{ type: "plan" }
	>["steps"][number]["status"],
): string {
	if (status === "in_progress") return "In progress";
	if (status === "completed") return "Complete";
	return "Pending";
}

function TraceEntry({ entry }: { entry: CommonspaceTraceEntry }) {
	if (entry.type === "reasoning") {
		return (
			<li
				className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b py-3 last:border-b-0"
				data-trace-kind="reasoning"
			>
				<span
					className="grid size-7 place-items-center rounded-full border bg-background font-mono text-xs text-muted-foreground"
					aria-hidden="true"
				>
					◇
				</span>
				<div className="min-w-0 [&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header]:gap-2 [&>header]:text-xs [&>header_span]:text-muted-foreground">
					<header>
						<strong>Reasoning summary</strong>
						<span>Emitted by harness</span>
					</header>
					<p className="mt-2 text-[13px] leading-5">{entry.text}</p>
				</div>
			</li>
		);
	}

	if (entry.type === "plan") {
		return (
			<li
				className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b py-3 last:border-b-0"
				data-trace-kind="plan"
			>
				<span
					className="grid size-7 place-items-center rounded-full border bg-background font-mono text-xs text-muted-foreground"
					aria-hidden="true"
				>
					☷
				</span>
				<div className="min-w-0 [&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header]:gap-2 [&>header]:text-xs [&>header_span]:text-muted-foreground">
					<header>
						<strong>Plan</strong>
						<span>{String(entry.steps.length)} steps</span>
					</header>
					{entry.markdown !== undefined && (
						<p className="mt-2 text-[13px] leading-5">{entry.markdown}</p>
					)}
					{entry.steps.length > 0 && (
						<ol className="mt-2 grid gap-1">
							{entry.steps.map((step, index) => (
								<li
									key={`${entry.id}-${String(index)}`}
									data-status={step.status}
								>
									<span
										className="mr-2 inline-grid size-5 place-items-center rounded-full border font-mono text-[10px]"
										aria-hidden="true"
									>
										{step.status === "completed"
											? "✓"
											: step.status === "in_progress"
												? "•"
												: "○"}
									</span>
									<span>{step.text}</span>
									<small>{planStatusLabel(step.status)}</small>
								</li>
							))}
						</ol>
					)}
				</div>
			</li>
		);
	}

	if (entry.type === "tool") {
		return (
			<li
				className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b py-3 last:border-b-0"
				data-trace-kind="tool"
			>
				<span
					className="grid size-7 place-items-center rounded-full border bg-background font-mono text-xs text-muted-foreground"
					aria-hidden="true"
				>
					⌘
				</span>
				<div className="min-w-0 [&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header]:gap-2 [&>header]:text-xs [&>header_span]:text-muted-foreground">
					<header>
						<strong>{entry.title}</strong>
						<span
							className={cn(
								"rounded-full border px-2 py-1 font-mono text-[10px]",
								entry.status === "failed" &&
									"border-destructive/40 text-destructive",
								entry.status === "completed" && "text-[var(--status-success)]",
							)}
						>
							{statusLabel(entry.status)}
						</span>
					</header>
					{(entry.toolName !== undefined || entry.toolKind !== undefined) && (
						<div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
							{entry.toolKind !== undefined && <span>{entry.toolKind}</span>}
							{entry.toolName !== undefined && <code>{entry.toolName}</code>}
						</div>
					)}
					{entry.input !== undefined && (
						<TracePayload label="Input" value={entry.input} />
					)}
					{entry.output !== undefined && (
						<TracePayload label="Output" value={entry.output} />
					)}
				</div>
			</li>
		);
	}

	return (
		<li
			className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b py-3 last:border-b-0"
			data-trace-kind="usage"
		>
			<span
				className="grid size-7 place-items-center rounded-full border bg-background font-mono text-xs text-muted-foreground"
				aria-hidden="true"
			>
				◴
			</span>
			<div className="min-w-0 [&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header]:gap-2 [&>header]:text-xs [&>header_span]:text-muted-foreground">
				<header>
					<strong>Context usage</strong>
					<span>
						{entry.usedTokens.toLocaleString()} /{" "}
						{entry.contextWindow.toLocaleString()} tokens
					</span>
				</header>
				{entry.costAmount !== undefined && (
					<p className="mt-2 font-mono text-xs text-muted-foreground">
						{entry.costAmount.toLocaleString(undefined, {
							maximumFractionDigits: 6,
						})}{" "}
						{entry.costCurrency ?? ""}
					</p>
				)}
			</div>
		</li>
	);
}

function TracePayload({ label, value }: { label: string; value: string }) {
	return (
		<div className="mt-2">
			<span className="text-xs font-semibold text-muted-foreground">
				{label}
			</span>
			<pre className="mt-1 max-h-60 overflow-auto rounded-sm border bg-muted p-2 font-mono text-xs">
				<code>{value}</code>
			</pre>
		</div>
	);
}

export function AgentTraceTimeline({
	entries,
}: {
	entries: readonly CommonspaceTraceEntry[];
}) {
	return (
		<ol className="grid">
			{entries.map((entry) => (
				<TraceEntry key={`${entry.type}-${entry.id}`} entry={entry} />
			))}
		</ol>
	);
}

export function AgentTrace({ authorName, trace }: AgentTraceProps) {
	const [open, setOpen] = useState(false);
	const panelId = useId();
	if (trace.entries.length === 0) return null;
	const runtime = runtimeName(trace);
	const tools = trace.entries.filter((entry) => entry.type === "tool").length;
	const toolLabel = `${String(tools)} tool${tools === 1 ? "" : "s"}`;

	return (
		<div className="mt-3 overflow-hidden rounded-md border bg-background">
			<button
				type="button"
				className="grid min-h-12 w-full grid-cols-[24px_auto_minmax(0,1fr)_18px] items-center gap-2 border-0 bg-transparent px-3 text-left text-xs hover:bg-muted"
				aria-expanded={open}
				aria-controls={panelId}
				aria-label={`${open ? "Hide" : "Show"} ${runtime} activity for ${authorName}`}
				onClick={() => {
					setOpen((value) => !value);
				}}
			>
				<span
					className="grid size-6 place-items-center rounded-full border font-mono"
					aria-hidden="true"
				>
					⌁
				</span>
				<span>{runtime} activity</span>
				<span className="truncate text-muted-foreground">
					{String(trace.entries.length)} events · {toolLabel} ·{" "}
					{durationLabel(trace.startedAt, trace.completedAt)}
				</span>
				<span
					className={cn("transition-transform", open && "rotate-180")}
					aria-hidden="true"
				>
					⌄
				</span>
			</button>
			{open && (
				<section
					id={panelId}
					className="border-t bg-muted p-3"
					aria-label={`${authorName} activity trace`}
				>
					<div className="mb-2 grid gap-1 text-xs">
						<strong>Native harness trace</strong>
						<span>
							Reasoning summaries and tool activity reported by {runtime}.
						</span>
					</div>
					<AgentTraceTimeline entries={trace.entries} />
				</section>
			)}
		</div>
	);
}
