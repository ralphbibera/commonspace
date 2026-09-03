import {
	type AgentAdapterKind,
	type CommonspaceAgentProfile,
	type CommonspaceDiagnostics,
	type CommonspaceMutation,
	type CommonspaceNotificationSettings,
	type CommonspaceReasoning,
	type CommonspaceRetentionPreview,
	type CommonspaceRoutingProvider,
	type CommonspaceSearchResult,
	type CommonspaceWorkspaceArchive,
	type UpdateRoutingConfigurationRequest,
	DEFAULT_COMMONSPACE_NOTIFICATION_SETTINGS,
	deriveCommonspaceInboxItems,
} from "@commonspace/shared";
import {
	ArrowRightIcon,
	ChevronDownIcon,
	InboxIcon,
	MessagesSquareIcon,
	MoreHorizontalIcon,
	RefreshCwIcon,
	SettingsIcon,
} from "lucide-react";
import {
	type FormEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	CollectionActionMenu,
	type CommonspaceCollectionKind,
} from "@/design-system/CollectionActionMenu";
import { CommonspaceLogo } from "@/design-system/CommonspaceLogo";
import { WorkspaceHeader } from "@/design-system/WorkspaceHeader";
import { cn } from "@/lib/utils";
import type { CommonspaceDirectoryKind } from "./CommonspaceDirectory.tsx";
import { CommonspaceSearchDialog } from "./CommonspaceSearch.tsx";
import type { CommonspaceStore } from "./commonspace-store.ts";
import { folderName } from "./project-files-api.ts";
import {
	collectionKey,
	sidebarPreferencesStore,
	useSidebarPreferences,
} from "./sidebar-preferences.ts";
import type { CommonspaceColorMode } from "./theme.ts";

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

export interface CommonspaceSidebarProps {
	wide: boolean;
	expandSidebar: () => void;
	store: CommonspaceStore;
	colorMode?: CommonspaceColorMode;
	onSetColorMode?: (mode: CommonspaceColorMode) => void;
	homeActive?: boolean;
	inboxActive?: boolean;
	threadsActive?: boolean;
	createRequest?: { kind: CommonspaceCollectionKind; token: number } | null;
	onOpenHome?: () => void;
	onOpenSearch?: () => void;
	onOpenInbox?: () => void;
	onOpenThreads?: () => void;
	onOpenDirectory?: (kind: CommonspaceDirectoryKind) => void;
	onOpenContextSettings?: (kind: CommonspaceCollectionKind, id: string) => void;
	onMentionAgent?: (agentName: string) => void;
	onOpenAgentSessions?: () => void;
	onOpenProject?: (
		projectId: string,
		file?: { rootIndex: number; path: string },
	) => void;
	onOpenConversation?: (messageId?: string) => void;
}

function Section(props: {
	title: string;
	count: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAdd?: () => void;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-2 border-t border-sidebar-border pt-1 first:mt-2 first:border-t-0">
			<div className="grid grid-cols-[minmax(0,1fr)_44px] items-center">
				<button
					type="button"
					className="flex min-h-11 w-full items-center gap-2 rounded-md border-0 bg-transparent px-1.5 text-left text-[13px] font-bold text-sidebar-foreground/85 hover:text-sidebar-foreground"
					aria-expanded={props.open}
					onClick={() => {
						props.onOpenChange(!props.open);
					}}
				>
					<ChevronDownIcon
						className={`size-[18px] transition-transform ${props.open ? "" : "-rotate-90"}`}
						aria-hidden="true"
					/>
					<span>{props.title}</span>
					<span className="ml-auto grid h-[22px] min-w-6 place-items-center rounded-full border border-sidebar-border bg-sidebar-accent px-1.5 font-mono text-xs font-normal text-sidebar-foreground/70">
						{props.count}
					</span>
				</button>
				{props.onAdd !== undefined && (
					<button
						type="button"
						className="grid size-11 place-items-center rounded-sm border-0 bg-transparent text-[22px] text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
						aria-label={`Add ${props.title.slice(0, -1).toLowerCase()}`}
						onClick={props.onAdd}
					>
						+
					</button>
				)}
			</div>
			{props.open && <div className="grid gap-0.5">{props.children}</div>}
		</section>
	);
}

function NavGroupLabel({ label, count }: { label: string; count: number }) {
	return (
		<p className="flex items-center justify-between gap-2 mt-1 mr-2 mb-px ml-[34px] text-xs font-semibold text-sidebar-foreground/55">
			<span>{label}</span>
			<span className="font-mono font-normal">{count}</span>
		</p>
	);
}

function BrowseButton({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className="mt-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border-0 border-t border-sidebar-border bg-transparent px-2 pt-2 text-left text-[13px] font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
			aria-label={label}
			onClick={onClick}
		>
			<span className="truncate">{label}</span>
			<ArrowRightIcon
				className="size-4 text-sidebar-foreground/50"
				aria-hidden="true"
			/>
		</button>
	);
}

function SettingsSectionHeading({
	number,
	title,
	description,
}: {
	number: number;
	title: string;
	description: string;
}) {
	return (
		<div className="mb-5 flex items-start gap-3">
			<span
				className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground"
				aria-hidden="true"
			>
				{number}
			</span>
			<div>
				<h2 className="font-heading text-[17px] font-bold tracking-[-0.01em]">
					{title}
				</h2>
				<p className="mt-1 text-xs text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}

function SidebarDialog({
	title,
	description,
	onClose,
	children,
}: {
	title: string;
	description?: string;
	onClose: () => void;
	children: React.ReactNode;
}) {
	const restoreFocusRef = useRef<HTMLElement | null>(
		typeof document !== "undefined" &&
			document.activeElement instanceof HTMLElement
			? document.activeElement
			: null,
	);
	useEffect(
		() => () => {
			if (restoreFocusRef.current?.isConnected === true)
				restoreFocusRef.current.focus();
		},
		[],
	);

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				closeLabel={`Close ${title}`}
				aria-describedby={undefined}
				className="top-[10vh] max-h-[80vh] -translate-y-0 sm:max-w-[640px]"
			>
				<DialogHeader className="border-b px-[18px] py-4">
					<DialogTitle>{title}</DialogTitle>
					{description === undefined ? null : (
						<DialogDescription>{description}</DialogDescription>
					)}
				</DialogHeader>
				<div className="min-h-0 overflow-y-auto p-[18px]">{children}</div>
			</DialogContent>
		</Dialog>
	);
}

function FormError({ message }: { message: string | null }) {
	return message === null ? null : (
		<p className="text-xs text-destructive" role="alert">
			{message}
		</p>
	);
}

function runtimeLabel(adapter: AgentAdapterKind): string {
	if (adapter === "codex") return "Codex";
	return "Hermes";
}

function agentStatusLabel(status: CommonspaceAgentProfile["status"]): string {
	if (status === "running") return "online";
	if (status === "unknown") return "configured";
	return "available";
}

function AgentAvatar({ agent }: { agent: CommonspaceAgentProfile }) {
	return (
		<span
			className="relative grid size-9 place-items-center rounded-sm border bg-background font-mono text-xs font-semibold text-foreground"
			style={
				agent.accentColor === undefined
					? undefined
					: { backgroundColor: agent.accentColor, color: "#fff" }
			}
			aria-hidden="true"
		>
			{agent.avatarEmoji ?? agent.displayName.slice(0, 1).toLocaleUpperCase()}
			<i
				className={cn(
					"absolute right-[-2px] bottom-[-2px] size-2 rounded-full border border-background bg-muted-foreground",
					agent.status === "running" && "bg-[var(--status-success)]",
				)}
			/>
		</span>
	);
}

function copyText(value: string) {
	void navigator.clipboard?.writeText(value).catch(() => undefined);
}

function orderedSidebarItems<Item extends { id: string }>(
	items: readonly Item[],
	kind: CommonspaceCollectionKind,
	pinnedKeys: readonly string[],
	recentKeys: readonly string[],
): { items: Item[]; pinnedCount: number } {
	const byId = new Map(items.map((item) => [item.id, item]));
	const pinned = pinnedKeys
		.filter((key) => key.startsWith(`${kind}:`))
		.map((key) => byId.get(key.slice(kind.length + 1)))
		.filter((item): item is Item => item !== undefined);
	const pinnedIds = new Set(pinned.map((item) => item.id));
	const recent = [
		...recentKeys,
		...items.map((item) => collectionKey(kind, item.id)),
	]
		.map((key) => {
			if (!key.startsWith(`${kind}:`)) return undefined;
			return byId.get(key.slice(kind.length + 1));
		})
		.filter(
			(item): item is Item => item !== undefined && !pinnedIds.has(item.id),
		)
		.filter(
			(item, index, values) =>
				values.findIndex((candidate) => candidate.id === item.id) === index,
		)
		.slice(0, 3);
	return { items: [...pinned, ...recent], pinnedCount: pinned.length };
}

export function CommonspaceSidebar({
	wide,
	expandSidebar,
	store,
	colorMode = "light",
	onSetColorMode,
	homeActive = false,
	inboxActive = false,
	threadsActive = false,
	createRequest = null,
	onOpenHome,
	onOpenSearch,
	onOpenInbox,
	onOpenThreads,
	onOpenDirectory,
	onOpenContextSettings,
	onMentionAgent,
	onOpenAgentSessions,
	onOpenProject,
	onOpenConversation,
}: CommonspaceSidebarProps) {
	const snapshot = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
	const preferences = useSidebarPreferences();
	const [form, setForm] = useState<"project" | "channel" | "agent" | null>(
		null,
	);
	const [formError, setFormError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [path, setPath] = useState("");
	const [selectingPath, setSelectingPath] = useState(false);
	const [pathProjectId, setPathProjectId] = useState<string | null>(null);
	const [pathDraft, setPathDraft] = useState("");
	const [agentIds, setAgentIds] = useState<string[]>([]);
	const [channelAgentQuery, setChannelAgentQuery] = useState("");
	const [channelAgentFilter, setChannelAgentFilter] = useState<
		"all" | "selected"
	>("all");
	const [agentAdapter, setAgentAdapter] = useState<AgentAdapterKind | null>(
		null,
	);
	const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
	const [agentProfileName, setAgentProfileName] = useState("");
	const [agentAvatarEmoji, setAgentAvatarEmoji] = useState("");
	const [agentAccentColor, setAgentAccentColor] = useState("#6d5dfc");
	const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
	const [channelAgentIds, setChannelAgentIds] = useState<string[]>([]);
	const [channelInstructions, setChannelInstructions] = useState("");
	const [channelModel, setChannelModel] = useState("");
	const [channelReasoning, setChannelReasoning] = useState<
		CommonspaceReasoning | ""
	>("");
	const [channelSummary, setChannelSummary] = useState("");
	const [channelDecisions, setChannelDecisions] = useState("");
	const [channelQuestions, setChannelQuestions] = useState("");
	const [channelPinNote, setChannelPinNote] = useState("");
	const [compactingChannelId, setCompactingChannelId] = useState<string | null>(
		null,
	);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [defaultModel, setDefaultModel] = useState("");
	const [defaultReasoning, setDefaultReasoning] =
		useState<CommonspaceReasoning>("max");
	const [defaultMaxAgents, setDefaultMaxAgents] = useState(4);
	const [defaultMemoryThreads, setDefaultMemoryThreads] = useState(12);
	const [routingProvider, setRoutingProvider] =
		useState<CommonspaceRoutingProvider>("openai-compatible");
	const [routingHarnessAgentId, setRoutingHarnessAgentId] = useState("");
	const [routingModel, setRoutingModel] = useState("");
	const [routingBaseUrl, setRoutingBaseUrl] = useState(
		"https://api.openai.com/v1",
	);
	const [routingApiKey, setRoutingApiKey] = useState("");
	const [clearRoutingApiKey, setClearRoutingApiKey] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [diagnostics, setDiagnostics] = useState<CommonspaceDiagnostics | null>(
		null,
	);
	const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
	const [inferenceChecking, setInferenceChecking] = useState(false);
	const [inferenceCheckStatus, setInferenceCheckStatus] = useState<
		string | null
	>(null);
	const [inferenceCheckOk, setInferenceCheckOk] = useState<boolean | null>(null);
	const [importArchive, setImportArchive] =
		useState<CommonspaceWorkspaceArchive | null>(null);
	const [importMappings, setImportMappings] = useState<
		Record<string, string[]>
	>({});
	const [importingWorkspace, setImportingWorkspace] = useState(false);
	const [retentionConversation, setRetentionConversation] = useState("");
	const [retentionPreview, setRetentionPreview] =
		useState<CommonspaceRetentionPreview | null>(null);
	const [notificationSettings, setNotificationSettings] =
		useState<CommonspaceNotificationSettings>({
			...DEFAULT_COMMONSPACE_NOTIFICATION_SETTINGS,
		});
	const [savingNotifications, setSavingNotifications] = useState(false);

	useEffect(() => {
		void store.refresh();
	}, [store]);
	useEffect(() => {
		setInferenceCheckStatus(null);
		setInferenceCheckOk(null);
	}, [
		routingProvider,
		routingHarnessAgentId,
		routingModel,
		routingBaseUrl,
		routingApiKey,
		clearRoutingApiKey,
	]);
	useEffect(() => {
		void homeActive;
		void inboxActive;
		void snapshot.activeConversation;
		void snapshot.activeProjectId;
		void threadsActive;
		setSettingsOpen(false);
	}, [
		homeActive,
		inboxActive,
		snapshot.activeConversation,
		snapshot.activeProjectId,
		threadsActive,
	]);
	useEffect(() => {
		if (createRequest === null) return;
		setForm(createRequest.kind);
		setFormError(null);
		setName("");
		if (createRequest.kind === "project") setPath("");
		if (createRequest.kind === "channel") {
			setAgentIds([]);
			setChannelAgentQuery("");
			setChannelAgentFilter("all");
		}
		if (createRequest.kind === "agent") setAgentAdapter(null);
	}, [createRequest]);
	useEffect(() => {
		const openSearch = (event: KeyboardEvent) => {
			if (
				!(event.metaKey || event.ctrlKey) ||
				event.key.toLocaleLowerCase() !== "k"
			)
				return;
			event.preventDefault();
			if (onOpenSearch === undefined) setSearchOpen(true);
			else onOpenSearch();
		};
		window.addEventListener("keydown", openSearch);
		return () => {
			window.removeEventListener("keydown", openSearch);
		};
	}, [onOpenSearch]);
	const bootstrap = snapshot.bootstrap;
	const state = bootstrap?.state;
	const inboxItems = useMemo(
		() => (state === undefined ? [] : deriveCommonspaceInboxItems(state)),
		[state],
	);
	const inboxUnreadCount = inboxItems.filter((item) => item.unread).length;
	const threadUnreadCount = new Set(
		inboxItems
			.filter((item) => item.unread && item.threadId !== undefined)
			.map((item) => item.threadId),
	).size;
	const channelUnreadCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const item of inboxItems) {
			if (!item.unread || item.conversation.kind !== "channel") continue;
			counts.set(
				item.conversation.id,
				(counts.get(item.conversation.id) ?? 0) + 1,
			);
		}
		return counts;
	}, [inboxItems]);
	const agents = bootstrap?.agents ?? [];
	const normalizedChannelAgentQuery = channelAgentQuery
		.trim()
		.toLocaleLowerCase();
	const availableChannelAgents = agents.filter((agent) => {
		if (channelAgentFilter === "selected" && !agentIds.includes(agent.id))
			return false;
		return (
			normalizedChannelAgentQuery === "" ||
			`${agent.displayName} ${agent.adapter} ${agent.model ?? ""}`
				.toLocaleLowerCase()
				.includes(normalizedChannelAgentQuery)
		);
	});
	const activeAgentIds = new Set(
		(bootstrap?.liveActivities ?? []).map((activity) => activity.agentId),
	);
	const discoveredAgents = bootstrap?.discoveredAgents ?? [];
	const configuredAgentIds = new Set(agents.map((agent) => agent.id));
	const availableDiscoveredAgents = discoveredAgents.filter(
		(agent) =>
			agent.adapter === agentAdapter && !configuredAgentIds.has(agent.id),
	);
	const models = useMemo(
		() => [
			...new Set(
				agents
					.map((agent) => agent.model)
					.filter((model): model is string => model !== null && model !== ""),
			),
		],
		[agents],
	);
	const projects = state?.projects ?? [];
	const channels = state?.channels ?? [];
	const defaultPinnedKeys = useMemo(
		() =>
			[
				projects[0] === undefined
					? undefined
					: collectionKey("project", projects[0].id),
				channels[0] === undefined
					? undefined
					: collectionKey("channel", channels[0].id),
				agents[0] === undefined
					? undefined
					: collectionKey("agent", agents[0].id),
			].filter((key): key is string => key !== undefined),
		[agents, channels, projects],
	);
	const effectivePinnedKeys = preferences.hasStoredPins
		? preferences.pinnedKeys
		: defaultPinnedKeys;
	const projectItems = orderedSidebarItems(
		projects,
		"project",
		effectivePinnedKeys,
		preferences.recentKeys.project,
	);
	const channelItems = orderedSidebarItems(
		channels,
		"channel",
		effectivePinnedKeys,
		preferences.recentKeys.channel,
	);
	const agentItems = orderedSidebarItems(
		agents,
		"agent",
		effectivePinnedKeys,
		preferences.recentKeys.agent,
	);
	useEffect(() => {
		sidebarPreferencesStore.ensurePinnedDefaults(defaultPinnedKeys);
	}, [defaultPinnedKeys]);
	const activeMentionChannel =
		snapshot.activeConversation?.kind === "channel"
			? channels.find(
					(channel) => channel.id === snapshot.activeConversation?.id,
				)
			: undefined;
	const collectionPinned = (kind: CommonspaceCollectionKind, id: string) =>
		effectivePinnedKeys.includes(collectionKey(kind, id));
	const toggleCollectionPinned = (
		kind: CommonspaceCollectionKind,
		id: string,
	) => {
		sidebarPreferencesStore.togglePin(kind, id, defaultPinnedKeys);
	};
	const touchRecent = (kind: CommonspaceCollectionKind, id: string) => {
		sidebarPreferencesStore.touchRecent(kind, id, defaultPinnedKeys);
	};

	if (!wide) {
		return (
			<button
				type="button"
				className="grid h-full w-14 place-items-start bg-sidebar pt-4"
				aria-label="Expand Commonspace sidebar"
				onClick={expandSidebar}
			>
				<CommonspaceLogo decorative className="size-6" />
			</button>
		);
	}

	const chooseProjectDirectory = async () => {
		setSelectingPath(true);
		try {
			const selectedPath = await store.selectDirectory();
			if (selectedPath !== null) {
				setPath(selectedPath);
				setName((current) =>
					current.trim() === "" ? folderName(selectedPath) : current,
				);
			}
		} catch {
			// The application-level toast renders the store error once.
		} finally {
			setSelectingPath(false);
		}
	};

	const selectAgentHarness = (adapter: AgentAdapterKind) => {
		setAgentAdapter(adapter);
		setName("");
		void store.discoverAgents(adapter);
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setFormError(null);
		let mutation: CommonspaceMutation;
		if (form === "project") {
			if (name.trim() === "" || path.trim() === "") {
				setFormError("Project name and local folder are required.");
				return;
			}
			mutation = { action: "create-project", name, paths: [path] };
		} else if (form === "channel") {
			if (name.trim() === "") {
				setFormError("Channel name is required.");
				return;
			}
			mutation = {
				action: "create-channel",
				name,
				agentIds,
			};
		} else return;
		try {
			await store.mutate(mutation);
		} catch (error) {
			// Keep the form open while the application-level toast shows the error.
			setFormError(error instanceof Error ? error.message : String(error));
			return;
		}
		setForm(null);
		setFormError(null);
		setName("");
		setPath("");
		setAgentIds([]);
	};

	const submitPath = async (event: FormEvent, targetProjectId: string) => {
		event.preventDefault();
		await store.mutate({
			action: "add-project-path",
			projectId: targetProjectId,
			path: pathDraft,
		});
		setPathProjectId(null);
		setPathDraft("");
	};

	const saveChannelAgents = async (event: FormEvent, channelId: string) => {
		event.preventDefault();
		await store.mutate({
			action: "set-channel-configuration",
			channelId,
			agentIds: channelAgentIds,
			instructions: channelInstructions,
			model: channelModel || null,
			reasoning: channelReasoning || null,
			summary: channelSummary,
			decisions: channelDecisions
				.split("\n")
				.map((value) => value.trim())
				.filter(Boolean),
			openQuestions: channelQuestions
				.split("\n")
				.map((value) => value.trim())
				.filter(Boolean),
		});
		setEditingChannelId(null);
	};

	const compactChannelContext = async (channelId: string) => {
		if (compactingChannelId !== null) return;
		setCompactingChannelId(channelId);
		try {
			await store.compactChannelContext(channelId);
		} finally {
			setCompactingChannelId(null);
		}
	};

	const addChannelPin = async (channelId: string) => {
		const note = channelPinNote.trim();
		if (note === "") return;
		await store.addPin({
			scope: { kind: "channel", id: channelId },
			kind: "note",
			note,
		});
		setChannelPinNote("");
	};

	const routingUpdateRequest = (): UpdateRoutingConfigurationRequest =>
		routingProvider === "harness"
			? { provider: "harness", harnessAgentId: routingHarnessAgentId }
			: {
					provider: "openai-compatible",
					model: routingModel,
					baseUrl: routingBaseUrl,
					...(clearRoutingApiKey
						? { apiKey: null }
						: routingApiKey.trim() === ""
							? {}
							: { apiKey: routingApiKey }),
				};

	const saveDefaults = async (event: FormEvent) => {
		event.preventDefault();
		const request = {
			routing: routingUpdateRequest(),
			defaults: {
				model: defaultModel || null,
				reasoning: defaultReasoning,
				maxAgentsPerTurn: defaultMaxAgents,
				memoryThreads: defaultMemoryThreads,
			},
		};
		if (typeof store.updateWorkspaceSettings === "function") {
			await store.updateWorkspaceSettings(request);
		} else {
			await store.updateRoutingConfiguration(request.routing);
			await store.mutate({ action: "set-defaults", ...request.defaults });
		}
		setSettingsOpen(false);
	};

	const saveNotifications = async () => {
		if (savingNotifications) return;
		setSavingNotifications(true);
		try {
			await store.mutate({
				action: "set-notifications",
				notifications: notificationSettings,
			});
		} finally {
			setSavingNotifications(false);
		}
	};

	const runDiagnostics = async () => {
		if (diagnosticsLoading) return;
		setDiagnosticsLoading(true);
		try {
			setDiagnostics(await store.diagnostics());
		} finally {
			setDiagnosticsLoading(false);
		}
	};

	const checkInferenceConfiguration = async () => {
		if (inferenceChecking) return;
		setInferenceChecking(true);
		setInferenceCheckOk(null);
		setInferenceCheckStatus("Checking unsaved configuration…");
		try {
			const result =
				typeof store.validateRoutingConfiguration === "function"
					? await store.validateRoutingConfiguration(routingUpdateRequest())
					: (await store.diagnostics()).inference;
			setInferenceCheckOk(result.configured);
			setInferenceCheckStatus(
				result.configured
					? `Configuration verified · ${result.provider}`
					: "Configuration needs attention",
			);
		} catch {
			setInferenceCheckOk(false);
			setInferenceCheckStatus("Configuration check failed");
		} finally {
			setInferenceChecking(false);
		}
	};

	const exportWorkspace = async () => {
		const archive = await store.exportWorkspace();
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(archive, null, 2)], {
				type: "application/json",
			}),
		);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = "commonspace-export.json";
		anchor.click();
		URL.revokeObjectURL(url);
	};

	const selectImportArchive = (file: File | undefined) => {
		if (file === undefined) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const archive: CommonspaceWorkspaceArchive = JSON.parse(
					String(reader.result),
				);
				if (
					archive.format !== "commonspace-workspace" ||
					archive.version !== 1 ||
					!Array.isArray(archive.workspace.projects)
				)
					throw new Error("invalid archive");
				if (
					archive.workspace.projects.some(
						(project) =>
							!Number.isSafeInteger(project.rootCount) ||
							project.rootCount < 1 ||
							project.rootCount > 32,
					)
				)
					throw new Error("invalid archive Project roots");
				setImportArchive(archive);
				setImportMappings(
					Object.fromEntries(
						archive.workspace.projects.map((project) => [
							project.id,
							Array.from({ length: project.rootCount }, () => ""),
						]),
					),
				);
			} catch {
				setImportArchive(null);
				setImportMappings({});
			}
		};
		reader.readAsText(file);
	};

	const chooseImportRoot = async (projectId: string, rootIndex: number) => {
		const path = await store.selectDirectory();
		if (path === null) return;
		setImportMappings((current) => ({
			...current,
			[projectId]: (current[projectId] ?? []).map((value, index) =>
				index === rootIndex ? path : value,
			),
		}));
	};

	const importWorkspace = async () => {
		if (importArchive === null || importingWorkspace) return;
		setImportingWorkspace(true);
		try {
			await store.importWorkspace(importArchive, importMappings);
			setImportArchive(null);
			setImportMappings({});
			setSettingsOpen(false);
		} finally {
			setImportingWorkspace(false);
		}
	};

	const previewRetention = async () => {
		const separator = retentionConversation.indexOf(":");
		const kind = retentionConversation.slice(0, separator);
		const id = separator < 1 ? "" : retentionConversation.slice(separator + 1);
		if ((kind !== "channel" && kind !== "dm") || id === "") return;
		setRetentionPreview(await store.previewRetention({ kind, id }));
	};

	const applyRetention = async () => {
		if (
			retentionPreview === null ||
			!window.confirm(
				"Permanently remove the previewed conversation history and attachment bytes?",
			)
		)
			return;
		await store.applyRetention(retentionPreview);
		setRetentionPreview(null);
	};

	const saveAgentProfile = async (event: FormEvent, agentId: string) => {
		event.preventDefault();
		await store.mutate({
			action: "update-agent-profile",
			agentId,
			displayName: agentProfileName,
			avatarEmoji: agentAvatarEmoji,
			accentColor: agentAccentColor,
		});
		setEditingAgentId(null);
	};

	const startDirectMessage = (agentId: string) => {
		onOpenConversation?.();
		store.selectConversation({ kind: "dm", id: agentId });
		setForm(null);
	};

	const openSearchResult = (result: CommonspaceSearchResult) => {
		if (result.target.kind === "conversation") {
			store.selectConversation(result.target.conversation);
			store.selectThread(result.target.threadId ?? null);
			onOpenConversation?.(result.target.messageId);
		} else if (result.target.kind === "project-file") {
			store.selectProject(result.target.projectId);
			onOpenProject?.(result.target.projectId, {
				rootIndex: result.target.rootIndex,
				path: result.target.path,
			});
		} else {
			store.selectConversation({ kind: "dm", id: result.target.agentId });
			onOpenConversation?.();
		}
		setSearchOpen(false);
	};

	return (
		<section
			className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground"
			aria-label="Commonspace browser"
		>
			{onOpenSearch === undefined && (
				<header className="grid gap-2 border-b border-sidebar-border p-3">
					<button
						type="button"
						className="grid min-h-11 grid-cols-[28px_minmax(0,1fr)_24px] items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
						aria-label="Open Commonspace home"
						aria-current={homeActive ? "page" : undefined}
						onClick={onOpenHome}
					>
						<CommonspaceLogo decorative className="size-6" />
						<span className="min-w-0">
							<strong className="block truncate text-[13px]">Workspace</strong>
							<small className="block truncate text-xs text-sidebar-foreground/60">
								Commonspace
							</small>
						</span>
						<span aria-hidden="true">•••</span>
					</button>
					<button
						type="button"
						className="grid min-h-11 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-3 text-left text-sidebar-foreground/75"
						aria-label="Search Commonspace"
						onClick={() => {
							setSearchOpen(true);
						}}
					>
						<span aria-hidden="true">⌕</span>
						<span className="truncate">Search everything</span>
						<kbd>⌘K</kbd>
					</button>
				</header>
			)}

			{onOpenSearch === undefined && searchOpen && (
				<CommonspaceSearchDialog
					projects={projects}
					onClose={() => {
						setSearchOpen(false);
					}}
					onSelect={openSearchResult}
				/>
			)}

			{snapshot.loading && bootstrap === null && (
				<div className="p-4 text-xs text-sidebar-foreground/60">
					Loading agents…
				</div>
			)}
			{settingsOpen &&
				state !== undefined &&
				createPortal(
					<form
						aria-label="Workspace settings"
						className="fixed top-[52px] right-0 bottom-0 left-[260px] z-40 flex min-h-0 flex-col overflow-hidden bg-background text-foreground max-[780px]:left-0"
						onSubmit={(event) => {
							void saveDefaults(event);
						}}
					>
						<WorkspaceHeader title="Workspace settings" mark="S" />
						<div className="min-h-0 flex-1 overflow-y-auto">
							<div className="mx-auto grid w-full max-w-[860px] gap-0 px-0 py-12 pb-20 max-[920px]:px-6 max-[640px]:px-4 [&_button]:min-h-11 [&_button]:rounded-sm [&_button]:border [&_button]:px-4 [&_fieldset]:min-w-0 [&_input:not([type=checkbox])]:min-h-11 [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-md [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:bg-background [&_input:not([type=checkbox])]:px-3 [&_label]:grid [&_label]:gap-1.5 [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:p-3">
								<section
									className="mb-10 rounded-lg border bg-card p-5"
									aria-labelledby="workspace-appearance-title"
								>
									<div className="flex items-start justify-between gap-6 max-[640px]:grid">
										<div>
											<span className="font-mono text-xs tracking-[0.06em] text-primary">
												Appearance
											</span>
											<h2
												id="workspace-appearance-title"
												className="mt-2 font-heading text-2xl font-bold tracking-[-0.02em]"
											>
												Choose your color mode
											</h2>
										</div>
										<span className="inline-flex min-h-[30px] shrink-0 items-center rounded-full border bg-muted px-2.5 font-mono text-xs text-muted-foreground">
											{colorMode === "dark"
												? "Dark mode"
												: colorMode === "system"
													? "System mode"
													: "Light mode"}
										</span>
									</div>
									<fieldset
										className="mt-5 grid grid-cols-3 gap-3 max-[640px]:grid-cols-1"
										aria-label="Color mode"
									>
										<button
											type="button"
											aria-pressed={colorMode === "light"}
											className="grid min-h-16 gap-1 bg-background text-left hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10"
											onClick={() => {
												onSetColorMode?.("light");
											}}
										>
											<strong>Light</strong>
											<span className="text-xs font-normal text-muted-foreground">
												Bright canvas and soft neutral surfaces
											</span>
										</button>
										<button
											type="button"
											aria-pressed={colorMode === "dark"}
											className="grid min-h-16 gap-1 bg-background text-left hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10"
											onClick={() => {
												onSetColorMode?.("dark");
											}}
										>
											<strong>Dark</strong>
											<span className="text-xs font-normal text-muted-foreground">
												Low-glare canvas and deeper surfaces
											</span>
										</button>
										<button
											type="button"
											aria-pressed={colorMode === "system"}
											className="grid min-h-16 gap-1 bg-background text-left hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10"
											onClick={() => {
												onSetColorMode?.("system");
											}}
										>
											<strong>System</strong>
											<span className="text-xs font-normal text-muted-foreground">
												Follow your operating system preference
											</span>
										</button>
									</fieldset>
								</section>
								<div className="relative pb-5">
									<span className="font-mono text-xs tracking-[0.06em] text-primary">
										Commonspace inference
									</span>
									<span className="absolute top-0 right-0 inline-flex min-h-[30px] items-center gap-2 rounded-full border px-2.5 font-mono text-xs text-muted-foreground">
										<i
											className="size-[7px] rounded-full bg-muted-foreground"
											aria-hidden="true"
										/>
										Saved configuration
									</span>
									<h2 className="mt-2 max-w-[700px] font-heading text-[36px] leading-[1.12] font-bold tracking-[-0.025em]">
										Choose how the workspace thinks
									</h2>
									<p className="mt-2 max-w-[780px] text-sm leading-6 text-muted-foreground">
										Configure the model Commonspace uses for routing, context
										compaction, and other workspace intelligence. Native agent
										profiles keep their own model settings.
									</p>
								</div>
								<section className="pt-2">
									<SettingsSectionHeading
										number={1}
										title="Inference source"
										description="Use your own OpenAI-compatible endpoint or delegate utility inference to a native agent."
									/>
									<fieldset
										aria-label="Routing engine"
										className="m-0 grid min-w-0 grid-cols-2 gap-3 border-0 p-0 max-[640px]:grid-cols-1"
									>
										<button
											type="button"
											aria-label="Use OpenAI-compatible inference for routing"
											aria-pressed={routingProvider === "openai-compatible"}
											onClick={() => {
												setRoutingProvider("openai-compatible");
												setRoutingHarnessAgentId("");
											}}
											className="relative grid min-h-[94px] grid-cols-[20px_minmax(0,1fr)] items-start gap-3 rounded-md border bg-background p-4 text-left aria-pressed:border-2 aria-pressed:border-primary aria-pressed:bg-[color-mix(in_oklch,var(--primary)_3%,var(--background))]"
										>
											<span
												className={cn(
													"mt-0.5 size-[18px] rounded-full border before:m-auto before:block before:size-2 before:translate-y-1 before:rounded-full",
													routingProvider === "openai-compatible" &&
														"border-primary before:bg-primary",
												)}
												aria-hidden="true"
											/>
											<span>
												<strong className="block text-[13px]">
													OpenAI-compatible API
												</strong>
												<small className="mt-2 block text-xs text-muted-foreground">
													Connect any compatible local or remote provider.
												</small>
											</span>
											{routingProvider === "openai-compatible" && (
												<em className="absolute top-4 right-4 text-xs font-semibold not-italic text-primary">
													Selected
												</em>
											)}
										</button>
										<button
											type="button"
											aria-label="Use native agent inference for routing"
											aria-pressed={routingProvider === "harness"}
											onClick={() => {
												setRoutingProvider("harness");
												if (routingHarnessAgentId === "")
													setRoutingHarnessAgentId(agents[0]?.id ?? "");
											}}
											className="relative grid min-h-[94px] grid-cols-[20px_minmax(0,1fr)] items-start gap-3 rounded-md border bg-background p-4 text-left aria-pressed:border-2 aria-pressed:border-primary aria-pressed:bg-[color-mix(in_oklch,var(--primary)_3%,var(--background))]"
										>
											<span
												className={cn(
													"mt-0.5 size-[18px] rounded-full border before:m-auto before:block before:size-2 before:translate-y-1 before:rounded-full",
													routingProvider === "harness" &&
														"border-primary before:bg-primary",
												)}
												aria-hidden="true"
											/>
											<span>
												<strong className="block text-[13px]">
													Native agent
												</strong>
												<small className="mt-2 block text-xs text-muted-foreground">
													Use one of your installed harness profiles.
												</small>
											</span>
											{routingProvider === "harness" && (
												<em className="absolute top-4 right-4 text-xs font-semibold not-italic text-primary">
													Selected
												</em>
											)}
										</button>
									</fieldset>
									{routingProvider === "harness" && (
										<div className="mt-3 grid gap-2 rounded-md border bg-muted p-3">
											{agents.map((agent) => (
												<button
													key={agent.id}
													type="button"
													aria-label={`Use ${agent.displayName} agent for routing`}
													aria-pressed={routingHarnessAgentId === agent.id}
													onClick={() => {
														setRoutingHarnessAgentId(agent.id);
													}}
													className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3 bg-background text-left aria-pressed:border-primary"
												>
													<AgentAvatar agent={agent} />
													<span>
														<strong className="block text-[13px]">
															{agent.displayName}
														</strong>
														<small className="text-xs text-muted-foreground">
															{runtimeLabel(agent.adapter)} ·{" "}
															{agent.model ?? "harness default"}
														</small>
													</span>
												</button>
											))}
										</div>
									)}
								</section>

								{routingProvider === "openai-compatible" && (
									<section className="mt-8 border-t pt-8">
										<SettingsSectionHeading
											number={2}
											title="Connection"
											description="Credentials stay on this device and are never included in public workspace configuration."
										/>
										<div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
											<label>
												<span className="text-xs font-semibold text-muted-foreground">
													Model ID
												</span>
												<input
													aria-label="Routing model"
													placeholder="gpt-4.1-mini"
													value={routingModel}
													onChange={(event) => {
														setRoutingModel(event.target.value);
													}}
												/>
											</label>
											<label>
												<span className="text-xs font-semibold text-muted-foreground">
													API base URL
												</span>
												<input
													aria-label="Routing API base URL"
													type="url"
													value={routingBaseUrl}
													onChange={(event) => {
														setRoutingBaseUrl(event.target.value);
													}}
												/>
											</label>
										</div>
										<label className="mt-3">
											<span className="text-xs font-semibold text-muted-foreground">
												API key
											</span>
											<input
												aria-label="Routing API key"
												type="password"
												autoComplete="new-password"
												placeholder={
													bootstrap?.routing?.apiKeyConfigured === true
														? "Saved — leave blank to keep"
														: "Optional for local compatible APIs"
												}
												value={routingApiKey}
												onChange={(event) => {
													setRoutingApiKey(event.target.value);
													setClearRoutingApiKey(false);
												}}
											/>
										</label>
										{bootstrap?.routing?.apiKeyConfigured === true && (
											<label className="mt-3 flex min-h-11 grid-cols-none flex-row items-center gap-2 text-xs text-muted-foreground">
												<input
													aria-label="Clear routing API key"
													type="checkbox"
													checked={clearRoutingApiKey}
													onChange={(event) => {
														setClearRoutingApiKey(event.target.checked);
													}}
												/>{" "}
												Clear saved API key
											</label>
										)}
										<div className="mt-4 flex min-h-[72px] items-center justify-between gap-4 rounded-md border bg-muted p-4">
											<div>
												<strong className="block text-[13px]">
													Used by Commonspace
												</strong>
												<p className="mt-1 text-xs text-muted-foreground">
													Message routing · context compaction · workspace
													utilities
												</p>
											</div>
											<button
												type="button"
												disabled={inferenceChecking}
												onClick={() => {
													void checkInferenceConfiguration();
												}}
											>
												{inferenceChecking
													? "Checking…"
													: "Check configuration"}
											</button>
										</div>
										{inferenceCheckStatus !== null && (
											<p
												className={cn("mt-3 inline-flex items-center gap-2 text-xs", inferenceCheckOk === true ? "text-[var(--status-success)]" : inferenceCheckOk === false ? "text-destructive" : "text-muted-foreground")}
												role="status"
												aria-label="Inference configuration status"
											>
												<span aria-hidden="true">{inferenceCheckOk === true ? "✓" : inferenceCheckOk === false ? "!" : "…"}</span>
												{inferenceCheckStatus}
											</p>
										)}
									</section>
								)}

								<fieldset className="mt-8 border-t pt-8">
									<legend className="sr-only">Agent run defaults</legend>
									<SettingsSectionHeading
										number={3}
										title="Agent run defaults"
										description="Defaults apply when a channel or agent profile does not override them."
									/>
									<div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
										<label>
											<span className="text-xs font-semibold text-muted-foreground">
												Model override
											</span>
											<input
												aria-label="Default model"
												list="commonspace-models"
												placeholder="Use each harness default"
												value={defaultModel}
												onChange={(event) => {
													setDefaultModel(event.target.value);
												}}
											/>
										</label>
										<datalist id="commonspace-models">
											{models.map((model) => (
												<option key={model} value={model} />
											))}
										</datalist>
										<label>
											<span className="text-xs font-semibold text-muted-foreground">
												Reasoning
											</span>
											<select
												aria-label="Default reasoning"
												value={defaultReasoning}
												onChange={(event) => {
													if (isReasoning(event.target.value))
														setDefaultReasoning(event.target.value);
												}}
											>
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
										<label>
											<span className="text-xs font-semibold text-muted-foreground">
												Max agents per turn
											</span>
											<input
												aria-label="Default max agents"
												type="number"
												min="1"
												max="8"
												value={defaultMaxAgents}
												onChange={(event) => {
													setDefaultMaxAgents(Number(event.target.value));
												}}
											/>
										</label>
										<label>
											<span className="text-xs font-semibold text-muted-foreground">
												Memory thread window
											</span>
											<input
												aria-label="Default memory threads"
												type="number"
												min="1"
												max="50"
												value={defaultMemoryThreads}
												onChange={(event) => {
													setDefaultMemoryThreads(Number(event.target.value));
												}}
											/>
										</label>
									</div>
								</fieldset>
								<div className="flex justify-end border-t pt-5">
									<button
										type="submit"
										className="border-primary bg-primary font-semibold text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)]"
									>
										Save inference settings
									</button>
								</div>
								<fieldset className="mt-8 grid gap-3 border-t pt-8">
									<legend>OS notifications</legend>
									<p>
										Native alerts are optional. Turning them off never removes
										items from the durable Inbox.
									</p>
									<label>
										<input
											aria-label="Enable OS notifications"
											type="checkbox"
											checked={notificationSettings.enabled}
											onChange={(event) => {
												setNotificationSettings((current) => ({
													...current,
													enabled: event.target.checked,
												}));
											}}
										/>{" "}
										Enable notifications
									</label>
									<label>
										<input
											aria-label="Reply notifications"
											type="checkbox"
											disabled={!notificationSettings.enabled}
											checked={notificationSettings.replies}
											onChange={(event) => {
												setNotificationSettings((current) => ({
													...current,
													replies: event.target.checked,
												}));
											}}
										/>{" "}
										Replies and input requests
									</label>
									<label>
										<input
											aria-label="Mention notifications"
											type="checkbox"
											disabled={!notificationSettings.enabled}
											checked={notificationSettings.mentions}
											onChange={(event) => {
												setNotificationSettings((current) => ({
													...current,
													mentions: event.target.checked,
												}));
											}}
										/>{" "}
										Mentions
									</label>
									<label>
										<input
											aria-label="Permission notifications"
											type="checkbox"
											disabled={!notificationSettings.enabled}
											checked={notificationSettings.permissions}
											onChange={(event) => {
												setNotificationSettings((current) => ({
													...current,
													permissions: event.target.checked,
												}));
											}}
										/>{" "}
										Permission requests
									</label>
									<label>
										<input
											aria-label="Failure notifications"
											type="checkbox"
											disabled={!notificationSettings.enabled}
											checked={notificationSettings.failures}
											onChange={(event) => {
												setNotificationSettings((current) => ({
													...current,
													failures: event.target.checked,
												}));
											}}
										/>{" "}
										Failures and timeouts
									</label>
									<label>
										<input
											aria-label="Notification sound"
											type="checkbox"
											disabled={!notificationSettings.enabled}
											checked={notificationSettings.sound}
											onChange={(event) => {
												setNotificationSettings((current) => ({
													...current,
													sound: event.target.checked,
												}));
											}}
										/>{" "}
										Sound
									</label>
									<button
										type="button"
										aria-label="Save notification settings"
										disabled={savingNotifications}
										onClick={() => {
											void saveNotifications();
										}}
									>
										{savingNotifications ? "Saving…" : "Save notifications"}
									</button>
								</fieldset>
								<section
									className="mt-8 rounded-md border bg-muted p-4"
									aria-label="Runtime diagnostics"
								>
									<header>
										<strong>Runtime diagnostics</strong>
										<button
											type="button"
											aria-label="Run runtime diagnostics"
											disabled={diagnosticsLoading}
											onClick={() => {
												void runDiagnostics();
											}}
										>
											{diagnosticsLoading ? "Checking…" : "Run diagnostics"}
										</button>
									</header>
									{diagnostics === null ? (
										<p>
											Check installed harnesses, storage readiness, and
											inference data flow.
										</p>
									) : (
										<>
											<p>
												<strong>
													{diagnostics.inference.location === "remote"
														? "Remote inference"
														: "Local inference"}
												</strong>{" "}
												· {diagnostics.inference.provider} ·{" "}
												{diagnostics.inference.configured
													? "configured"
													: "needs configuration"}
											</p>
											<p>
												Inference sends:{" "}
												{diagnostics.inference.sends.join(" · ")}
											</p>
											<ul>
												{diagnostics.harnesses.map((harness) => (
													<li key={harness.adapter}>
														<strong>{runtimeLabel(harness.adapter)}</strong> ·{" "}
														{harness.installed ? "installed" : "not installed"}{" "}
														· {harness.rostered ? "added" : "not added"} ·{" "}
														{harness.runReadiness}
														<small>{harness.recovery}</small>
													</li>
												))}
											</ul>
										</>
									)}
								</section>
								<section
									className="mt-8 rounded-md border bg-muted p-4"
									aria-label="Workspace data management"
								>
									<header>
										<strong>Workspace data</strong>
										<button
											type="button"
											aria-label="Export workspace data"
											onClick={() => {
												void exportWorkspace();
											}}
										>
											Export
										</button>
									</header>
									<label>
										Import archive
										<input
											type="file"
											accept="application/json,.json"
											aria-label="Import workspace archive"
											onChange={(event) => {
												selectImportArchive(event.target.files?.[0]);
												event.target.value = "";
											}}
										/>
									</label>
									{importArchive !== null && (
										<section aria-label="Import Project mappings">
											<p>
												Map every exported Project root to a local folder.
												Import works only in an empty workspace.
											</p>
											{importArchive.workspace.projects.map((project) => (
												<fieldset key={project.id}>
													<legend>{project.name}</legend>
													{Array.from(
														{ length: project.rootCount },
														(_, rootIndex) => ({
															key: `${project.id}:root:${String(rootIndex)}`,
															rootIndex,
														}),
													).map(({ key, rootIndex }) => (
														<div key={key}>
															<span>
																{importMappings[project.id]?.[rootIndex] ||
																	`Root ${String(rootIndex + 1)} not mapped`}
															</span>
															<button
																type="button"
																aria-label={`Choose root ${String(rootIndex + 1)} for ${project.name}`}
																onClick={() => {
																	void chooseImportRoot(project.id, rootIndex);
																}}
															>
																Choose
															</button>
														</div>
													))}
												</fieldset>
											))}
											<button
												type="button"
												aria-label="Import workspace data"
												disabled={
													importingWorkspace ||
													Object.values(importMappings).some((paths) =>
														paths.some((path) => path === ""),
													)
												}
												onClick={() => {
													void importWorkspace();
												}}
											>
												{importingWorkspace ? "Importing…" : "Import workspace"}
											</button>
										</section>
									)}
									<section
										className="mt-6 border-t pt-5"
										aria-label="Conversation retention"
									>
										<strong>Remove conversation history</strong>
										<p>
											Preview the exact impact before permanently removing one
											Channel or Direct Message.
										</p>
										<select
											aria-label="Retention conversation"
											value={retentionConversation}
											onChange={(event) => {
												setRetentionConversation(event.target.value);
												setRetentionPreview(null);
											}}
										>
											<option value="">Choose a conversation</option>
											{channels.map((channel) => (
												<option
													key={`channel:${channel.id}`}
													value={`channel:${channel.id}`}
												>
													#{channel.name}
												</option>
											))}
											{agents.map((agent) => (
												<option key={`dm:${agent.id}`} value={`dm:${agent.id}`}>
													DM · {agent.displayName}
												</option>
											))}
										</select>
										<button
											type="button"
											aria-label="Preview retention"
											disabled={retentionConversation === ""}
											onClick={() => {
												void previewRetention();
											}}
										>
											Preview retention
										</button>
										{retentionPreview !== null && (
											<section aria-label="Retention impact">
												<p>
													{retentionPreview.messages} messages ·{" "}
													{retentionPreview.threads} threads ·{" "}
													{retentionPreview.attachments} attachments ·{" "}
													{retentionPreview.pins} pin
													{retentionPreview.pins === 1 ? "" : "s"}
												</p>
												{retentionPreview.permissions > 0 && (
													<p>
														{retentionPreview.permissions} permission request
														{retentionPreview.permissions === 1 ? "" : "s"} will
														also be removed.
													</p>
												)}
												<button
													type="button"
													aria-label="Apply retention"
													onClick={() => {
														void applyRetention();
													}}
												>
													Apply retention
												</button>
											</section>
										)}
									</section>
								</section>
								<div className="flex justify-end border-t pt-5">
									<button
										type="button"
										onClick={() => {
											setSettingsOpen(false);
										}}
									>
										Close settings
									</button>
								</div>
							</div>
						</div>
					</form>,
					document.body,
				)}

			<nav
				className="grid gap-0.5 px-2 pt-2"
				aria-label="Workspace destinations"
			>
				<button
					type="button"
					className="relative grid min-h-11 w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-[7px] rounded-sm border-0 bg-transparent px-2 text-left text-sidebar-foreground/90 hover:bg-sidebar-accent aria-pressed:bg-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)]"
					aria-label={`Open Inbox${inboxUnreadCount === 0 ? "" : `, ${String(inboxUnreadCount)} unread`}`}
					aria-pressed={inboxActive}
					onClick={onOpenInbox}
				>
					<span
						className="grid size-[22px] place-items-center rounded-sm bg-sidebar-accent"
						aria-hidden="true"
					>
						<InboxIcon className="size-[15px]" />
					</span>
					<strong className="text-[13px] font-semibold">Inbox</strong>
					{inboxUnreadCount > 0 && (
						<span
							className="grid size-5 min-w-5 place-items-center rounded-full bg-destructive px-1 font-mono text-xs text-white"
							aria-hidden="true"
						>
							{inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
						</span>
					)}
				</button>
				<button
					type="button"
					className="relative grid min-h-11 w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-[7px] rounded-sm border-0 bg-transparent px-2 text-left text-sidebar-foreground/90 hover:bg-sidebar-accent aria-pressed:bg-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)]"
					aria-label={`Open Threads${threadUnreadCount === 0 ? "" : `, ${String(threadUnreadCount)} unread`}`}
					aria-pressed={threadsActive}
					onClick={onOpenThreads}
				>
					<span
						className="grid size-[22px] place-items-center rounded-sm bg-sidebar-accent"
						aria-hidden="true"
					>
						<MessagesSquareIcon className="size-[15px]" />
					</span>
					<strong className="text-[13px] font-semibold">Threads</strong>
					{threadUnreadCount > 0 && (
						<span
							className="grid size-5 min-w-5 place-items-center rounded-full bg-destructive px-1 font-mono text-xs text-white"
							aria-hidden="true"
						>
							{threadUnreadCount > 99 ? "99+" : threadUnreadCount}
						</span>
					)}
				</button>
			</nav>

			<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[18px] [scrollbar-color:color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)_transparent] [scrollbar-width:thin]">
				<Section
					title="Projects"
					count={projects.length}
					open={!preferences.collapsedSections.includes("project")}
					onOpenChange={(open) => {
						sidebarPreferencesStore.setSectionCollapsed("project", !open);
					}}
					onAdd={() => {
						setForm("project");
						setFormError(null);
					}}
				>
					{form === "project" && (
						<SidebarDialog
							title="Add a project"
							description="Bind conversations to local folders."
							onClose={() => {
								setForm(null);
							}}
						>
							<form
								className="grid gap-3 [&_button]:min-h-11 [&_button]:rounded-sm [&_button]:border [&_button]:px-4 [&_input]:min-h-11 [&_input]:rounded-md [&_input]:border [&_input]:px-3"
								onSubmit={(event) => {
									void submit(event);
								}}
							>
								<label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
									Project name
									<input
										aria-label="Project name"
										placeholder="Project name"
										value={name}
										required
										onChange={(event) => {
											setName(event.target.value);
											setFormError(null);
										}}
									/>
								</label>
								<label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
									Local folder
									<span className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
										<input
											aria-label="Project path"
											placeholder="Choose a local folder"
											value={path}
											required
											onChange={(event) => {
												setPath(event.target.value);
												setFormError(null);
											}}
										/>
										<button
											type="button"
											aria-label="Choose project folder"
											disabled={selectingPath}
											onClick={() => {
												void chooseProjectDirectory();
											}}
										>
											{selectingPath ? "Opening…" : "Browse folders"}
										</button>
									</span>
								</label>
								<div className="mt-2 flex items-end justify-end gap-2 border-t pt-3">
									<FormError message={formError} />
									<button
										type="button"
										onClick={() => {
											setForm(null);
										}}
									>
										Cancel
									</button>
									<button
										type="submit"
										disabled={name.trim() === "" || path.trim() === ""}
										className="border-primary bg-primary text-primary-foreground"
									>
										Create project
									</button>
								</div>
							</form>
						</SidebarDialog>
					)}
					{projectItems.pinnedCount > 0 && (
						<NavGroupLabel label="Pinned" count={projectItems.pinnedCount} />
					)}
					{projectItems.items.map((project, index) => {
						const active = snapshot.activeProjectId === project.id;
						const folderSummary =
							project.paths.length === 1
								? "1 folder · working directory"
								: `${String(project.paths.length)} folders · working + references`;
						return (
							<div key={project.id} className="grid gap-0.5">
								{projectItems.pinnedCount > 0 &&
									index === projectItems.pinnedCount && (
										<NavGroupLabel
											label="Recent"
											count={
												projectItems.items.length - projectItems.pinnedCount
											}
										/>
									)}
								<div className="group grid grid-cols-[minmax(0,1fr)_44px] items-center rounded-sm hover:bg-sidebar-accent focus-within:bg-sidebar-accent has-[button[aria-pressed=true]]:bg-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)]">
									<button
										type="button"
										className="relative grid min-h-11 w-full min-w-0 grid-cols-[22px_minmax(0,1fr)] items-center gap-[7px] rounded-l-sm border-0 bg-transparent px-2 text-left text-sidebar-foreground/90 aria-pressed:text-sidebar-foreground"
										aria-label={`Select project ${project.name}`}
										aria-pressed={active}
										onClick={() => {
											touchRecent("project", project.id);
											store.selectProject(project.id);
											onOpenProject?.(project.id);
										}}
									>
										<span
											className="grid size-[22px] place-items-center rounded-sm bg-sidebar-accent font-mono text-xs"
											aria-hidden="true"
										>
											{project.name.slice(0, 1).toLocaleUpperCase()}
										</span>
										<span className="min-w-0">
											<strong className="block truncate text-[13px] font-semibold">
												{project.name}
											</strong>
											<small className="hidden">{folderSummary}</small>
										</span>
									</button>
									{onOpenContextSettings === undefined ? (
										<button
											type="button"
											className="grid size-11 place-items-center rounded-r-sm border-0 bg-transparent text-sidebar-foreground/65 opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100 focus:opacity-100"
											aria-label={`Add local folder to project ${project.name}`}
											onClick={() => {
												touchRecent("project", project.id);
												store.selectProject(project.id);
												setPathProjectId(project.id);
												setPathDraft("");
											}}
										>
											<MoreHorizontalIcon
												className="size-4"
												aria-hidden="true"
											/>
										</button>
									) : (
										<CollectionActionMenu
											kind="project"
											label={project.name}
											meta={folderSummary}
											pinned={collectionPinned("project", project.id)}
											triggerClassName="rounded-r-sm text-sidebar-foreground/65 opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100 focus:opacity-100 max-[780px]:opacity-100"
											onOpen={() => {
												touchRecent("project", project.id);
												store.selectProject(project.id);
												onOpenProject?.(project.id);
											}}
											onSettings={() => {
												if (onOpenContextSettings === undefined) {
													store.selectProject(project.id);
													onOpenProject?.(project.id);
												} else onOpenContextSettings("project", project.id);
											}}
											onAddFolder={() => {
												store.selectProject(project.id);
												setPathProjectId(project.id);
												setPathDraft("");
											}}
											onCopy={() => copyText(project.name)}
											copyLabel="Copy project name"
											onTogglePinned={() => {
												toggleCollectionPinned("project", project.id);
											}}
											onRemove={() =>
												store.mutate({
													action: "remove-project",
													projectId: project.id,
												})
											}
										/>
									)}
								</div>

								{pathProjectId === project.id && (
									<div className="p-2">
										<form
											className="grid gap-2 [&_button]:min-h-10 [&_button]:rounded-sm [&_button]:border [&_button]:px-3 [&_input]:min-h-10 [&_input]:rounded-sm [&_input]:border [&_input]:px-3"
											onSubmit={(event) => {
												void submitPath(event, project.id);
											}}
										>
											<input
												aria-label={`Workspace path for ${project.name}`}
												placeholder="/absolute/local/path"
												value={pathDraft}
												onChange={(event) => {
													setPathDraft(event.target.value);
												}}
											/>
											<div>
												<button type="submit">Add</button>
												<button
													type="button"
													onClick={() => {
														setPathProjectId(null);
													}}
												>
													Cancel
												</button>
											</div>
										</form>
									</div>
								)}
							</div>
						);
					})}
					{projects.length === 0 && form !== "project" && (
						<div className="px-2 py-4 text-xs text-sidebar-foreground/60">
							Add a local filesystem project.
						</div>
					)}
					<BrowseButton
						label="Browse all projects"
						onClick={() => {
							if (onOpenDirectory !== undefined) onOpenDirectory("projects");
							else if (onOpenSearch === undefined) setSearchOpen(true);
							else onOpenSearch();
						}}
					/>
				</Section>

				<Section
					title="Channels"
					count={channels.length}
					open={!preferences.collapsedSections.includes("channel")}
					onOpenChange={(open) => {
						sidebarPreferencesStore.setSectionCollapsed("channel", !open);
					}}
					onAdd={() => {
						setForm("channel");
						setFormError(null);
						setAgentIds([]);
						setChannelAgentQuery("");
						setChannelAgentFilter("all");
					}}
				>
					{form === "channel" && (
						<SidebarDialog
							title="Add a channel"
							description="Create a shared room for many independent conversations."
							onClose={() => {
								setForm(null);
							}}
						>
							<form
								className="grid gap-3 [&_button]:min-h-11 [&_button]:rounded-sm [&_button]:border [&_button]:px-4 [&_fieldset]:grid [&_fieldset]:gap-2 [&_input]:min-h-11 [&_input]:rounded-md [&_input]:border [&_input]:px-3"
								onSubmit={(event) => {
									void submit(event);
								}}
							>
								<label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
									Channel name
									<input
										aria-label="Channel name"
										placeholder="channel-name"
										value={name}
										required
										onChange={(event) => {
											setName(event.target.value);
											setFormError(null);
										}}
									/>
								</label>
								<fieldset className="rounded-md border p-3">
									<legend className="px-1 font-heading text-sm font-bold">
										Agents
									</legend>
									<div className="mb-3 flex items-start justify-between gap-4">
										<p className="text-xs text-muted-foreground">
											Add agents who should be available in this channel.
										</p>
										<span className="shrink-0 font-mono text-xs text-muted-foreground">
											{String(agentIds.length)} selected
										</span>
									</div>
									<input
										type="search"
										aria-label="Search available agents"
										placeholder="Search name, role, or harness"
										value={channelAgentQuery}
										onChange={(event) => {
											setChannelAgentQuery(event.target.value);
										}}
									/>
									<fieldset
										className="mt-2 flex gap-1 border-0 p-0"
										aria-label="Filter available agents"
									>
										{(["all", "selected"] as const).map((value) => (
											<button
												key={value}
												type="button"
												className="min-h-9 rounded-full border px-3 text-xs font-semibold capitalize aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
												aria-pressed={channelAgentFilter === value}
												onClick={() => {
													setChannelAgentFilter(value);
												}}
											>
												{value}
											</button>
										))}
									</fieldset>
									<div className="mt-2 max-h-[260px] overflow-y-auto">
										{availableChannelAgents.map((agent) => (
											<label
												className="grid min-h-[58px] grid-cols-[18px_36px_minmax(0,1fr)] items-center gap-3 border-b py-2 last:border-b-0"
												key={agent.id}
											>
												<input
													type="checkbox"
													checked={agentIds.includes(agent.id)}
													onChange={(event) => {
														setAgentIds((current) =>
															event.target.checked
																? [...current, agent.id]
																: current.filter((id) => id !== agent.id),
														);
													}}
												/>
												<AgentAvatar agent={agent} />
												<span>
													<strong className="block text-[13px] text-foreground">
														{agent.displayName}
													</strong>
													<small className="block text-xs font-normal text-muted-foreground">
														{runtimeLabel(agent.adapter)} ·{" "}
														{agent.model ?? "harness default"}
													</small>
												</span>
											</label>
										))}
										{availableChannelAgents.length === 0 && (
											<p className="p-4 text-center text-xs text-muted-foreground">
												No matching agents.
											</p>
										)}
									</div>
								</fieldset>
								<div className="mt-2 flex justify-end gap-2 border-t pt-3">
									<FormError message={formError} />
									<button
										type="button"
										onClick={() => {
											setForm(null);
										}}
									>
										Cancel
									</button>
									<button
										type="submit"
										className="border-primary bg-primary text-primary-foreground"
									>
										Create channel
									</button>
								</div>
							</form>
						</SidebarDialog>
					)}
					{channelItems.pinnedCount > 0 && (
						<NavGroupLabel label="Pinned" count={channelItems.pinnedCount} />
					)}
					{channelItems.items.map((channel, index) => {
						const unreadCount = channelUnreadCounts.get(channel.id) ?? 0;
						const latestChannelMessage =
							state?.messages[`channel:${channel.id}`]?.at(-1);
						const channelPins = (state?.pins ?? []).filter(
							(pin) =>
								pin.removedAt === null &&
								pin.scope.kind === "channel" &&
								pin.scope.id === channel.id,
						);
						return (
							<div key={channel.id} className="grid gap-0.5">
								{channelItems.pinnedCount > 0 &&
									index === channelItems.pinnedCount && (
										<NavGroupLabel
											label="Recent"
											count={
												channelItems.items.length - channelItems.pinnedCount
											}
										/>
									)}
								<div className="group grid grid-cols-[minmax(0,1fr)_44px] items-center rounded-sm hover:bg-sidebar-accent focus-within:bg-sidebar-accent has-[button[aria-pressed=true]]:bg-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)]">
									<button
										type="button"
										className="relative grid min-h-11 w-full min-w-0 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-[7px] rounded-l-sm border-0 bg-transparent px-2 text-left text-sidebar-foreground/90 aria-pressed:text-sidebar-foreground"
										aria-label={`Open channel ${channel.name}${unreadCount === 0 ? "" : `, ${String(unreadCount)} unread`}`}
										aria-pressed={
											snapshot.activeConversation?.kind === "channel" &&
											snapshot.activeConversation.id === channel.id
										}
										onClick={() => {
											touchRecent("channel", channel.id);
											onOpenConversation?.();
											store.selectConversation({
												kind: "channel",
												id: channel.id,
											});
										}}
									>
										<span
											className="grid size-[22px] place-items-center rounded-sm bg-sidebar-accent font-mono text-base"
											aria-hidden="true"
										>
											#
										</span>
										<span className="min-w-0">
											<strong className="block truncate text-[13px] font-semibold">
												{channel.name}
											</strong>
											<small className="hidden">
												{channel.agentIds.length} agent
												{channel.agentIds.length === 1 ? "" : "s"}
											</small>
										</span>
										{unreadCount > 0 && (
											<span
												className="grid size-5 min-w-5 place-items-center rounded-full bg-destructive px-1 font-mono text-xs text-white"
												aria-hidden="true"
											>
												{unreadCount > 99 ? "99+" : unreadCount}
											</span>
										)}
									</button>
									{onOpenContextSettings === undefined ? (
										<button
											type="button"
											className="grid size-11 place-items-center rounded-r-sm border-0 bg-transparent text-sidebar-foreground/65 opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100 focus:opacity-100"
											aria-label={`Manage agents in channel ${channel.name}`}
											onClick={() => {
												setEditingChannelId(channel.id);
												setChannelAgentIds(channel.agentIds);
												setChannelInstructions(channel.instructions);
												setChannelModel(channel.settings.model ?? "");
												setChannelReasoning(channel.settings.reasoning ?? "");
												setChannelSummary(channel.memory.summary);
												setChannelDecisions(
													channel.memory.decisions.join("\n"),
												);
												setChannelQuestions(
													channel.memory.openQuestions.join("\n"),
												);
												setChannelPinNote("");
											}}
										>
											<MoreHorizontalIcon
												className="size-4"
												aria-hidden="true"
											/>
										</button>
									) : (
										<CollectionActionMenu
											kind="channel"
											label={channel.name}
											meta={`${String(channel.agentIds.length)} ${channel.agentIds.length === 1 ? "agent" : "agents"}`}
											pinned={collectionPinned("channel", channel.id)}
											triggerClassName="rounded-r-sm text-sidebar-foreground/65 opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100 focus:opacity-100 max-[780px]:opacity-100"
											unread={unreadCount > 0}
											onOpen={() => {
												touchRecent("channel", channel.id);
												onOpenConversation?.();
												store.selectConversation({
													kind: "channel",
													id: channel.id,
												});
											}}
											onSettings={() => {
												if (onOpenContextSettings !== undefined) {
													onOpenContextSettings("channel", channel.id);
													return;
												}
												setEditingChannelId(channel.id);
												setChannelAgentIds(channel.agentIds);
												setChannelInstructions(channel.instructions);
												setChannelModel(channel.settings.model ?? "");
												setChannelReasoning(channel.settings.reasoning ?? "");
												setChannelSummary(channel.memory.summary);
												setChannelDecisions(
													channel.memory.decisions.join("\n"),
												);
												setChannelQuestions(
													channel.memory.openQuestions.join("\n"),
												);
												setChannelPinNote("");
											}}
											onMarkRead={() => {
												for (const item of inboxItems) {
													if (
														item.unread &&
														item.conversation.kind === "channel" &&
														item.conversation.id === channel.id
													) {
														void store.mutate({
															action: "mark-inbox-item-read",
															messageId: item.messageId,
														});
													}
												}
											}}
											onMarkUnread={() => {
												if (latestChannelMessage === undefined) return;
												void store.mutate({
													action: "set-inbox-item-unread",
													messageId: latestChannelMessage.id,
													unread: true,
												});
											}}
											onTogglePinned={() => {
												toggleCollectionPinned("channel", channel.id);
											}}
											onRemove={() =>
												store.mutate({
													action: "remove-channel",
													channelId: channel.id,
												})
											}
										/>
									)}
								</div>
								{editingChannelId === channel.id && (
									<form
										className="grid gap-3 rounded-md bg-sidebar-deep p-3 text-sidebar-foreground [&_button]:min-h-10 [&_button]:rounded-sm [&_button]:border [&_button]:px-3 [&_fieldset]:grid [&_fieldset]:gap-2 [&_input]:min-h-10 [&_input]:rounded-sm [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_select]:min-h-10 [&_select]:rounded-sm [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_textarea]:min-h-24 [&_textarea]:rounded-sm [&_textarea]:border [&_textarea]:bg-background [&_textarea]:p-3"
										onSubmit={(event) => {
											void saveChannelAgents(event, channel.id);
										}}
									>
										<fieldset>
											<legend>Channel agents</legend>
											{agents.map((agent) => (
												<label key={agent.id}>
													<input
														type="checkbox"
														checked={channelAgentIds.includes(agent.id)}
														onChange={(event) => {
															setChannelAgentIds((current) =>
																event.target.checked
																	? [...current, agent.id]
																	: current.filter((id) => id !== agent.id),
															);
														}}
													/>
													{agent.displayName}
												</label>
											))}
										</fieldset>
										<label className="grid gap-1.5">
											Channel instructions
											<textarea
												aria-label={`Instructions for channel ${channel.name}`}
												value={channelInstructions}
												onChange={(event) => {
													setChannelInstructions(event.target.value);
												}}
												placeholder="What agents should remember and how they should behave in this channel"
											/>
										</label>
										<label className="grid gap-1.5">
											Channel model
											<input
												aria-label={`Model for channel ${channel.name}`}
												list="commonspace-models"
												placeholder="Inherit default"
												value={channelModel}
												onChange={(event) => {
													setChannelModel(event.target.value);
												}}
											/>
										</label>
										<label className="grid gap-1.5">
											Channel reasoning
											<select
												aria-label={`Reasoning for channel ${channel.name}`}
												value={channelReasoning}
												onChange={(event) => {
													if (
														event.target.value === "" ||
														isReasoning(event.target.value)
													)
														setChannelReasoning(event.target.value);
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
										<section
											className="grid gap-3 rounded-md border border-sidebar-border p-3"
											aria-label={`Channel context for ${channel.name}`}
										>
											<header>
												<strong>Canonical context</strong>
												<span data-status={channel.memory.status ?? "current"}>
													{channel.memory.status ?? "current"}
												</span>
											</header>
											<label className="grid gap-1.5">
												Summary
												<textarea
													aria-label={`Channel summary for ${channel.name}`}
													value={channelSummary}
													onChange={(event) => {
														setChannelSummary(event.target.value);
													}}
												/>
											</label>
											<label className="grid gap-1.5">
												Decisions
												<textarea
													aria-label={`Channel decisions for ${channel.name}`}
													value={channelDecisions}
													onChange={(event) => {
														setChannelDecisions(event.target.value);
													}}
												/>
											</label>
											<label className="grid gap-1.5">
												Open questions
												<textarea
													aria-label={`Channel open questions for ${channel.name}`}
													value={channelQuestions}
													onChange={(event) => {
														setChannelQuestions(event.target.value);
													}}
												/>
											</label>
											<button
												type="button"
												aria-label={`Compact context for channel ${channel.name}`}
												disabled={compactingChannelId !== null}
												onClick={() => {
													void compactChannelContext(channel.id);
												}}
											>
												{compactingChannelId === channel.id
													? "Compacting…"
													: "Compact context"}
											</button>
										</section>
										<section
											className="grid gap-2 rounded-md border border-sidebar-border p-3"
											aria-label={`Channel pins for ${channel.name}`}
										>
											<header>
												<strong>Pins</strong>
												<span>{channelPins.length}</span>
											</header>
											{channelPins.map((pin) => {
												const label =
													pin.note ??
													pin.attachmentId ??
													pin.messageId ??
													"Pinned source";
												return (
													<div key={pin.id}>
														<p>{label}</p>
														<button
															type="button"
															aria-label={`Remove Channel pin ${label}`}
															onClick={() => {
																void store.removePin(pin.id);
															}}
														>
															Remove
														</button>
													</div>
												);
											})}
											<div>
												<input
													aria-label={`New Channel pin note for ${channel.name}`}
													value={channelPinNote}
													onChange={(event) => {
														setChannelPinNote(event.target.value);
													}}
													placeholder="Pin a Channel note"
												/>
												<button
													type="button"
													aria-label={`Add Channel pin note for ${channel.name}`}
													disabled={channelPinNote.trim() === ""}
													onClick={() => {
														void addChannelPin(channel.id);
													}}
												>
													Pin
												</button>
											</div>
										</section>
										<div>
											<button
												type="submit"
												aria-label={`Save channel ${channel.name}`}
											>
												Save
											</button>
											<button
												type="button"
												onClick={() => {
													setEditingChannelId(null);
												}}
											>
												Cancel
											</button>
										</div>
									</form>
								)}
							</div>
						);
					})}
					{channels.length === 0 && form !== "channel" && (
						<div className="px-2 py-4 text-xs text-sidebar-foreground/60">
							Create a channel and seat agents.
						</div>
					)}
					<BrowseButton
						label="Browse all channels"
						onClick={() => {
							if (onOpenDirectory !== undefined) onOpenDirectory("channels");
							else if (onOpenSearch === undefined) setSearchOpen(true);
							else onOpenSearch();
						}}
					/>
				</Section>

				<Section
					title="Agents"
					count={agents.length}
					open={!preferences.collapsedSections.includes("agent")}
					onOpenChange={(open) => {
						sidebarPreferencesStore.setSectionCollapsed("agent", !open);
					}}
					onAdd={() => {
						setForm("agent");
						setName("");
						setAgentAdapter(null);
					}}
				>
					{form === "agent" && (
						<SidebarDialog
							title="Add an agent"
							description="Choose an installed harness to represent in Commonspace."
							onClose={() => {
								setForm(null);
							}}
						>
							<div className="grid gap-2">
								{(["codex", "hermes"] as const).map((adapter) => (
									<button
										key={adapter}
										type="button"
										className="grid min-h-[68px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-background px-3 text-left hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/5"
										aria-label={`Choose ${runtimeLabel(adapter)} harness`}
										aria-pressed={agentAdapter === adapter}
										onClick={() => {
											selectAgentHarness(adapter);
										}}
									>
										<span className="grid size-10 place-items-center rounded-sm border bg-muted font-mono font-semibold">
											{adapter === "codex" ? "C" : "H"}
										</span>
										<span>
											<strong className="block">{runtimeLabel(adapter)}</strong>
											<small className="block text-xs text-muted-foreground">
												Installed harness · credentials stay native
											</small>
										</span>
										<span className="text-xs text-muted-foreground">
											{agentAdapter === adapter ? "Selected" : "Choose"}
										</span>
									</button>
								))}
							</div>
							{agentAdapter !== null && (
								<div className="grid gap-2">
									<strong>{runtimeLabel(agentAdapter)} harness</strong>
									{snapshot.loading && (
										<span>
											Checking for installed {runtimeLabel(agentAdapter)}…
										</span>
									)}
									{!snapshot.loading &&
										availableDiscoveredAgents.length === 0 && (
											<span>
												{runtimeLabel(agentAdapter)} is not available or is
												already added.
											</span>
										)}
									{availableDiscoveredAgents.map((agent) => (
										<button
											key={agent.id}
											type="button"
											className="grid min-h-14 grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-sm border bg-background px-3 text-left hover:bg-muted"
											aria-label={`Add discovered agent ${agent.displayName}`}
											onClick={() => {
												void store.mutate({
													action: "add-discovered-agent",
													agentId: agent.id,
												});
												setForm(null);
											}}
										>
											<AgentAvatar agent={agent} />
											<span>
												<strong>{agent.displayName}</strong>
												<small>
													{runtimeLabel(agent.adapter)} ·{" "}
													{agent.model ?? "default model"}
												</small>
											</span>
										</button>
									))}
								</div>
							)}
							<div className="mt-3 flex justify-end border-t pt-3">
								<button
									type="button"
									className="min-h-11 rounded-sm border px-4"
									onClick={() => {
										setForm(null);
									}}
								>
									Cancel
								</button>
							</div>
						</SidebarDialog>
					)}
					{editingAgentId !== null &&
						(() => {
							const editingAgent = agents.find(
								(agent) => agent.id === editingAgentId,
							);
							if (editingAgent === undefined) return null;
							const previewAgent: CommonspaceAgentProfile = {
								...editingAgent,
								displayName: agentProfileName || editingAgent.displayName,
								accentColor: agentAccentColor,
							};
							if (agentAvatarEmoji !== "")
								previewAgent.avatarEmoji = agentAvatarEmoji;
							return (
								<SidebarDialog
									title={`Customize ${editingAgent.displayName}`}
									onClose={() => {
										setEditingAgentId(null);
									}}
								>
									<form
										className="grid gap-3 [&_button]:min-h-11 [&_button]:rounded-sm [&_button]:border [&_button]:px-4 [&_input]:min-h-11 [&_input]:rounded-md [&_input]:border [&_input]:px-3"
										onSubmit={(event) => {
											void saveAgentProfile(event, editingAgent.id);
										}}
									>
										<div className="flex items-center gap-3 rounded-md border bg-muted p-3">
											<AgentAvatar agent={previewAgent} />
											<span>
												<strong>
													{agentProfileName || editingAgent.displayName}
												</strong>
												<small>Commonspace appearance only</small>
											</span>
										</div>
										<label>
											Workspace name
											<input
												aria-label="Workspace name"
												value={agentProfileName}
												onChange={(event) => {
													setAgentProfileName(event.target.value);
												}}
											/>
										</label>
										<label>
											Avatar emoji
											<input
												aria-label="Avatar emoji"
												value={agentAvatarEmoji}
												onChange={(event) => {
													setAgentAvatarEmoji(event.target.value);
												}}
												placeholder={(
													agentProfileName || editingAgent.displayName
												)
													.slice(0, 1)
													.toLocaleUpperCase()}
												maxLength={16}
											/>
										</label>
										<label>
											Accent color
											<input
												aria-label="Accent color"
												type="color"
												value={agentAccentColor}
												onChange={(event) => {
													setAgentAccentColor(event.target.value);
												}}
											/>
										</label>
										<p className="text-xs text-muted-foreground">
											The installed {runtimeLabel(editingAgent.adapter)}{" "}
											harness, routing, and sessions stay unchanged.
										</p>
										<div>
											<button type="submit">Save appearance</button>
											{state?.agents.some(
												(candidate) => candidate.id === editingAgent.id,
											) === true && (
												<button
													type="button"
													aria-label={`Remove agent ${editingAgent.displayName}`}
													onClick={() => {
														void store.mutate({
															action: "remove-agent",
															agentId: editingAgent.id,
														});
														setEditingAgentId(null);
													}}
												>
													Remove agent
												</button>
											)}
										</div>
									</form>
								</SidebarDialog>
							);
						})()}
					{agentItems.pinnedCount > 0 && (
						<NavGroupLabel label="Pinned" count={agentItems.pinnedCount} />
					)}
					{agentItems.items.map((agent, index) => {
						const effectiveStatus = activeAgentIds.has(agent.id)
							? "running"
							: agent.status;
						return (
							<div key={agent.id} className="grid gap-0.5">
								{agentItems.pinnedCount > 0 &&
									index === agentItems.pinnedCount && (
										<NavGroupLabel
											label="Recent"
											count={agentItems.items.length - agentItems.pinnedCount}
										/>
									)}
								<div className="group grid grid-cols-[minmax(0,1fr)_44px] items-center rounded-sm hover:bg-sidebar-accent focus-within:bg-sidebar-accent has-[button[aria-pressed=true]]:bg-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)]">
									<button
										type="button"
										className="relative grid min-h-11 w-full min-w-0 grid-cols-[22px_minmax(0,1fr)] items-center gap-[7px] rounded-l-sm border-0 bg-transparent px-2 text-left text-sidebar-foreground/90 aria-pressed:text-sidebar-foreground"
										aria-label={`Message agent ${agent.displayName}`}
										aria-pressed={
											snapshot.activeConversation?.kind === "dm" &&
											snapshot.activeConversation.id === agent.id
										}
										onClick={() => {
											touchRecent("agent", agent.id);
											startDirectMessage(agent.id);
										}}
									>
										<span
											className="relative grid size-[22px] place-items-center rounded-sm bg-sidebar-accent font-mono text-xs"
											aria-hidden="true"
										>
											{agent.avatarEmoji ??
												agent.displayName.slice(0, 1).toLocaleUpperCase()}
											<i
												className={cn(
													"absolute right-[-1px] bottom-[-1px] size-[6px] rounded-full border border-sidebar bg-sidebar-foreground/55",
													effectiveStatus === "running" &&
														"bg-[var(--status-success)]",
												)}
											/>
										</span>
										<span className="min-w-0">
											<strong className="block truncate text-[13px] font-semibold">
												{agent.displayName}
											</strong>
											<small className="sr-only">
												{runtimeLabel(agent.adapter)} ·{" "}
												{agent.model ?? "default model"} ·{" "}
												<span data-status={effectiveStatus}>
													{agentStatusLabel(effectiveStatus)}
												</span>
											</small>
										</span>
									</button>
									{onOpenContextSettings === undefined ? (
										<button
											type="button"
											className="grid size-11 place-items-center rounded-r-sm border-0 bg-transparent text-sidebar-foreground/65 opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100 focus:opacity-100"
											aria-label={`Customize agent ${agent.displayName}`}
											onClick={() => {
												setEditingAgentId(agent.id);
												setAgentProfileName(agent.displayName);
												setAgentAvatarEmoji(agent.avatarEmoji ?? "");
												setAgentAccentColor(agent.accentColor ?? "#6d5dfc");
											}}
										>
											<MoreHorizontalIcon
												className="size-4"
												aria-hidden="true"
											/>
										</button>
									) : (
										<CollectionActionMenu
											kind="agent"
											label={agent.displayName}
											meta={`${runtimeLabel(agent.adapter)} · ${agentStatusLabel(effectiveStatus)}`}
											pinned={collectionPinned("agent", agent.id)}
											triggerClassName="rounded-r-sm text-sidebar-foreground/65 opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100 focus:opacity-100 max-[780px]:opacity-100"
											onOpen={() => {
												touchRecent("agent", agent.id);
												startDirectMessage(agent.id);
											}}
											onSettings={() => {
												if (onOpenContextSettings !== undefined) {
													onOpenContextSettings("agent", agent.id);
													return;
												}
												setEditingAgentId(agent.id);
												setAgentProfileName(agent.displayName);
												setAgentAvatarEmoji(agent.avatarEmoji ?? "");
												setAgentAccentColor(agent.accentColor ?? "#6d5dfc");
											}}
											onStartFreshChat={() => {
												void store
													.mutate({ action: "reset-dm", agentId: agent.id })
													.then(() => {
														startDirectMessage(agent.id);
													});
											}}
											{...(activeMentionChannel !== undefined &&
											onMentionAgent !== undefined
												? {
														onMention: () => onMentionAgent(agent.displayName),
														mentionLabel: `Mention in #${activeMentionChannel.name}`,
													}
												: {})}
											{...(onOpenAgentSessions === undefined
												? {}
												: { onViewSessions: onOpenAgentSessions })}
											onCopy={() => copyText(`@${agent.displayName}`)}
											copyLabel="Copy mention"
											onTogglePinned={() => {
												toggleCollectionPinned("agent", agent.id);
											}}
											onRemove={() =>
												store.mutate({
													action: "remove-agent",
													agentId: agent.id,
												})
											}
										/>
									)}
								</div>
							</div>
						);
					})}
					<BrowseButton
						label="Browse all agents"
						onClick={() => {
							if (onOpenDirectory !== undefined) onOpenDirectory("agents");
							else if (onOpenSearch === undefined) setSearchOpen(true);
							else onOpenSearch();
						}}
					/>
				</Section>
			</div>
			<div className="flex min-h-[60px] items-center gap-1.5 border-t border-sidebar-border bg-sidebar-deep py-2 pr-2.5 pl-[18px]">
				<span className="mr-auto text-xs text-sidebar-foreground/65">
					On this Mac
				</span>
				<button
					type="button"
					className="grid size-11 place-items-center rounded-full border-0 bg-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
					aria-label="Refresh Commonspace"
					onClick={() => {
						void store.refresh();
					}}
				>
					<RefreshCwIcon className="size-[18px]" aria-hidden="true" />
				</button>
				<button
					type="button"
					className="grid size-11 place-items-center rounded-full border-0 bg-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground aria-[current=page]:bg-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)]"
					aria-label="Commonspace settings"
					aria-current={settingsOpen ? "page" : undefined}
					onClick={() => {
						const defaults = state?.defaults;
						if (defaults !== undefined) {
							setDefaultModel(defaults.model ?? "");
							setDefaultReasoning(defaults.reasoning);
							setDefaultMaxAgents(defaults.maxAgentsPerTurn);
							setDefaultMemoryThreads(defaults.memoryThreads);
						}
						const routing = bootstrap?.routing;
						setRoutingProvider(routing?.provider ?? "openai-compatible");
						setRoutingHarnessAgentId(routing?.harnessAgentId ?? "");
						setRoutingModel(routing?.model ?? "");
						setRoutingBaseUrl(routing?.baseUrl ?? "https://api.openai.com/v1");
						setRoutingApiKey("");
						setClearRoutingApiKey(false);
						setNotificationSettings({
							...(state?.notifications ??
								DEFAULT_COMMONSPACE_NOTIFICATION_SETTINGS),
						});
						setSettingsOpen((value) => !value);
					}}
				>
					<SettingsIcon className="size-[18px]" aria-hidden="true" />
				</button>
			</div>
		</section>
	);
}
