import type {
	CommonspaceSearchResult,
	ConversationRef,
} from "@commonspace/shared";
import { useEffect, useRef, useState } from "react";
import type { CommonspaceDirectoryKind } from "../CommonspaceDirectory.tsx";
import type {
	CommonspaceClientSnapshot,
	CommonspaceStore,
} from "../commonspace-store.ts";
import type { CommonspaceCollectionKind } from "../design-system/CollectionActionMenu.tsx";

type CommonspaceDestination =
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

interface StoredNavigation {
	kind: "channel" | "dm";
	id: string;
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

function storedNavigation(raw: string | null): StoredNavigation | null {
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
		const navigation: StoredNavigation = {
			kind: value.kind,
			id: value.id,
		};
		if (typeof threadId === "string") navigation.threadId = threadId;
		return navigation;
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
		: "inbox";
}

function initialDirectoryKind(): CommonspaceDirectoryKind {
	const saved = storedUiValue("commonspace-directory-kind");
	return saved === "channels" || saved === "agents" ? saved : "projects";
}

export function useCommonspaceNavigation(
	store: CommonspaceStore,
	snapshot: CommonspaceClientSnapshot,
) {
	const [navigationOpen, setNavigationOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
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
		if (!exists) return;
		store.selectConversation({ kind: candidate.kind, id: candidate.id });
		if (candidate.threadId === undefined || candidate.kind !== "channel")
			return;
		const thread = snapshot.bootstrap.state.threads.find(
			(item) =>
				item.id === candidate.threadId && item.channelId === candidate.id,
		);
		if (thread !== undefined) store.selectThread(thread.id);
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
						(message.threadId === thread.id ||
							thread.rootMessageId === message.id));
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
		const handleKeyboardNavigation = (event: KeyboardEvent) => {
			if (event.key === "Escape") setNavigationOpen(false);
			if (
				(event.metaKey || event.ctrlKey) &&
				event.key.toLocaleLowerCase() === "k"
			) {
				event.preventDefault();
				setSearchOpen(true);
			}
		};
		window.addEventListener("keydown", handleKeyboardNavigation);
		return () => {
			window.removeEventListener("keydown", handleKeyboardNavigation);
		};
	}, []);

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

	const openSearchResult = (result: CommonspaceSearchResult) => {
		setSearchOpen(false);
		if (result.target.kind === "conversation") {
			if (result.target.messageId === undefined) {
				store.selectThread(result.target.threadId ?? null);
				openConversation(result.target.conversation);
				return;
			}
			const target: ConversationTarget = {
				messageId: result.target.messageId,
				conversation: result.target.conversation,
			};
			if (result.target.threadId !== undefined)
				target.threadId = result.target.threadId;
			openTarget(target);
			return;
		}
		if (result.target.kind === "project-file") {
			store.selectProject(result.target.projectId);
			setActiveProjectViewId(result.target.projectId);
			setTargetProjectFile({
				rootIndex: result.target.rootIndex,
				path: result.target.path,
			});
			setActiveDestination("project");
			return;
		}
		openConversation({ kind: "dm", id: result.target.agentId });
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
			setActiveDestination("conversation");
		}
		setNavigationOpen(false);
	};

	const openProject = (
		projectId: string,
		file?: { rootIndex: number; path: string },
	) => {
		setActiveProjectViewId(projectId);
		setTargetProjectFile(file ?? null);
		setActiveDestination("project");
		setSettingsRequest(null);
		setNavigationOpen(false);
	};

	const requestCreate = (kind: CommonspaceDirectoryKind) => {
		const singular =
			kind === "projects"
				? "project"
				: kind === "channels"
					? "channel"
					: "agent";
		setCreateRequest({ kind: singular, token: Date.now() });
	};

	return {
		activeDestination,
		activeProjectViewId,
		closeNavigation: () => setNavigationOpen(false),
		closeSearch: () => setSearchOpen(false),
		composerInsertRequest,
		createRequest,
		directoryKind,
		inboxViewRequest,
		mentionAgent: (agentName: string) => {
			setComposerInsertRequest({ text: `@${agentName} `, token: Date.now() });
			setActiveDestination("conversation");
			setNavigationOpen(false);
		},
		navigationOpen,
		openContextSettings,
		openConversation,
		openDirectory,
		openInbox,
		openProject,
		openSearch: () => setSearchOpen(true),
		openSearchResult,
		openTarget,
		openThreads: () => {
			setActiveProjectViewId(null);
			setTargetProjectFile(null);
			setActiveDestination("threads");
			setNavigationOpen(false);
		},
		requestCreate,
		searchOpen,
		settingsRequest,
		targetMessageId,
		targetProjectFile,
		clearSettingsRequest: () => setSettingsRequest(null),
		clearTargetMessage: () => setTargetMessageId(null),
		toggleNavigation: () => setNavigationOpen((open) => !open),
	};
}

export type CommonspaceNavigation = ReturnType<typeof useCommonspaceNavigation>;
