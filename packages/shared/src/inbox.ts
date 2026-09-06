import type {
	CommonspaceAgentDefinition,
	CommonspaceLiveAgentActivity,
	CommonspaceMessage,
	CommonspaceState,
	ConversationRef,
} from "./contracts.js";
import { referencedProjectIds } from "./contracts.js";

export type CommonspaceInboxItemKind =
	| "agent-reply"
	| "thread-reply"
	| "mention"
	| "failure"
	| "completion"
	| "timeout"
	| "input-request"
	| "possible-input-request"
	| "permission-request";

export interface CommonspaceInboxItem {
	id: string;
	messageId: string;
	sessionId: string;
	kind: CommonspaceInboxItemKind;
	actorId: string;
	actorName: string;
	conversation: ConversationRef;
	conversationName: string;
	threadId?: string;
	createdAt: string;
	text: string;
	unread: boolean;
	saved: boolean;
	muted: boolean;
}

export type CommonspaceSessionStatus =
	| "running"
	| "needs-attention"
	| "completed";

export interface CommonspaceSessionItem {
	id: string;
	sourceMessageId: string;
	messageId: string;
	agentId: string;
	agentName: string;
	conversation: ConversationRef;
	conversationName: string;
	projectName: string | null;
	threadId?: string;
	status: CommonspaceSessionStatus;
	attentionKind?:
		| "failure"
		| "timeout"
		| "input-request"
		| "possible-input-request"
		| "permission-request";
	summary: string;
	updatedAt: string;
	followed: boolean;
	muted: boolean;
}

function conciseText(value: string, fallback: string): string {
	const text = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
	return text === "" ? fallback : text.slice(0, 240);
}

function timestampValue(value: string): number | null {
	const timestamp = Date.parse(value);
	return Number.isNaN(timestamp) ? null : timestamp;
}

function conversationName(
	conversation: ConversationRef,
	channelNames: ReadonlyMap<string, string>,
	agents: ReadonlyMap<string, CommonspaceAgentDefinition>,
): string {
	if (conversation.kind === "channel") {
		const name = channelNames.get(conversation.id);
		return name === undefined ? "Channel" : `#${name}`;
	}
	return agents.get(conversation.id)?.displayName ?? "Direct message";
}

function isTimeout(value: string): boolean {
	return /\b(?:timed?\s*out|timeout)\b/iu.test(value);
}

export function explicitlyRequestsInput(value: string): boolean {
	const needsSomething = /\b(?:i|we)\s+need\s+(?!(?:no|nothing|neither)\b)/iu;
	const explicitBlocker =
		/\b(?:i\s+am\s+waiting\s+for|we\s+are\s+waiting\s+for|please\s+(?:provide|choose|confirm|answer)|(?:cannot|can't|unable\s+to)\s+continue|blocked\s+(?:on|until|by))\b/iu;
	return needsSomething.test(value) || explicitBlocker.test(value);
}

function mentionsOwner(value: string): boolean {
	return /(^|\s)@(?:ralph|user)\b/iu.test(value);
}

function sourceMessageId(message: CommonspaceMessage): string {
	return message.sourceMessageId ?? message.parentMessageId ?? message.id;
}

function sessionId(message: CommonspaceMessage, agentId: string): string {
	return `${sourceMessageId(message)}:${agentId}`;
}

function inboxKind(
	message: CommonspaceMessage,
): CommonspaceInboxItemKind | null {
	if (message.authorType === "agent") {
		if (mentionsOwner(message.text)) return "mention";
		if (explicitlyRequestsInput(message.text)) return "possible-input-request";
		return "completion";
	}
	if (message.replyStatus === "needs_input") return "input-request";
	if (
		(message.authorType === "system" && /\brun failed:/iu.test(message.text)) ||
		message.replyStatus === "error" ||
		message.replyStatus === "failed" ||
		message.replyStatus === "timeout" ||
		message.replyStatus === "silent"
	) {
		return isTimeout(message.replyError ?? message.text) ||
			message.replyStatus === "timeout"
			? "timeout"
			: "failure";
	}
	return null;
}

type CommonspacePermission = NonNullable<
	CommonspaceState["permissions"]
>[number];

interface InboxContext {
	agents: ReadonlyMap<string, CommonspaceAgentDefinition>;
	channelNames: ReadonlyMap<string, string>;
	readAt: number | null;
	readMessageIds: ReadonlySet<string>;
	unreadMessageIds: ReadonlySet<string>;
	savedMessageIds: ReadonlySet<string>;
	mutedSessionIds: ReadonlySet<string>;
	failedSources: ReadonlySet<string>;
	pendingPermissionSources: ReadonlySet<string>;
	confirmedInputSources: ReadonlySet<string>;
}

function messageIds(
	messages: readonly CommonspaceMessage[],
	predicate: (message: CommonspaceMessage) => boolean,
): ReadonlySet<string> {
	return new Set(messages.filter(predicate).map((message) => message.id));
}

function createInboxContext(state: CommonspaceState): InboxContext {
	const messages = Object.values(state.messages).flat();
	return {
		agents: new Map(state.agents.map((agent) => [agent.id, agent])),
		channelNames: new Map(
			state.channels.map((channel) => [channel.id, channel.name]),
		),
		readAt:
			state.inboxReadAt === null ? null : timestampValue(state.inboxReadAt),
		readMessageIds: new Set(state.inboxReadMessageIds),
		unreadMessageIds: new Set(state.inboxUnreadMessageIds ?? []),
		savedMessageIds: new Set(state.inboxSavedItemIds),
		mutedSessionIds: new Set(state.mutedSessionIds),
		failedSources: messageIds(
			messages,
			(message) =>
				message.authorType === "user" &&
				(message.replyStatus === "error" ||
					message.replyStatus === "failed" ||
					message.replyStatus === "timeout" ||
					message.replyStatus === "silent"),
		),
		pendingPermissionSources: new Set(
			(state.permissions ?? [])
				.filter((permission) => permission.status === "pending")
				.map((permission) => permission.sourceMessageId),
		),
		confirmedInputSources: messageIds(
			messages,
			(message) =>
				message.authorType === "user" && message.replyStatus === "needs_input",
		),
	};
}

function shouldSkipInboxMessage(
	message: CommonspaceMessage,
	kind: CommonspaceInboxItemKind,
	context: InboxContext,
): boolean {
	if (
		message.authorType === "user" &&
		kind === "input-request" &&
		context.pendingPermissionSources.has(message.id)
	)
		return true;
	if (
		kind === "possible-input-request" &&
		message.sourceMessageId !== undefined &&
		context.confirmedInputSources.has(message.sourceMessageId)
	)
		return true;
	return (
		message.authorType === "system" &&
		message.sourceMessageId !== undefined &&
		context.failedSources.has(message.sourceMessageId)
	);
}

function inboxActor(
	message: CommonspaceMessage,
	agents: ReadonlyMap<string, CommonspaceAgentDefinition>,
): { id: string; name: string } {
	if (message.authorType === "user") {
		const id =
			message.conversation.kind === "dm" ? message.conversation.id : "system";
		return {
			id,
			name: agents.get(id)?.displayName ?? "Commonspace",
		};
	}
	if (message.authorType === "system") {
		const id = message.text.match(/^@([^\s]+)\s/u)?.[1] ?? "system";
		return {
			id,
			name: agents.get(id)?.displayName ?? "Commonspace",
		};
	}
	return {
		id: message.authorId,
		name: agents.get(message.authorId)?.displayName ?? message.authorName,
	};
}

function isUnread(
	messageId: string,
	createdAt: string,
	muted: boolean,
	context: InboxContext,
): boolean {
	if (muted) return false;
	if (context.unreadMessageIds.has(messageId)) return true;
	if (context.readMessageIds.has(messageId)) return false;
	const created = timestampValue(createdAt);
	return (
		context.readAt === null || (created !== null && created > context.readAt)
	);
}

function messageInboxItem(
	message: CommonspaceMessage,
	kind: CommonspaceInboxItemKind,
	context: InboxContext,
): CommonspaceInboxItem {
	const actor = inboxActor(message, context.agents);
	const itemSessionId = sessionId(message, actor.id);
	const muted = context.mutedSessionIds.has(itemSessionId);
	const item: CommonspaceInboxItem = {
		id: `message:${message.id}`,
		messageId: message.id,
		sessionId: itemSessionId,
		kind,
		actorId: actor.id,
		actorName: actor.name,
		conversation: message.conversation,
		conversationName: conversationName(
			message.conversation,
			context.channelNames,
			context.agents,
		),
		createdAt: message.createdAt,
		text: conciseText(
			message.replyError ?? message.text,
			kind === "failure" ? "Agent run failed." : "Agent activity updated.",
		),
		unread: isUnread(message.id, message.createdAt, muted, context),
		saved: context.savedMessageIds.has(message.id),
		muted,
	};
	if (message.threadId !== undefined) item.threadId = message.threadId;
	return item;
}

function permissionInboxItem(
	permission: CommonspacePermission,
	context: InboxContext,
): CommonspaceInboxItem {
	const itemSessionId = `${permission.sourceMessageId}:${permission.agentId}`;
	const muted = context.mutedSessionIds.has(itemSessionId);
	const item: CommonspaceInboxItem = {
		id: `permission:${permission.id}`,
		messageId: permission.sourceMessageId,
		sessionId: itemSessionId,
		kind: "permission-request",
		actorId: permission.agentId,
		actorName:
			context.agents.get(permission.agentId)?.displayName ?? permission.agentId,
		conversation: permission.conversation,
		conversationName: conversationName(
			permission.conversation,
			context.channelNames,
			context.agents,
		),
		createdAt: permission.createdAt,
		text: conciseText(permission.title, "Permission requested."),
		unread: isUnread(
			permission.sourceMessageId,
			permission.createdAt,
			muted,
			context,
		),
		saved: context.savedMessageIds.has(permission.sourceMessageId),
		muted,
	};
	if (permission.threadId !== undefined) item.threadId = permission.threadId;
	return item;
}

function compareInboxItems(
	left: CommonspaceInboxItem,
	right: CommonspaceInboxItem,
): number {
	const leftTime = timestampValue(left.createdAt);
	const rightTime = timestampValue(right.createdAt);
	if (leftTime === rightTime) return right.id.localeCompare(left.id);
	if (leftTime === null) return 1;
	if (rightTime === null) return -1;
	return rightTime - leftTime;
}

/** Derive the single-owner attention Inbox from persisted run outcomes. */
export function deriveCommonspaceInboxItems(
	state: CommonspaceState,
): CommonspaceInboxItem[] {
	const context = createInboxContext(state);
	const items: CommonspaceInboxItem[] = [];

	for (const messages of Object.values(state.messages)) {
		for (const message of messages) {
			const kind = inboxKind(message);
			if (kind === null || shouldSkipInboxMessage(message, kind, context))
				continue;
			items.push(messageInboxItem(message, kind, context));
		}
	}

	for (const permission of state.permissions ?? []) {
		if (permission.status !== "pending") continue;
		items.push(permissionInboxItem(permission, context));
	}

	return items.sort(compareInboxItems);
}

type CommonspaceSessionAttention = NonNullable<
	CommonspaceSessionItem["attentionKind"]
>;

interface SessionContext {
	agents: ReadonlyMap<string, CommonspaceAgentDefinition>;
	channelNames: ReadonlyMap<string, string>;
	projects: ReadonlyMap<string, string>;
	threads: ReadonlyMap<string, CommonspaceState["threads"][number]>;
	messagesById: ReadonlyMap<string, CommonspaceMessage>;
	followed: ReadonlySet<string>;
	muted: ReadonlySet<string>;
}

function projectName(
	projectIds: readonly string[],
	projects: ReadonlyMap<string, string>,
): string | null {
	const names = projectIds.flatMap(
		(projectId) => projects.get(projectId) ?? [],
	);
	return names.length === 0 ? null : names.join(" · ");
}

function sessionProjectName(
	message: CommonspaceMessage,
	threadId: string | undefined,
	projects: ReadonlyMap<string, string>,
	threads: ReadonlyMap<string, CommonspaceState["threads"][number]>,
): string | null {
	const directProjectIds = referencedProjectIds(message);
	if (directProjectIds.length > 0)
		return projectName(directProjectIds, projects);
	if (threadId === undefined) return null;
	return projectName(
		referencedProjectIds(threads.get(threadId) ?? {}),
		projects,
	);
}

function attentionKind(
	kind: CommonspaceInboxItemKind,
): CommonspaceSessionAttention | undefined {
	switch (kind) {
		case "failure":
		case "timeout":
		case "input-request":
		case "possible-input-request":
		case "permission-request":
			return kind;
		default:
			return undefined;
	}
}

function sessionFromInboxItem(
	item: CommonspaceInboxItem,
	message: CommonspaceMessage,
	sessions: ReadonlyMap<string, CommonspaceSessionItem>,
	context: SessionContext,
): CommonspaceSessionItem | undefined {
	const sourceId = sourceMessageId(message);
	const source = context.messagesById.get(sourceId) ?? message;
	const itemAttentionKind = attentionKind(item.kind);
	const current = sessions.get(item.sessionId);
	if (
		current?.attentionKind === "permission-request" &&
		itemAttentionKind !== "permission-request"
	)
		return undefined;
	const session: CommonspaceSessionItem = {
		id: item.sessionId,
		sourceMessageId: sourceId,
		messageId: item.messageId,
		agentId: item.actorId,
		agentName: item.actorName,
		conversation: item.conversation,
		conversationName: item.conversationName,
		projectName: sessionProjectName(
			source,
			item.threadId,
			context.projects,
			context.threads,
		),
		status: itemAttentionKind === undefined ? "completed" : "needs-attention",
		summary: item.text,
		updatedAt: item.createdAt,
		followed: context.followed.has(item.sessionId),
		muted: context.muted.has(item.sessionId),
	};
	if (item.threadId !== undefined) session.threadId = item.threadId;
	if (itemAttentionKind !== undefined)
		session.attentionKind = itemAttentionKind;
	return session;
}

function sessionFromLiveActivity(
	activity: CommonspaceLiveAgentActivity,
	sessions: ReadonlyMap<string, CommonspaceSessionItem>,
	context: SessionContext,
): CommonspaceSessionItem | undefined {
	const id = `${activity.sourceMessageId}:${activity.agentId}`;
	const current = sessions.get(id);
	if (current?.attentionKind === "permission-request") return undefined;
	const source = context.messagesById.get(activity.sourceMessageId);
	const latestEntry = activity.entries.at(-1);
	const session: CommonspaceSessionItem = {
		id,
		sourceMessageId: activity.sourceMessageId,
		messageId: current?.messageId ?? activity.sourceMessageId,
		agentId: activity.agentId,
		agentName: activity.agentName,
		conversation: activity.conversation,
		conversationName: conversationName(
			activity.conversation,
			context.channelNames,
			context.agents,
		),
		projectName:
			source === undefined
				? null
				: sessionProjectName(
						source,
						activity.threadId,
						context.projects,
						context.threads,
					),
		status: "running",
		summary: latestEntry?.type === "tool" ? latestEntry.title : "Working…",
		updatedAt: activity.startedAt,
		followed: context.followed.has(id),
		muted: context.muted.has(id),
	};
	if (activity.threadId !== undefined) session.threadId = activity.threadId;
	return session;
}

function compareSessions(
	left: CommonspaceSessionItem,
	right: CommonspaceSessionItem,
): number {
	const statusRank: Record<CommonspaceSessionStatus, number> = {
		running: 0,
		"needs-attention": 1,
		completed: 2,
	};
	const byStatus = statusRank[left.status] - statusRank[right.status];
	if (byStatus !== 0) return byStatus;
	return (
		(timestampValue(right.updatedAt) ?? 0) -
		(timestampValue(left.updatedAt) ?? 0)
	);
}

/** Derive compact session supervision rows from persisted outcomes and current live runs. */
export function deriveCommonspaceSessions(
	state: CommonspaceState,
	liveActivities: readonly CommonspaceLiveAgentActivity[] = [],
): CommonspaceSessionItem[] {
	const messages = Object.values(state.messages).flat();
	const context: SessionContext = {
		agents: new Map(state.agents.map((agent) => [agent.id, agent])),
		channelNames: new Map(
			state.channels.map((channel) => [channel.id, channel.name]),
		),
		projects: new Map(
			state.projects.map((project) => [project.id, project.name]),
		),
		threads: new Map(state.threads.map((thread) => [thread.id, thread])),
		messagesById: new Map(messages.map((message) => [message.id, message])),
		followed: new Set(state.followedSessionIds),
		muted: new Set(state.mutedSessionIds),
	};
	const sessions = new Map<string, CommonspaceSessionItem>();

	for (const item of deriveCommonspaceInboxItems(state)) {
		const message = context.messagesById.get(item.messageId);
		if (message === undefined) continue;
		const session = sessionFromInboxItem(item, message, sessions, context);
		if (session !== undefined) sessions.set(item.sessionId, session);
	}

	for (const activity of liveActivities) {
		const id = `${activity.sourceMessageId}:${activity.agentId}`;
		const session = sessionFromLiveActivity(activity, sessions, context);
		if (session !== undefined) sessions.set(id, session);
	}

	return [...sessions.values()].sort(compareSessions);
}
