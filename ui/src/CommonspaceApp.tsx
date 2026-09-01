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

export interface CommonspaceAppProps {
	store: CommonspaceStore;
}

type CommonspaceDestination =
	| "home"
	| "conversation"
	| "directory"
	| "inbox"
	| "threads";

interface ConversationTarget {
	messageId: string;
	conversation: ConversationRef;
	threadId?: string;
}

export function CommonspaceApp({ store }: CommonspaceAppProps) {
	const snapshot = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
	const [navigationOpen, setNavigationOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [activeDestination, setActiveDestination] =
		useState<CommonspaceDestination>("home");
	const [directoryKind, setDirectoryKind] =
		useState<CommonspaceDirectoryKind>("projects");
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
		const message = state.messages[`${kind}:${conversationId}`]?.find(
			(candidate) => candidate.id === messageId,
		);
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
		if (!conversationExists || message === undefined || !threadMatches) return;
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
		let messageId = target.messageId;
		if (target.conversation.kind === "channel") {
			const messages =
				snapshot.bootstrap?.state.messages[
					`channel:${target.conversation.id}`
				] ?? [];
			const sourceMessage = messages.find(
				(message) => message.id === target.messageId,
			);
			messageId = sourceMessage?.parentMessageId ?? target.messageId;
		}
		openConversation(undefined, messageId);
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
			setActiveDestination("conversation");
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
		} else {
			store.selectConversation({
				kind: kind === "channel" ? "channel" : "dm",
				id,
			});
			setActiveProjectViewId(null);
			setTargetProjectFile(null);
		}
		setActiveDestination("conversation");
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
						"absolute inset-0 z-10 hidden border-0 bg-black/30 opacity-0 transition-opacity max-[780px]:block",
						navigationOpen && "max-[780px]:opacity-100",
					)}
					aria-label="Close navigation"
					tabIndex={navigationOpen ? 0 : -1}
					onClick={() => {
						setNavigationOpen(false);
					}}
				/>
				<aside
					className={cn(
						"relative z-20 min-h-0 min-w-0 overflow-hidden bg-sidebar text-sidebar-foreground max-[780px]:absolute max-[780px]:inset-y-0 max-[780px]:left-0 max-[780px]:w-[min(88vw,320px)] max-[780px]:-translate-x-full max-[780px]:pt-12 max-[780px]:shadow-2xl max-[780px]:transition-transform",
						navigationOpen && "max-[780px]:translate-x-0",
					)}
				>
					<CommonspaceSidebar
						wide
						expandSidebar={() => undefined}
						store={store}
						homeActive={
							activeDestination === "home" && activeProjectViewId === null
						}
						inboxActive={activeDestination === "inbox"}
						threadsActive={activeDestination === "threads"}
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
							setActiveDestination("conversation");
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
								setActiveDestination("conversation");
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
