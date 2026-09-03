import type {
	CommonspaceAgentProfile,
	CommonspaceBootstrap,
	CommonspaceReasoning,
} from "@commonspace/shared";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/design-system/ConfirmActionDialog";
import { cn } from "@/lib/utils";
import type { CommonspaceStore } from "./commonspace-store.ts";

const reasoningValues: ReadonlySet<string> = new Set([
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
]);

function isReasoning(value: string): value is CommonspaceReasoning {
	return reasoningValues.has(value);
}

interface SettingsPaneProps {
	bootstrap: CommonspaceBootstrap;
	id: string;
	store: CommonspaceStore;
	onClose: () => void;
}

function runtimeLabel(agent: CommonspaceAgentProfile): string {
	return agent.adapter === "codex" ? "Codex" : "Hermes";
}

function AgentMark({
	agent,
	large = false,
}: {
	agent: CommonspaceAgentProfile;
	large?: boolean;
}) {
	return (
		<span
			className={cn(
				"grid shrink-0 place-items-center border bg-muted font-mono font-semibold",
				large ? "size-16 rounded-md text-2xl" : "size-9 rounded-md text-xs",
			)}
			style={
				agent.accentColor === undefined
					? undefined
					: { backgroundColor: agent.accentColor, color: "#fff" }
			}
			aria-hidden="true"
		>
			{agent.avatarEmoji ?? agent.displayName.slice(0, 1).toLocaleUpperCase()}
		</span>
	);
}

const AVATAR_EMOJIS = [
	["🤖", "robot agent"],
	["🧠", "brain thinking"],
	["🧭", "compass direction"],
	["🛠️", "tools builder"],
	["⚙️", "gear systems"],
	["✨", "sparkles"],
	["🚀", "rocket launch"],
	["⚡", "lightning fast"],
	["🔥", "fire hot"],
	["🌐", "globe web"],
	["🔬", "microscope research"],
	["🔎", "search inspect"],
	["🎨", "palette design"],
	["💻", "computer code"],
	["🧩", "puzzle solve"],
	["🛰️", "satellite infrastructure"],
	["🦾", "robot arm"],
	["🦉", "owl wisdom"],
	["🐙", "octopus"],
	["🦊", "fox"],
	["🐝", "bee"],
	["🌱", "seed growth"],
	["💡", "lightbulb idea"],
	["🛡️", "shield safety"],
] as const;

function AvatarEmojiPicker({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const picker = useRef<HTMLDivElement>(null);
	const visible = AVATAR_EMOJIS.filter(([, keywords]) =>
		`${keywords}`
			.toLocaleLowerCase()
			.includes(query.trim().toLocaleLowerCase()),
	);

	useEffect(() => {
		if (!open) return;
		const close = (event: PointerEvent) => {
			if (
				!(event.target instanceof Node) ||
				picker.current?.contains(event.target) !== true
			)
				setOpen(false);
		};
		document.addEventListener("pointerdown", close);
		return () => {
			document.removeEventListener("pointerdown", close);
		};
	}, [open]);

	return (
		<div ref={picker} className="relative">
			<button
				type="button"
				className="flex min-h-11 w-full items-center justify-between rounded-sm border bg-background px-3 text-left text-xl hover:bg-muted"
				aria-label="Choose avatar emoji"
				aria-expanded={open}
				onClick={() => {
					setOpen((current) => !current);
				}}
			>
				<span>{value || "🤖"}</span>
				<ChevronDownIcon
					className="size-4 text-muted-foreground"
					aria-hidden="true"
				/>
			</button>
			{open && (
				<section
					className="absolute top-[calc(100%+6px)] left-0 z-30 w-full min-w-[240px] rounded-md border bg-popover p-2 text-popover-foreground shadow-lg"
					aria-label="Avatar emoji picker"
				>
					<input
						type="search"
						className="mb-2 min-h-10 w-full rounded-sm border bg-background px-2 text-sm"
						aria-label="Search avatar emoji"
						placeholder="Search emoji"
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
						}}
					/>
					<div className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto">
						{visible.map(([emoji, keywords]) => (
							<button
								key={emoji}
								type="button"
								className="grid size-9 place-items-center rounded-sm border-0 text-lg hover:bg-muted aria-pressed:bg-primary/10"
								aria-label={`Use ${keywords} avatar`}
								aria-pressed={value === emoji}
								onClick={() => {
									onChange(emoji);
									setOpen(false);
								}}
							>
								{emoji}
							</button>
						))}
					</div>
				</section>
			)}
		</div>
	);
}

export function ChannelSettingsPane({
	bootstrap,
	id,
	store,
	onClose,
}: SettingsPaneProps) {
	const channel = bootstrap.state.channels.find(
		(candidate) => candidate.id === id,
	);
	const agents = bootstrap.agents;
	const [agentIds, setAgentIds] = useState<string[]>(channel?.agentIds ?? []);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<"all" | "included" | "available">("all");
	const [instructions, setInstructions] = useState(channel?.instructions ?? "");
	const [model, setModel] = useState(channel?.settings.model ?? "");
	const [reasoning, setReasoning] = useState<CommonspaceReasoning | "">(
		channel?.settings.reasoning ?? "",
	);
	const [summary, setSummary] = useState(channel?.memory.summary ?? "");
	const [decisions, setDecisions] = useState(
		channel?.memory.decisions.join("\n") ?? "",
	);
	const [questions, setQuestions] = useState(
		channel?.memory.openQuestions.join("\n") ?? "",
	);
	const [pinNote, setPinNote] = useState("");
	const [saving, setSaving] = useState(false);
	const [compacting, setCompacting] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

	useEffect(() => {
		if (channel === undefined) return;
		setAgentIds(channel.agentIds);
		setInstructions(channel.instructions);
		setModel(channel.settings.model ?? "");
		setReasoning(channel.settings.reasoning ?? "");
		setSummary(channel.memory.summary);
		setDecisions(channel.memory.decisions.join("\n"));
		setQuestions(channel.memory.openQuestions.join("\n"));
	}, [channel]);

	const visibleAgents = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		return agents.filter((agent) => {
			if (filter === "included" && !agentIds.includes(agent.id)) return false;
			if (filter === "available" && agentIds.includes(agent.id)) return false;
			return (
				normalized === "" ||
				`${agent.displayName} ${agent.adapter} ${agent.model ?? ""} ${agent.description ?? ""}`
					.toLocaleLowerCase()
					.includes(normalized)
			);
		});
	}, [agentIds, agents, filter, query]);
	const pins = bootstrap.state.pins.filter(
		(pin) =>
			pin.removedAt === null &&
			pin.scope.kind === "channel" &&
			pin.scope.id === id,
	);

	if (channel === undefined) return null;

	const save = async (event: FormEvent) => {
		event.preventDefault();
		if (saving) return;
		setSaving(true);
		try {
			await store.mutate({
				action: "set-channel-configuration",
				channelId: id,
				agentIds,
				instructions,
				model: model || null,
				reasoning: reasoning || null,
				summary,
				decisions: decisions
					.split("\n")
					.map((value) => value.trim())
					.filter(Boolean),
				openQuestions: questions
					.split("\n")
					.map((value) => value.trim())
					.filter(Boolean),
			});
			onClose();
		} finally {
			setSaving(false);
		}
	};

	const updateVisible = (include: boolean) => {
		const visibleIds = new Set(visibleAgents.map((agent) => agent.id));
		setAgentIds((current) =>
			include
				? [
						...current,
						...visibleAgents
							.map((agent) => agent.id)
							.filter((agentId) => !current.includes(agentId)),
					]
				: current.filter((agentId) => !visibleIds.has(agentId)),
		);
	};

	return (
		<aside
			className="commonspace-context-settings flex min-h-0 min-w-[340px] flex-col border-l bg-background"
			aria-label="Channel settings"
		>
			<header className="flex min-h-[70px] items-center gap-3 border-b py-2.5 pr-3.5 pl-5">
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-heading text-[17px] font-bold">
						# {channel.name}
					</h2>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Manage who can participate in this shared room.
					</p>
				</div>
				<button
					type="button"
					className="grid size-8 shrink-0 place-items-center rounded-sm border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
					aria-label="Close channel settings"
					onClick={onClose}
				>
					<XIcon className="size-[18px]" aria-hidden="true" />
				</button>
			</header>
			<form
				className="flex min-h-0 flex-1 flex-col"
				onSubmit={(event) => {
					void save(event);
				}}
			>
				<div className="min-h-0 flex-1 overflow-y-auto p-5">
					<section aria-labelledby="channel-members-heading">
						<header className="mb-4 flex items-start justify-between gap-3">
							<div>
								<h3
									id="channel-members-heading"
									className="font-heading text-sm font-bold"
								>
									Members
								</h3>
								<p className="mt-1 text-xs text-muted-foreground">
									Choose which agents can be mentioned in this channel.
								</p>
							</div>
							<span className="shrink-0 rounded-full border px-2 py-1 font-mono text-[11px] text-muted-foreground">
								{String(agentIds.length)} of {String(agents.length)} included
							</span>
						</header>
						<div className="overflow-hidden rounded-md border">
							<div className="border-b bg-muted p-3">
								<label className="flex min-h-11 items-center gap-2 rounded-sm border bg-background px-3 text-muted-foreground focus-within:border-primary">
									<SearchIcon className="size-4" aria-hidden="true" />
									<span className="sr-only">Search agents</span>
									<input
										className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none"
										type="search"
										aria-label="Search agents"
										placeholder="Search agents by name or role"
										value={query}
										onChange={(event) => {
											setQuery(event.target.value);
										}}
									/>
								</label>
								<fieldset
									className="mt-2 flex min-w-0 gap-1 border-0 p-0"
									aria-label="Filter channel members"
								>
									{(["all", "included", "available"] as const).map((value) => (
										<button
											key={value}
											type="button"
											className="min-h-9 rounded-full border px-3 text-xs font-semibold capitalize aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
											aria-pressed={filter === value}
											onClick={() => {
												setFilter(value);
											}}
										>
											{value}
										</button>
									))}
								</fieldset>
							</div>
							<div className="flex min-h-11 items-center justify-between gap-3 border-b px-3 text-xs text-muted-foreground">
								<span>
									{String(visibleAgents.length)}{" "}
									{visibleAgents.length === 1 ? "agent" : "agents"}
								</span>
								<span>
									<button
										type="button"
										className="min-h-9 px-2 font-semibold text-primary"
										onClick={() => {
											updateVisible(true);
										}}
									>
										Include visible
									</button>
									<button
										type="button"
										className="min-h-9 px-2 font-semibold text-muted-foreground"
										onClick={() => {
											updateVisible(false);
										}}
									>
										Remove visible
									</button>
								</span>
							</div>
							<div>
								{visibleAgents.map((agent) => {
									const included = agentIds.includes(agent.id);
									return (
										<label
											key={agent.id}
											className="grid min-h-[62px] grid-cols-[18px_36px_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted"
										>
											<input
												type="checkbox"
												checked={included}
												onChange={(event) => {
													setAgentIds((current) =>
														event.target.checked
															? [...current, agent.id]
															: current.filter(
																	(agentId) => agentId !== agent.id,
																),
													);
												}}
											/>
											<AgentMark agent={agent} />
											<span className="min-w-0">
												<strong className="block truncate text-[13px]">
													{agent.displayName}
												</strong>
												<small className="block truncate text-xs text-muted-foreground">
													{runtimeLabel(agent)} ·{" "}
													{agent.description ?? agent.model ?? "native profile"}
												</small>
											</span>
											<span
												className={cn(
													"rounded-full border px-2 py-1 text-[10px]",
													agent.status === "running"
														? "border-[var(--status-success)]/30 text-[var(--status-success)]"
														: "text-muted-foreground",
												)}
											>
												{agent.status === "running" ? "Working" : "Available"}
											</span>
										</label>
									);
								})}
								{visibleAgents.length === 0 && (
									<div className="p-8 text-center">
										<strong className="block text-[13px]">
											No agents found
										</strong>
										<span className="mt-1 block text-xs text-muted-foreground">
											Try another name or role, or show all agents.
										</span>
									</div>
								)}
							</div>
						</div>
					</section>

					<section
						className="mt-7 border-t pt-6"
						aria-labelledby="channel-context-heading"
					>
						<h3
							id="channel-context-heading"
							className="font-heading text-sm font-bold"
						>
							Channel context
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Instructions, model defaults, and canonical memory remain attached
							to this room.
						</p>
						<div className="mt-4 grid gap-3 [&_input]:min-h-11 [&_input]:rounded-sm [&_input]:border [&_input]:px-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-xs [&_label]:font-semibold [&_select]:min-h-11 [&_select]:rounded-sm [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_textarea]:min-h-20 [&_textarea]:rounded-sm [&_textarea]:border [&_textarea]:p-3">
							<label>
								Instructions
								<textarea
									aria-label="Channel instructions"
									value={instructions}
									onChange={(event) => {
										setInstructions(event.target.value);
									}}
								/>
							</label>
							<div className="grid grid-cols-2 gap-3">
								<label>
									Model
									<input
										aria-label="Channel model"
										placeholder="Inherit default"
										value={model}
										onChange={(event) => {
											setModel(event.target.value);
										}}
									/>
								</label>
								<label>
									Reasoning
									<select
										aria-label="Channel reasoning"
										value={reasoning}
										onChange={(event) => {
											if (
												event.target.value === "" ||
												isReasoning(event.target.value)
											)
												setReasoning(event.target.value);
										}}
									>
										<option value="">Inherit default</option>
										{[
											"none",
											"minimal",
											"low",
											"medium",
											"high",
											"xhigh",
											"max",
										].map((value) => (
											<option key={value} value={value}>
												{value}
											</option>
										))}
									</select>
								</label>
							</div>
							<label>
								Summary
								<textarea
									aria-label="Channel summary"
									value={summary}
									onChange={(event) => {
										setSummary(event.target.value);
									}}
								/>
							</label>
							<label>
								Decisions
								<textarea
									aria-label="Channel decisions"
									value={decisions}
									onChange={(event) => {
										setDecisions(event.target.value);
									}}
								/>
							</label>
							<label>
								Open questions
								<textarea
									aria-label="Channel open questions"
									value={questions}
									onChange={(event) => {
										setQuestions(event.target.value);
									}}
								/>
							</label>
							<Button
								type="button"
								variant="outline"
								disabled={compacting}
								onClick={() => {
									setCompacting(true);
									void store.compactChannelContext(id).finally(() => {
										setCompacting(false);
									});
								}}
							>
								{compacting ? "Compacting…" : "Compact context"}
							</Button>
						</div>
					</section>

					<section
						className="mt-7 border-t pt-6"
						aria-labelledby="channel-pins-heading"
					>
						<div className="flex items-center justify-between">
							<h3
								id="channel-pins-heading"
								className="font-heading text-sm font-bold"
							>
								Pins
							</h3>
							<span className="font-mono text-xs text-muted-foreground">
								{pins.length}
							</span>
						</div>
						<div className="mt-3 grid gap-2">
							{pins.map((pin) => {
								const label =
									pin.note ??
									pin.attachmentId ??
									pin.messageId ??
									"Pinned source";
								return (
									<div
										key={pin.id}
										className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm border bg-muted p-3 text-xs"
									>
										<p className="truncate">{label}</p>
										<button
											type="button"
											className="text-destructive"
											aria-label={`Remove channel pin ${label}`}
											onClick={() => {
												void store.removePin(pin.id);
											}}
										>
											Remove
										</button>
									</div>
								);
							})}
							<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
								<input
									className="min-h-11 rounded-sm border px-3 text-[13px]"
									aria-label="New channel pin note"
									placeholder="Pin a channel note"
									value={pinNote}
									onChange={(event) => {
										setPinNote(event.target.value);
									}}
								/>
								<Button
									type="button"
									variant="outline"
									disabled={pinNote.trim() === ""}
									onClick={() => {
										const note = pinNote.trim();
										if (note === "") return;
										void store.addPin({
											scope: { kind: "channel", id },
											kind: "note",
											note,
										});
										setPinNote("");
									}}
								>
									Pin
								</Button>
							</div>
						</div>
					</section>

					<section className="mt-7 border-t pt-6">
						<Button
							type="button"
							variant="destructive"
							onClick={() => {
								setRemoveConfirmOpen(true);
							}}
						>
							Remove channel
						</Button>
					</section>
				</div>
				<footer className="flex justify-end gap-2 border-t bg-muted px-5 py-3">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? "Saving…" : "Save changes"}
					</Button>
				</footer>
			</form>
			<ConfirmActionDialog
				open={removeConfirmOpen}
				title={`Remove ${channel.name}?`}
				description="This can be added again later. Existing local agent credentials stay untouched."
				onOpenChange={setRemoveConfirmOpen}
				onConfirm={async () => {
					await store.mutate({ action: "remove-channel", channelId: id });
					onClose();
				}}
			/>
		</aside>
	);
}

const capabilityGroups = [
	["Tools", "Executable toolsets"],
	["MCP integrations", "Native configured servers"],
	["Skills", "Profile knowledge and workflows"],
	["Connected services", "Service-class toolsets"],
] as const;

export function AgentSettingsPane({
	bootstrap,
	id,
	store,
	onClose,
}: SettingsPaneProps) {
	const agent = bootstrap.agents.find((candidate) => candidate.id === id);
	const [displayName, setDisplayName] = useState(agent?.displayName ?? "");
	const [avatarEmoji, setAvatarEmoji] = useState(agent?.avatarEmoji ?? "");
	const [accentColor, setAccentColor] = useState(
		agent?.accentColor ?? "#4a154b",
	);
	const [saving, setSaving] = useState(false);
	const [saveState, setSaveState] = useState(
		"Unsaved changes stay local until verified.",
	);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

	useEffect(() => {
		if (agent === undefined) return;
		setDisplayName(agent.displayName);
		setAvatarEmoji(agent.avatarEmoji ?? "");
		setAccentColor(agent.accentColor ?? "#4a154b");
	}, [agent]);

	if (agent === undefined) return null;
	const previewAgent: CommonspaceAgentProfile = {
		...agent,
		displayName: displayName || agent.displayName,
		accentColor,
	};
	if (avatarEmoji !== "") previewAgent.avatarEmoji = avatarEmoji;

	const save = async () => {
		if (saving || displayName.trim() === "") return;
		setSaving(true);
		try {
			await store.mutate({
				action: "update-agent-profile",
				agentId: id,
				displayName: displayName.trim(),
				avatarEmoji,
				accentColor,
			});
			setSaveState(
				"Workspace identity saved. Native harness profile verified unchanged.",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<aside
			className="commonspace-context-settings flex min-h-0 min-w-[420px] flex-col border-l bg-background"
			aria-label="Agent profile"
		>
			<header className="flex min-h-[76px] items-center gap-3 border-b bg-muted px-4 py-2.5">
				<AgentMark agent={previewAgent} />
				<span className="min-w-0 flex-1">
					<h2 className="block truncate text-[13px] font-bold">
						{previewAgent.displayName}
					</h2>
					<small className="block truncate text-xs text-muted-foreground">
						{runtimeLabel(agent)} ·{" "}
						{agent.status === "running" ? "online" : "configured"}
					</small>
				</span>
				<span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-[10px] text-muted-foreground">
					<i
						className="size-1.5 rounded-full bg-[var(--status-success)]"
						aria-hidden="true"
					/>
					Native profile
				</span>
				<button
					type="button"
					className="grid size-8 shrink-0 place-items-center rounded-sm border-0 bg-transparent text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
					aria-label="Close agent profile"
					onClick={onClose}
				>
					<XIcon className="size-[18px]" aria-hidden="true" />
				</button>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<section className="border-b p-5">
					<header className="mb-3 flex items-start justify-between gap-3">
						<div>
							<p className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
								Commonspace identity
							</p>
							<h3 className="font-heading text-[17px] font-bold">
								Workspace configuration
							</h3>
						</div>
						<span className="font-mono text-xs">Local</span>
					</header>
					<p className="text-xs leading-5 text-muted-foreground">
						Customize how this agent appears in Commonspace. These settings do
						not change the native harness profile.
					</p>
					<div className="mt-4 grid gap-3 [&_input]:min-h-11 [&_input]:rounded-sm [&_input]:border [&_input]:px-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-xs [&_label]:font-semibold">
						<div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4">
							<AgentMark agent={previewAgent} large />
							<label>
								Workspace name
								<input
									aria-label="Workspace name"
									value={displayName}
									onChange={(event) => {
										setDisplayName(event.target.value);
										setSaveState("Unsaved changes stay local until verified.");
									}}
								/>
							</label>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="grid gap-1.5 text-xs font-semibold">
								<span>Avatar emoji</span>
								<AvatarEmojiPicker
									value={avatarEmoji}
									onChange={(value) => {
										setAvatarEmoji(value);
										setSaveState("Unsaved changes stay local until verified.");
									}}
								/>
							</div>
							<label>
								Background color
								<span className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
									<input
										className="p-1"
										type="color"
										aria-label="Avatar background color"
										value={accentColor}
										onChange={(event) => {
											setAccentColor(event.target.value);
											setSaveState(
												"Unsaved changes stay local until verified.",
											);
										}}
									/>
									<input
										aria-label="Avatar background hex value"
										value={accentColor.toLocaleUpperCase()}
										onChange={(event) => {
											if (/^#[0-9a-f]{6}$/iu.test(event.target.value))
												setAccentColor(event.target.value);
										}}
									/>
								</span>
							</label>
						</div>
					</div>
				</section>

				<section className="border-b p-5">
					<header className="mb-3 flex items-start justify-between gap-3">
						<div>
							<p className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
								Harness profile
							</p>
							<h3 className="font-heading text-[17px] font-bold">
								Harness configuration
							</h3>
						</div>
						<span className="rounded-full border px-2 py-1 font-mono text-[10px] text-muted-foreground">
							Read from {runtimeLabel(agent)}
						</span>
					</header>
					<p className="text-xs leading-5 text-muted-foreground">
						Model, reasoning, credentials, and processing mode stay owned by the
						selected native profile.
					</p>
					<div className="mt-4 grid grid-cols-2 gap-3 [&_input]:min-h-11 [&_input]:rounded-sm [&_input]:border [&_input]:bg-muted [&_input]:px-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-xs [&_label]:font-semibold">
						<label>
							Model
							<input
								aria-label="Native model"
								readOnly
								value={agent.model ?? "Profile default"}
							/>
						</label>
						<label>
							Runtime
							<input
								aria-label="Native runtime"
								readOnly
								value={runtimeLabel(agent)}
							/>
						</label>
					</div>
					<p className="mt-3 inline-flex items-center gap-2 text-xs text-[var(--status-success)]">
						<CheckIcon className="size-4" aria-hidden="true" />
						Configuration verified from the native profile
					</p>
				</section>

				<section className="border-b p-5">
					<header className="mb-3 flex items-start justify-between gap-3">
						<div>
							<p className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
								Harness inventory
							</p>
							<h3 className="font-heading text-[17px] font-bold">
								Capabilities
							</h3>
						</div>
						<span className="font-mono text-xs">Native</span>
					</header>
					<p className="text-xs leading-5 text-muted-foreground">
						Commonspace shows capability ownership without recreating a second
						permission system.
					</p>
					<div className="mt-4 grid gap-2">
						{capabilityGroups.map(([title, description], index) => (
							<details
								key={title}
								open={index === 0}
								className="rounded-md border bg-background p-3"
							>
								<summary className="cursor-pointer list-none">
									<span className="flex items-center justify-between gap-3">
										<span>
											<strong className="block text-[13px]">{title}</strong>
											<small className="block text-xs text-muted-foreground">
												{description}
											</small>
										</span>
										<b className="font-mono text-[10px] text-muted-foreground">
											Native
										</b>
									</span>
								</summary>
								<div className="mt-3 grid gap-1 border-t pt-3 text-xs text-muted-foreground">
									<span>Source</span>
									<strong className="text-foreground">
										{runtimeLabel(agent)} native inventory
									</strong>
									<em className="not-italic">
										Enabled and blocked states remain owned by the harness
									</em>
								</div>
							</details>
						))}
					</div>
				</section>

				<section className="p-5">
					<Button
						variant="destructive"
						onClick={() => {
							setRemoveConfirmOpen(true);
						}}
					>
						Remove from Commonspace
					</Button>
					<p className="mt-2 text-xs text-muted-foreground">
						The native harness profile and its credentials remain untouched.
					</p>
				</section>
			</div>
			<footer className="flex min-h-[68px] items-center gap-3 border-t bg-muted px-[18px] py-2.5">
				<span className="min-w-0 flex-1 text-xs text-muted-foreground">
					{saveState}
				</span>
				<Button
					disabled={saving || displayName.trim() === ""}
					onClick={() => {
						void save();
					}}
				>
					{saving ? "Saving…" : "Save and verify"}
				</Button>
			</footer>
			<ConfirmActionDialog
				open={removeConfirmOpen}
				title={`Remove ${agent.displayName}?`}
				description="This can be added again later. The native harness profile and its credentials remain untouched."
				onOpenChange={setRemoveConfirmOpen}
				onConfirm={async () => {
					await store.mutate({ action: "remove-agent", agentId: id });
					onClose();
				}}
			/>
		</aside>
	);
}
