import {
	COMMONSPACE_SEARCH_KINDS,
	type CommonspaceProject,
	type CommonspaceSearchHighlight,
	type CommonspaceSearchKind,
	type CommonspaceSearchResponse,
	type CommonspaceSearchResult,
} from "@commonspace/shared";
import { SearchIcon } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface CommonspaceSearchDialogProps {
	projects: readonly CommonspaceProject[];
	onClose: () => void;
	onSelect: (result: CommonspaceSearchResult) => void;
	fetcher?: typeof globalThis.fetch;
}

function searchUrl(
	query: string,
	kinds: readonly CommonspaceSearchKind[],
	projectId: string,
): string {
	const params = new URLSearchParams({ q: query, limit: "24" });
	if (kinds.length > 0) params.set("types", kinds.join(","));
	if (projectId !== "") params.set("project", projectId);
	return `/api/search?${params.toString()}`;
}

async function responseError(response: Response): Promise<string> {
	try {
		const body: { error?: unknown } = await response.json();
		if (typeof body.error === "string" && body.error !== "") return body.error;
	} catch {
		// Keep stable fallback below.
	}
	return `Search failed (${String(response.status)})`;
}

function HighlightedText({
	text,
	field,
	highlights,
}: {
	text: string;
	field: CommonspaceSearchHighlight["field"];
	highlights: readonly CommonspaceSearchHighlight[];
}) {
	const ranges = highlights
		.filter(
			(range) =>
				range.field === field &&
				range.start >= 0 &&
				range.end > range.start &&
				range.end <= text.length,
		)
		.sort((left, right) => left.start - right.start);
	if (ranges.length === 0) return <>{text}</>;
	const parts: Array<{ text: string; highlighted: boolean; start: number }> =
		[];
	let offset = 0;
	for (const range of ranges) {
		if (range.start < offset) continue;
		if (range.start > offset)
			parts.push({
				text: text.slice(offset, range.start),
				highlighted: false,
				start: offset,
			});
		parts.push({
			text: text.slice(range.start, range.end),
			highlighted: true,
			start: range.start,
		});
		offset = range.end;
	}
	if (offset < text.length)
		parts.push({ text: text.slice(offset), highlighted: false, start: offset });
	return (
		<>
			{parts.map((part) =>
				part.highlighted ? (
					<mark
						className="rounded-sm bg-primary/15 text-inherit"
						key={part.start}
					>
						{part.text}
					</mark>
				) : (
					part.text
				),
			)}
		</>
	);
}

function kindLabel(kind: CommonspaceSearchKind): string {
	if (kind === "dm") return "Agent conversation";
	return `${kind.slice(0, 1).toLocaleUpperCase()}${kind.slice(1)}`;
}

function resultGlyph(kind: CommonspaceSearchKind): string {
	if (kind === "channel") return "#";
	if (kind === "agent") return "@";
	if (kind === "file") return "⌁";
	if (kind === "decision") return "✓";
	if (kind === "trace") return "⋯";
	if (kind === "run") return "▶";
	if (kind === "brief") return "≡";
	return "↳";
}

function resultReceiptLabel(result: CommonspaceSearchResult): string {
	const location = result.receipt.split(" · ")[0]?.trim();
	const occurredAt = result.occurredAt;
	const time =
		occurredAt === undefined
			? undefined
			: new Intl.DateTimeFormat(undefined, {
					month: "short",
					day: "numeric",
					hour: "numeric",
					minute: "2-digit",
				}).format(new Date(occurredAt));
	return [location, time]
		.filter((value): value is string => value !== undefined)
		.join(" · ");
}

export function CommonspaceSearchDialog({
	projects,
	onClose,
	onSelect,
	fetcher = globalThis.fetch,
}: CommonspaceSearchDialogProps) {
	const resultsId = useId();
	const [query, setQuery] = useState("");
	const [selectedKinds, setSelectedKinds] = useState<CommonspaceSearchKind[]>(
		[],
	);
	const [projectId, setProjectId] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [response, setResponse] = useState<CommonspaceSearchResponse | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const deferredQuery = useDeferredValue(query);
	const deferredKinds = useDeferredValue(selectedKinds);
	const deferredProjectId = useDeferredValue(projectId);
	const requestUrl = useMemo(
		() => searchUrl(deferredQuery, deferredKinds, deferredProjectId),
		[deferredKinds, deferredProjectId, deferredQuery],
	);
	const pending =
		deferredQuery !== query ||
		deferredKinds !== selectedKinds ||
		deferredProjectId !== projectId ||
		response?.query !== deferredQuery;
	const results = response?.results ?? [];
	const boundedActiveIndex =
		results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1);
	const activeResult = results[boundedActiveIndex];

	useEffect(() => {
		const controller = new AbortController();
		setError(null);
		void fetcher(requestUrl, {
			headers: { accept: "application/json" },
			signal: controller.signal,
		})
			.then(async (result) => {
				if (!result.ok) throw new Error(await responseError(result));
				const data: CommonspaceSearchResponse = await result.json();
				return data;
			})
			.then(setResponse)
			.catch((cause: unknown) => {
				if (!controller.signal.aborted)
					setError(cause instanceof Error ? cause.message : String(cause));
			});
		return () => {
			controller.abort();
		};
	}, [fetcher, requestUrl]);

	const moveSelection = (offset: number) => {
		if (results.length === 0) return;
		setActiveIndex(
			(current) =>
				(Math.min(current, results.length - 1) + offset + results.length) %
				results.length,
		);
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				showCloseButton
				aria-describedby={undefined}
				className="top-[10vh] max-h-[80vh] -translate-y-0 sm:max-w-[720px]"
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Search Commonspace</DialogTitle>
				</DialogHeader>
				<div className="grid min-h-[68px] grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 border-b px-3.5 py-2">
					<SearchIcon aria-hidden="true" />
					<input
						autoFocus
						type="search"
						aria-label="Search Commonspace"
						aria-controls={resultsId}
						aria-activedescendant={
							activeResult === undefined
								? undefined
								: `${resultsId}-${String(boundedActiveIndex)}`
						}
						placeholder="Search messages, channels, agents, files, or runs…"
						value={query}
						className="h-11 min-w-0 border-0 bg-transparent text-[17px] tracking-[-0.01em] outline-none placeholder:text-muted-foreground"
						onChange={(event) => {
							setQuery(event.target.value);
							setActiveIndex(0);
						}}
						onKeyDown={(event) => {
							if (event.key === "ArrowDown") {
								event.preventDefault();
								moveSelection(1);
							} else if (event.key === "ArrowUp") {
								event.preventDefault();
								moveSelection(-1);
							} else if (event.key === "Enter" && activeResult !== undefined) {
								event.preventDefault();
								onSelect(activeResult);
							}
						}}
					/>
					<kbd className="mr-9 rounded-sm border bg-muted px-1.5 py-1 font-mono text-xs text-muted-foreground">
						ESC
					</kbd>
				</div>
				<section
					className="flex flex-wrap items-center gap-2 px-3.5 py-2"
					aria-label="Search filters"
				>
					<select
						className="h-9 max-w-40 rounded-sm border bg-background px-2 text-xs text-muted-foreground"
						aria-label="Filter search by project"
						value={projectId}
						onChange={(event) => {
							setProjectId(event.target.value);
							setActiveIndex(0);
						}}
					>
						<option value="">All projects</option>
						{projects.map((project) => (
							<option key={project.id} value={project.id}>
								{project.name}
							</option>
						))}
					</select>
					<ToggleGroup
						multiple
						value={selectedKinds}
						onValueChange={(values) => {
							const allowedKinds: ReadonlySet<string> = new Set(
								COMMONSPACE_SEARCH_KINDS,
							);
							setSelectedKinds(
								values.filter((value): value is CommonspaceSearchKind =>
									allowedKinds.has(value),
								),
							);
							setActiveIndex(0);
						}}
						aria-label="Search result types"
						className="w-full flex-wrap gap-1"
					>
						{COMMONSPACE_SEARCH_KINDS.map((kind) => (
							<ToggleGroupItem key={kind} value={kind}>
								{kindLabel(kind)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</section>
				<div className="flex items-center justify-between px-4 pt-1 pb-1.5 text-xs font-semibold tracking-[0.05em] text-muted-foreground uppercase">
					<span>{query.trim() === "" ? "Browse" : "Results"}</span>
					<span>
						{pending
							? "Searching…"
							: response?.truncated === true
								? `${String(results.length)}+`
								: results.length}
					</span>
				</div>
				<div
					id={resultsId}
					className="min-h-24 overflow-y-auto px-2 pb-2"
					role="listbox"
					aria-label="Commonspace search results"
					aria-busy={pending}
				>
					{results.length === 0 && (
						<span
							className="sr-only"
							role="option"
							aria-disabled="true"
							tabIndex={-1}
						>
							No selectable search results
						</span>
					)}
					{error !== null && (
						<div
							className="grid min-h-24 place-items-center text-sm text-destructive"
							role="alert"
						>
							{error}
						</div>
					)}
					{error === null && !pending && results.length === 0 && (
						<div className="grid min-h-24 place-items-center text-sm text-muted-foreground">
							No results for “{query.trim()}”.
						</div>
					)}
					{results.map((result, index) => (
						<button
							id={`${resultsId}-${String(index)}`}
							key={result.id}
							type="button"
							role="option"
							aria-label={`Open ${kindLabel(result.kind)}: ${result.title}`}
							aria-selected={index === boundedActiveIndex}
							className="grid min-h-14 w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-sm px-2.5 py-2 text-left hover:bg-muted aria-selected:bg-muted"
							onMouseEnter={() => {
								setActiveIndex(index);
							}}
							onClick={() => {
								onSelect(result);
							}}
						>
							<span
								className="grid size-8 place-items-center rounded-sm border bg-background font-semibold text-muted-foreground"
								aria-hidden="true"
							>
								{resultGlyph(result.kind)}
							</span>
							<span className="min-w-0">
								<strong className="block truncate text-[13px]">
									<HighlightedText
										text={result.title}
										field="title"
										highlights={result.highlights}
									/>
								</strong>
								<small className="block truncate text-xs text-muted-foreground">
									<HighlightedText
										text={result.detail}
										field="detail"
										highlights={result.highlights}
									/>
								</small>
								<small
									className="block truncate text-xs text-muted-foreground/80"
									title={result.receipt}
								>
									{resultReceiptLabel(result)}
								</small>
							</span>
							<span className="max-w-32 truncate text-xs text-muted-foreground">
								{kindLabel(result.kind)}
							</span>
						</button>
					))}
				</div>
				<footer
					className="flex min-h-10 items-center justify-end gap-3 border-t px-3.5 py-1.5 text-xs text-muted-foreground"
					aria-hidden="true"
				>
					<span>
						<kbd>↑</kbd>
						<kbd>↓</kbd> Navigate
					</span>
					<span>
						<kbd>↵</kbd> Open
					</span>
					<span>
						<kbd>esc</kbd> Close
					</span>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
