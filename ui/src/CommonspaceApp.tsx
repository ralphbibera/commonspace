import type {
	CommonspaceSearchResult,
	CommonspaceSessionItem,
	ConversationRef,
} from "@commonspace/shared";
import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { CommonspaceConversation } from "./CommonspaceConversation.tsx";
import {
	CommonspaceDirectory,
	type CommonspaceDirectoryKind,
} from "./CommonspaceDirectory.tsx";
import { CommonspaceHome } from "./CommonspaceHome.tsx";
import { CommonspaceInbox } from "./CommonspaceInbox.tsx";
import { CommonspaceProjectView } from "./CommonspaceProjectView.tsx";
import { CommonspaceSearchDialog } from "./CommonspaceSearch.tsx";
import { CommonspaceSidebar } from "./CommonspaceSidebar.tsx";
import { CommonspaceThreads } from "./CommonspaceThreads.tsx";
import { CommonspaceTopbar } from "./CommonspaceTopbar.tsx";
import type { CommonspaceStore } from "./commonspace-store.ts";
import type { CommonspaceCollectionKind } from "./design-system/CollectionActionMenu.tsx";
import type { CommonspaceColorMode } from "./theme.ts";

export interface CommonspaceAppProps {
	store: CommonspaceStore;
}

type CommonspaceDestination =
	| "home"
	| "conversation"
	| "directory"
	| "inbox"
	| "threads"
	| "project";

interface ConversationTarget {
	messageId: string;
	conversation: ConversationRef;
	threadId?: string;
}

function storedUiValue(key: string): string | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function storedNavigation(raw: string | null): {
	kind: "channel" | "dm";
	id: string;
	threadId?: string;
} | null {
	if (raw === null) return null;
	try {
		const value: unknown = JSON.parse(raw);
		if (typeof value !== "object" || value === null || Array.isArray(value))
			return null;
		if (!("kind" in value) || !("id" in value)) return null;
		if (
			(value.kind !== "channel" && value.kind !== "dm") ||
			typeof value.id !== "string" ||
			value.id === ""
		)
			return null;
		const threadId = "threadId" in value ? value.threadId : undefined;
		return {
			kind: value.kind,
			id: value.id,
			...(typeof threadId === "string" ? { threadId } : {}),
		};
	} catch {
		return null;
	}
}

function initialDestination(): CommonspaceDestination {
	const saved = storedUiValue("commonspace-view");
	return saved === "conversation" ||
		saved === "directory" ||
		saved === "inbox" ||
		saved === "threads" ||
		saved === "project"
		? saved
		: "home";
}

function initialDirectoryKind(): CommonspaceDirectoryKind {
	const saved = storedUiValue("commonspace-directory-kind");
	return saved === "channels" || saved === "agents" ? saved : "projects";
}

function initialColorMode(): CommonspaceColorMode {
	if (typeof window !== "undefined") {
		try {
			const saved = window.localStorage.getItem("commonspace-color-mode");
			if (saved === "light" || saved === "dark" || saved === "system")
				return saved;
		} catch {
			// Use light mode when local storage is unavailable.
		}
	}
	return "light";
}

export function CommonspaceApp({ store }: CommonspaceAppProps) {
	const snapshot = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
	const [navigationOpen, setNavigationOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [colorMode, setColorMode] =
		useState<CommonspaceColorMode>(initialColorMode);
	const [activeDestination, setActiveDestination] =
		useState<CommonspaceDestination>(initialDestination);
	const [directoryKind, setDirectoryKind] =
		useState<CommonspaceDirectoryKind>(initialDirectoryKind);
	const [createRequest, setCreateRequest] = useState<{
		kind: CommonspaceCollectionKind;
		token: number;
	} | null>(null);
	const [settingsRequest, setSettingsRequest] = useState<{
		kind: CommonspaceCollectionKind;
		id: string;
		token: number;
	} | null>(null);
	const [inboxViewRequest, setInboxViewRequest] = useState<{
		view: "attention" | "sessions";
		token: number;
	} | null>(null);
	const [composerInsertRequest, setComposerInsertRequest] = useState<{
		text: string;
		token: number;
	} | null>(null);
	const [activeProjectViewId, setActiveProjectViewId] = useState<string | null>(
		null,
	);
	const [targetProjectFile, setTargetProjectFile] = useState<{
		rootIndex: number;
		path: string;
	} | null>(null);
	const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
	const notificationLinkHandled = useRef(false);

	useEffect(() => {
		store.connectEvents();
		return () => {
			store.disconnectEvents();
		};
	}, [store]);

	useEffect(() => {
		const root = document.documentElement;
		const media =
			typeof window.matchMedia === "function"
				? window.matchMedia("(prefers-color-scheme: dark)")
				: null;
		const applyMode = () => {
			const dark =
				colorMode === "dark" ||
				(colorMode === "system" && media?.matches === true);
			root.classList.toggle("dark", dark);
			root.classList.toggle("light", !dark);
			root.classList.toggle("system", colorMode === "system");
		};
		applyMode();
		if (colorMode === "system" && media !== null) {
			media.addEventListener("change", applyMode);
		}
		try {
			window.localStorage.setItem("commonspace-color-mode", colorMode);
		} catch {
			// The theme still applies for this session when storage is unavailable.
		}
		return () => {
			if (colorMode === "system" && media !== null)
				media.removeEventListener("change", applyMode);
		};
	}, [colorMode]);

	useEffect(() => {
		try {
			window.localStorage.setItem("commonspace-view", activeDestination);
			window.localStorage.setItem("commonspace-directory-kind", directoryKind);
		} catch {
			// Navigation remains available for this session when storage is unavailable.
		}
	}, [activeDestination, directoryKind]);

	useEffect(() => {
		if (snapshot.bootstrap === null) return;
		if (activeDestination === "project" && activeProjectViewId === null) {
			const projectId = storedUiValue("commonspace-project");
			if (
				projectId !== null &&
				snapshot.bootstrap.state.projects.some(
					(project) => project.id === projectId,
				)
			)
				setActiveProjectViewId(projectId);
			return;
		}
		if (
			activeDestination !== "conversation" ||
			snapshot.activeConversation !== null
		)
			return;
		const raw = storedUiValue("commonspace-navigation");
		const fallbackRaw = storedUiValue("commonspace-conversation");
		if (raw === null && fallbackRaw === null) return;
		const candidate = storedNavigation(raw ?? fallbackRaw);
		if (candidate === null) return;
		const exists =
			candidate.kind === "channel"
				? snapshot.bootstrap.state.channels.some(
						(channel) => channel.id === candidate.id,
					)
				: snapshot.bootstrap.state.agents.some(
						(agent) => agent.id === candidate.id,
					);
		if (exists) {
			store.selectConversation({ kind: candidate.kind, id: candidate.id });
			if (candidate.threadId !== undefined && candidate.kind === "channel") {
				const thread = snapshot.bootstrap.state.threads.find(
					(item) =>
						item.id === candidate.threadId && item.channelId === candidate.id,
				);
				if (thread !== undefined) store.selectThread(thread.id);
			}
		}
	}, [
		activeDestination,
		activeProjectViewId,
		snapshot.activeConversation,
		snapshot.bootstrap,
		store,
	]);

	useEffect(() => {
		if (snapshot.activeConversation === null) return;
		try {
			window.localStorage.setItem(
				"commonspace-navigation",
				JSON.stringify({
					...snapshot.activeConversation,
					threadId: snapshot.activeThreadId,
				}),
			);
			window.localStorage.setItem(
				"commonspace-conversation",
				JSON.stringify(snapshot.activeConversation),
			);
		} catch {
			// Conversation selection remains available for this session.
		}
	}, [snapshot.activeConversation, snapshot.activeThreadId]);

	useEffect(() => {
		if (activeProjectViewId === null) return;
		try {
			window.localStorage.setItem("commonspace-project", activeProjectViewId);
		} catch {
			// Project selection remains available for this session.
		}
	}, [activeProjectViewId]);

	useEffect(() => {
		if (notificationLinkHandled.current || snapshot.bootstrap === null) return;
		const parameters = new URLSearchParams(window.location.search);
		const kind = parameters.get("conversation");
		const conversationId = parameters.get("conversationId");
		const threadId = parameters.get("threadId");
		const messageId = parameters.get("messageId");
		if (
			(kind !== "channel" && kind !== "dm") ||
			conversationId === null ||
			messageId === null ||
			conversationId === "" ||
			conversationId.length > 200 ||
			messageId === "" ||
			messageId.length > 200 ||
			(threadId !== null && (threadId === "" || threadId.length > 200))
		) {
			notificationLinkHandled.current = true;
			return;
		}
		const conversation = { kind, id: conversationId } as const;
		const state = snapshot.bootstrap.state;
		const conversationExists =
			kind === "channel"
				? state.channels.some((channel) => channel.id === conversationId)
				: state.agents.some((agent) => agent.id === conversationId);
		if (!conversationExists) {
			notificationLinkHandled.current = true;
			return;
		}
		const message = state.messages[`${kind}:${conversationId}`]?.find(
			(candidate) => candidate.id === messageId,
		);
		if (message === undefined) return;
		const thread =
			threadId === null
				? undefined
				: state.threads.find((candidate) => candidate.id === threadId);
		const threadMatches =
			kind === "dm"
				? threadId === null
				: threadId === null ||
					(thread !== undefined &&
						thread.channelId === conversationId &&
						(message?.threadId === thread.id ||
							thread.rootMessageId === message?.id));
		notificationLinkHandled.current = true;
		if (!threadMatches) return;
		store.selectConversation(conversation);
		if (thread !== undefined) store.selectThread(thread.id);
		setActiveProjectViewId(null);
		setTargetProjectFile(null);
		setActiveDestination("conversation");
		setTargetMessageId(message.id);
		void store
			.mutate({ action: "mark-inbox-item-read", messageId: message.id })
			.catch(() => undefined);
	}, [snapshot.bootstrap, store]);

	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setNavigationOpen(false);
			if (
				(event.metaKey || event.ctrlKey) &&
				event.key.toLocaleLowerCase() === "k"
			) {
				event.preventDefault();
				setSearchOpen(true);
			}
		};
		window.addEventListener("keydown", closeOnEscape);
		return () => {
			window.removeEventListener("keydown", closeOnEscape);
		};
	}, []);

	const openHome = () => {
		setActiveProjectViewId(null);
		setTargetProjectFile(null);
		setActiveDestination("home");
		setSettingsRequest(null);
		setNavigationOpen(false);
	};

	const openConversation = (
		conversation?: ConversationRef,
		messageId?: string,
	) => {
		if (conversation !== undefined) store.selectConversation(conversation);
		setActiveProjectViewId(null);
		setTargetProjectFile(null);
		setActiveDestination("conversation");
		setTargetMessageId(messageId ?? null);
		setSettingsRequest(null);
		setNavigationOpen(false);
	};

	const openTarget = (target: ConversationTarget) => {
		store.selectConversation(target.conversation);
		store.selectThread(target.threadId ?? null);
		openConversation(undefined, target.messageId);
	};

	const openSession = (session: CommonspaceSessionItem) => {
		const target: ConversationTarget = {
			messageId: session.sourceMessageId,
			conversation: session.conversation,
		};
		if (session.threadId !== undefined) target.threadId = session.threadId;
		openTarget(target);
	};

	const openSearchResult = (result: CommonspaceSearchResult) => {
		setSearchOpen(false);
		if (result.target.kind === "conversation") {
			if (result.target.messageId === undefined) {
				store.selectThread(result.target.threadId ?? null);
				openConversation(result.target.conversation);
			} else {
				const target: ConversationTarget = {
					messageId: result.target.messageId,
					conversation: result.target.conversation,
				};
				if (result.target.threadId !== undefined)
					target.threadId = result.target.threadId;
				openTarget(target);
			}
		} else if (result.target.kind === "project-file") {
			store.selectProject(result.target.projectId);
			setActiveProjectViewId(result.target.projectId);
			setTargetProjectFile({
				rootIndex: result.target.rootIndex,
				path: result.target.path,
			});
			setActiveDestination("project");
		} else {
			openConversation({ kind: "dm", id: result.target.agentId });
		}
	};

	const openDirectory = (kind: CommonspaceDirectoryKind) => {
		setDirectoryKind(kind);
		setActiveProjectViewId(null);
		setTargetProjectFile(null);
		setSettingsRequest(null);
		setActiveDestination("directory");
		setNavigationOpen(false);
	};

	const openInbox = (view: "attention" | "sessions" = "attention") => {
		setActiveProjectViewId(null);
		setTargetProjectFile(null);
		setSettingsRequest(null);
		setInboxViewRequest({ view, token: Date.now() });
		setActiveDestination("inbox");
		setNavigationOpen(false);
	};

	const openContextSettings = (kind: CommonspaceCollectionKind, id: string) => {
		setSettingsRequest({ kind, id, token: Date.now() });
		if (kind === "project") {
			store.selectProject(id);
			setActiveProjectViewId(id);
			setTargetProjectFile(null);
			setActiveDestination("project");
		} else {
			store.selectConversation({
				kind: kind === "channel" ? "channel" : "dm",
				id,
			});
			setActiveProjectViewId(null);
			setTargetProjectFile(null);
		}
		if (kind !== "project") setActiveDestination("conversation");
		setNavigationOpen(false);
	};

	return (
		<div className="relative flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar">
			<CommonspaceTopbar
				homeActive={
					activeDestination === "home" && activeProjectViewId === null
				}
				onOpenHome={openHome}
				onOpenSearch={() => {
					setSearchOpen(true);
				}}
			/>
			<div className="relative grid min-h-0 min-w-0 flex-1 grid-cols-[260px_minmax(0,1fr)] bg-sidebar max-[780px]:grid-cols-1">
				<button
					type="button"
					aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
					aria-expanded={navigationOpen}
					className="absolute top-2 left-3 z-30 hidden size-11 place-items-center rounded-sm border-0 bg-transparent text-foreground hover:bg-muted max-[780px]:grid"
					onClick={() => {
						setNavigationOpen((open) => !open);
					}}
				>
					{navigationOpen ? (
						<XIcon aria-hidden="true" />
					) : (
						<MenuIcon aria-hidden="true" />
					)}
				</button>
				<button
					type="button"
					className={cn(
						"pointer-events-none absolute inset-0 z-10 hidden border-0 bg-black/30 opacity-0 transition-opacity max-[780px]:block",
						navigationOpen &&
							"pointer-events-auto max-[780px]:opacity-100",
					)}
					aria-label="Close navigation"
					aria-hidden={!navigationOpen}
					tabIndex={navigationOpen ? 0 : -1}
					onClick={() => {
						setNavigationOpen(false);
					}}
				/>
				<aside
					className={cn(
						"relative z-20 min-h-0 min-w-0 overflow-hidden bg-sidebar text-sidebar-foreground max-[780px]:absolute max-[780px]:inset-y-0 max-[780px]:left-0 max-[780px]:w-[min(88vw,320px)] max-[780px]:-translate-x-full max-[780px]:shadow-2xl max-[780px]:transition-transform",
						navigationOpen && "max-[780px]:translate-x-0",
					)}
				>
					<CommonspaceSidebar
						wide
						expandSidebar={() => undefined}
						store={store}
						colorMode={colorMode}
						onSetColorMode={setColorMode}
						homeActive={
							activeDestination === "home" && activeProjectViewId === null
						}
						inboxActive={activeDestination === "inbox"}
						threadsActive={activeDestination === "threads"}
						activeProjectViewId={activeProjectViewId}
						createRequest={createRequest}
						onOpenHome={openHome}
						onOpenSearch={() => {
							setSearchOpen(true);
						}}
						onOpenInbox={() => openInbox()}
						onOpenThreads={() => {
							setActiveProjectViewId(null);
							setTargetProjectFile(null);
							setActiveDestination("threads");
							setNavigationOpen(false);
						}}
						onOpenDirectory={openDirectory}
						onOpenContextSettings={openContextSettings}
						onOpenAgentSessions={() => openInbox("sessions")}
						onMentionAgent={(agentName) => {
							setComposerInsertRequest({
								text: `@${agentName} `,
								token: Date.now(),
							});
							setActiveDestination("conversation");
							setNavigationOpen(false);
						}}
						onOpenProject={(projectId, file) => {
							setActiveProjectViewId(projectId);
							setTargetProjectFile(file ?? null);
							setActiveDestination("project");
							setSettingsRequest(null);
							setNavigationOpen(false);
						}}
						onOpenConversation={(messageId) => {
							openConversation(undefined, messageId);
						}}
					/>
				</aside>
				<section className="min-h-0 min-w-0 overflow-hidden bg-background">
					{activeProjectViewId !== null ? (
						<CommonspaceProjectView
							projectId={activeProjectViewId}
							targetFile={targetProjectFile}
							store={store}
							{...(settingsRequest?.kind === "project" &&
							settingsRequest.id === activeProjectViewId
								? { settingsRequest: settingsRequest.token }
								: {})}
							onBack={openHome}
							onOpenConversation={(conversation) => {
								openConversation(conversation);
							}}
						/>
					) : activeDestination === "home" ? (
						<CommonspaceHome
							bootstrap={snapshot.bootstrap}
							onOpenDirectory={openDirectory}
							onOpenSession={openSession}
							onOpenConversation={(conversation) => {
								openConversation(conversation);
							}}
							onStopSession={async (session) => {
								await store.stopAgentRuns(
									session.sourceMessageId,
									session.agentId,
								);
							}}
						/>
					) : activeDestination === "directory" ? (
						<CommonspaceDirectory
							kind={directoryKind}
							bootstrap={snapshot.bootstrap}
							store={store}
							onAdd={(kind) => {
								const singular =
									kind === "projects"
										? "project"
										: kind === "channels"
											? "channel"
											: "agent";
								setCreateRequest({ kind: singular, token: Date.now() });
							}}
							onOpenProject={(projectId) => {
								setActiveProjectViewId(projectId);
								setTargetProjectFile(null);
								setSettingsRequest(null);
								setActiveDestination("project");
							}}
							onOpenConversation={(conversation) => {
								openConversation(conversation);
							}}
							onOpenSettings={openContextSettings}
							onOpenSessions={() => openInbox("sessions")}
						/>
					) : activeDestination === "inbox" ? (
						<CommonspaceInbox
							store={store}
							onOpenItem={openTarget}
							viewRequest={inboxViewRequest}
						/>
					) : activeDestination === "threads" ? (
						<CommonspaceThreads
							bootstrap={snapshot.bootstrap}
							store={store}
							onOpenThread={openTarget}
						/>
					) : (
						<CommonspaceConversation
							store={store}
							composerInsertRequest={composerInsertRequest}
							settingsRequest={
								settingsRequest?.kind === "channel" ||
								settingsRequest?.kind === "agent"
									? {
											kind: settingsRequest.kind,
											id: settingsRequest.id,
											token: settingsRequest.token,
										}
									: null
							}
							targetMessageId={targetMessageId}
							onTargetMessageHandled={() => {
								setTargetMessageId(null);
							}}
						/>
					)}
				</section>
			</div>
			{searchOpen && snapshot.bootstrap !== null && (
				<CommonspaceSearchDialog
					projects={snapshot.bootstrap.state.projects}
					onClose={() => {
						setSearchOpen(false);
					}}
					onSelect={openSearchResult}
				/>
			)}
			{snapshot.error !== null && (
				<div
					className="fixed right-4 bottom-4 z-50 max-w-sm rounded-md border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
					role="alert"
				>
					{snapshot.error}
				</div>
			)}
		</div>
	);
}
