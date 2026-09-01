import type {
	AddPinRequest,
	AgentAdapterKind,
	CommonspaceBootstrap,
	CommonspaceDiagnostics,
	CommonspaceLiveAgentActivity,
	CommonspaceMessage,
	CommonspaceMutation,
	CommonspacePermissionRequest,
	CommonspacePin,
	CommonspaceQueuedFollowup,
	CommonspaceRetentionPreview,
	CommonspaceRoutingConfiguration,
	CommonspaceState,
	CommonspaceWorkspaceArchive,
	ConversationRef,
	EditMessageRequest,
	FollowupQueueResponse,
	RerouteAssignmentRequest,
	RerouteAssignmentResponse,
	SelectDirectoryResponse,
	SendFileAttachment,
	SendImageAttachment,
	SendMessageRequest,
	SendMessageResponse,
	StopAgentRunsResponse,
	UpdateRoutingConfigurationRequest,
	UpdateThreadContextRequest,
	UpdateWorkspaceSettingsRequest,
} from "@commonspace/shared";
import { conversationKey } from "@commonspace/shared";

export interface CommonspaceClientSnapshot {
	bootstrap: CommonspaceBootstrap | null;
	loading: boolean;
	sending: boolean;
	error: string | null;
	activeConversation: ConversationRef | null;
	activeProjectId: string | null;
	activeThreadId: string | null;
}

type Listener = () => void;
const LIVE_UPDATES_DISCONNECTED =
	"Commonspace live updates disconnected; retrying…";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
		...init,
		headers: {
			"content-type": "application/json",
			...init?.headers,
		},
	});
	const value: T = await response.json();
	if (!response.ok) {
		const error: unknown = value;
		throw new Error(
			typeof error === "object" &&
				error !== null &&
				"error" in error &&
				typeof error.error === "string" &&
				error.error !== ""
				? error.error
				: `Commonspace request failed (${String(response.status)})`,
		);
	}
	return value;
}

export type CommonspaceStore = Pick<
	CommonspaceClientStore,
	keyof CommonspaceClientStore
>;

export class CommonspaceClientStore {
	private snapshot: CommonspaceClientSnapshot = {
		bootstrap: null,
		loading: false,
		sending: false,
		error: null,
		activeConversation: null,
		activeProjectId: null,
		activeThreadId: null,
	};
	private readonly listeners = new Set<Listener>();
	private refreshPromise: Promise<void> | null = null;
	private discoveryRequest = 0;
	private pendingRevision = -1;
	private pendingLiveActivities: CommonspaceLiveAgentActivity[] | null = null;
	private events: EventSource | null = null;

	getSnapshot = (): CommonspaceClientSnapshot => this.snapshot;

	subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	async refresh(): Promise<void> {
		if (this.refreshPromise !== null) return this.refreshPromise;
		this.set({ ...this.snapshot, loading: true, error: null });
		let refreshSucceeded = false;
		const task = requestJson<CommonspaceBootstrap>("/api/bootstrap")
			.then((bootstrap) => {
				refreshSucceeded = true;
				const liveActivities = this.pendingLiveActivities;
				this.pendingLiveActivities = null;
				const merged = this.mergeBootstrap(
					liveActivities === null
						? bootstrap
						: { ...bootstrap, liveActivities },
				);
				this.set({
					...this.snapshot,
					bootstrap: merged,
					loading: false,
					activeProjectId: this.resolveActiveProject(merged),
				});
			})
			.catch((cause: unknown) => {
				this.set({
					...this.snapshot,
					loading: false,
					error: cause instanceof Error ? cause.message : String(cause),
				});
			})
			.finally(() => {
				this.refreshPromise = null;
				const currentRevision = this.snapshot.bootstrap?.state.revision ?? -1;
				if (this.pendingRevision <= currentRevision) this.pendingRevision = -1;
				else if (refreshSucceeded) void this.refresh();
			});
		this.refreshPromise = task;
		return task;
	}

	connectEvents(): void {
		if (this.events !== null || typeof EventSource === "undefined") return;
		const events = new EventSource("/api/events");
		events.addEventListener("revision", (event) => {
			try {
				if (!(event instanceof MessageEvent) || typeof event.data !== "string")
					return;
				const value: {
					revision?: number;
				} = JSON.parse(event.data);
				if (
					typeof value.revision === "number" &&
					value.revision > (this.snapshot.bootstrap?.state.revision ?? -1)
				) {
					this.pendingRevision = Math.max(this.pendingRevision, value.revision);
					void this.refresh();
				}
			} catch {
				// Ignore malformed event frames; EventSource will continue.
			}
		});
		events.addEventListener("activity", (event) => {
			try {
				if (!(event instanceof MessageEvent) || typeof event.data !== "string")
					return;
				const value: {
					activities?: CommonspaceLiveAgentActivity[];
					queuedFollowups?: CommonspaceQueuedFollowup[];
				} = JSON.parse(event.data);
				if (!Array.isArray(value.activities)) return;
				const activities = value.activities;
				this.pendingLiveActivities = activities;
				const bootstrap = this.snapshot.bootstrap;
				if (bootstrap === null) return;
				const queuedFollowups = Array.isArray(value.queuedFollowups)
					? value.queuedFollowups
					: bootstrap.queuedFollowups;
				const nextBootstrap = { ...bootstrap, liveActivities: activities };
				if (queuedFollowups !== undefined)
					nextBootstrap.queuedFollowups = queuedFollowups;
				this.set({
					...this.snapshot,
					bootstrap: nextBootstrap,
				});
			} catch {
				// Ignore malformed event frames; EventSource will continue.
			}
		});
		events.onerror = () => {
			this.set({ ...this.snapshot, error: LIVE_UPDATES_DISCONNECTED });
		};
		events.onopen = () => {
			if (this.snapshot.error === LIVE_UPDATES_DISCONNECTED)
				this.set({ ...this.snapshot, error: null });
		};
		this.events = events;
	}

	disconnectEvents(): void {
		this.events?.close();
		this.events = null;
	}

	async mutate(mutation: CommonspaceMutation): Promise<void> {
		try {
			const result = await requestJson<CommonspaceBootstrap>("/api/mutate", {
				method: "POST",
				body: JSON.stringify(mutation),
			});
			const merged = this.mergeBootstrap(result);
			this.set({
				...this.snapshot,
				bootstrap: merged,
				activeProjectId: this.resolveActiveProject(merged),
				error: null,
			});
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async updateRoutingConfiguration(
		request: UpdateRoutingConfigurationRequest,
	): Promise<void> {
		try {
			const routing = await requestJson<CommonspaceRoutingConfiguration>(
				"/api/routing",
				{
					method: "PUT",
					body: JSON.stringify(request),
				},
			);
			const bootstrap = this.snapshot.bootstrap;
			const next = { ...this.snapshot, error: null };
			if (bootstrap !== null) next.bootstrap = { ...bootstrap, routing };
			this.set({
				...next,
			});
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async validateRoutingConfiguration(
		request: UpdateRoutingConfigurationRequest,
	): Promise<CommonspaceDiagnostics["inference"]> {
		return requestJson<CommonspaceDiagnostics["inference"]>(
			"/api/routing/validate",
			{ method: "POST", body: JSON.stringify(request) },
		);
	}

	async updateWorkspaceSettings(
		request: UpdateWorkspaceSettingsRequest,
	): Promise<void> {
		try {
			const result = await requestJson<CommonspaceBootstrap>("/api/settings", {
				method: "PUT",
				body: JSON.stringify(request),
			});
			const merged = this.mergeBootstrap(result);
			this.set({
				...this.snapshot,
				bootstrap: merged,
				activeProjectId: this.resolveActiveProject(merged),
				error: null,
			});
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async discoverAgents(adapter: AgentAdapterKind): Promise<void> {
		const request = ++this.discoveryRequest;
		this.set({ ...this.snapshot, loading: true, error: null });
		try {
			const result = await requestJson<CommonspaceBootstrap>(
				"/api/discover-agents",
				{
					method: "POST",
					body: JSON.stringify({ adapter }),
				},
			);
			if (request !== this.discoveryRequest) return;
			const merged = this.mergeBootstrap(result);
			this.set({
				...this.snapshot,
				bootstrap: merged,
				loading: false,
				error: null,
			});
		} catch (error) {
			if (request !== this.discoveryRequest) return;
			this.set({
				...this.snapshot,
				loading: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	async selectDirectory(): Promise<string | null> {
		try {
			const result = await requestJson<SelectDirectoryResponse>(
				"/api/select-directory",
				{ method: "POST" },
			);
			if (result.path !== null && typeof result.path !== "string")
				throw new Error("folder picker returned an invalid path");
			this.set({ ...this.snapshot, error: null });
			return result.path;
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	selectConversation(conversation: ConversationRef): void {
		this.set({
			...this.snapshot,
			activeConversation: conversation,
			activeThreadId: null,
			error: null,
		});
	}

	selectThread(threadId: string | null): void {
		this.set({ ...this.snapshot, activeThreadId: threadId, error: null });
	}

	selectProject(projectId: string): void {
		this.set({ ...this.snapshot, activeProjectId: projectId, error: null });
	}

	messages(
		conversation: ConversationRef | null = this.snapshot.activeConversation,
	): CommonspaceMessage[] {
		if (conversation === null) return [];
		return (
			this.snapshot.bootstrap?.state.messages[conversationKey(conversation)] ??
			[]
		);
	}

	async send(
		text: string,
		threadId?: string,
		attachments: readonly SendImageAttachment[] = [],
		delivery?: SendMessageRequest["delivery"],
		projectIds?: readonly string[],
		files: readonly SendFileAttachment[] = [],
	): Promise<void> {
		return this.sendMessage(
			text,
			threadId,
			undefined,
			attachments,
			delivery,
			projectIds,
			files,
		);
	}

	async sendDirectReply(
		text: string,
		threadId: string,
		targetAgentId: string,
		attachments: readonly SendImageAttachment[] = [],
		projectIds?: readonly string[],
		files: readonly SendFileAttachment[] = [],
	): Promise<void> {
		return this.sendMessage(
			text,
			threadId,
			targetAgentId,
			attachments,
			undefined,
			projectIds,
			files,
		);
	}

	async rerouteAssignment(request: RerouteAssignmentRequest): Promise<void> {
		try {
			const result = await requestJson<RerouteAssignmentResponse>(
				"/api/reroute",
				{
					method: "POST",
					body: JSON.stringify(request),
				},
			);
			const bootstrap = this.snapshot.bootstrap;
			if (bootstrap === null) {
				await this.refresh();
				return;
			}
			const merged = this.mergeBootstrap({ ...bootstrap, state: result.state });
			this.set({
				...this.snapshot,
				bootstrap: merged,
				activeProjectId: this.resolveActiveProject(merged),
				error: null,
			});
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async updateThreadContext(
		threadId: string,
		request: UpdateThreadContextRequest,
	): Promise<void> {
		try {
			await requestJson(
				`/api/threads/${encodeURIComponent(threadId)}/context`,
				{
					method: "PUT",
					body: JSON.stringify(request),
				},
			);
			await this.refresh();
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async compactThreadContext(threadId: string): Promise<void> {
		try {
			await requestJson(
				`/api/threads/${encodeURIComponent(threadId)}/context/compact`,
				{ method: "POST" },
			);
			await this.refresh();
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async compactChannelContext(channelId: string): Promise<void> {
		try {
			await requestJson(
				`/api/channels/${encodeURIComponent(channelId)}/context/compact`,
				{ method: "POST" },
			);
			await this.refresh();
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async addPin(request: AddPinRequest): Promise<void> {
		try {
			await requestJson<CommonspacePin>("/api/pins", {
				method: "POST",
				body: JSON.stringify(request),
			});
			await this.refresh();
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async removePin(pinId: string): Promise<void> {
		try {
			await requestJson<CommonspacePin>(
				`/api/pins/${encodeURIComponent(pinId)}/remove`,
				{ method: "POST" },
			);
			await this.refresh();
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async editMessage(
		messageId: string,
		request: Omit<EditMessageRequest, "messageId">,
	): Promise<void> {
		try {
			const result = await requestJson<SendMessageResponse>(
				`/api/messages/${encodeURIComponent(messageId)}/edit`,
				{
					method: "POST",
					body: JSON.stringify(request),
				},
			);
			const bootstrap = this.snapshot.bootstrap;
			if (bootstrap === null) {
				await this.refresh();
				return;
			}
			const merged = this.mergeBootstrap({ ...bootstrap, state: result.state });
			this.set({
				...this.snapshot,
				bootstrap: merged,
				activeProjectId: this.resolveActiveProject(merged),
				activeThreadId: result.thread?.id ?? this.snapshot.activeThreadId,
				error: null,
			});
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async deleteMessage(messageId: string): Promise<void> {
		try {
			await requestJson<CommonspaceMessage>(
				`/api/messages/${encodeURIComponent(messageId)}/delete`,
				{ method: "POST" },
			);
			await this.refresh();
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async respondPermission(
		permissionId: string,
		optionId: string,
	): Promise<void> {
		try {
			await requestJson<CommonspacePermissionRequest>(
				`/api/permissions/${encodeURIComponent(permissionId)}/respond`,
				{
					method: "POST",
					body: JSON.stringify({ optionId }),
				},
			);
			await this.refresh();
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async diagnostics(): Promise<CommonspaceDiagnostics> {
		try {
			const diagnostics =
				await requestJson<CommonspaceDiagnostics>("/api/diagnostics");
			this.set({ ...this.snapshot, error: null });
			return diagnostics;
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async exportWorkspace(): Promise<CommonspaceWorkspaceArchive> {
		return requestJson<CommonspaceWorkspaceArchive>("/api/export");
	}

	async importWorkspace(
		archive: CommonspaceWorkspaceArchive,
		projectMappings: Record<string, string[]>,
	): Promise<void> {
		try {
			const state = await requestJson<CommonspaceState>("/api/import", {
				method: "POST",
				body: JSON.stringify({ archive, projectMappings }),
			});
			const bootstrap = this.snapshot.bootstrap;
			if (bootstrap === null) {
				await this.refresh();
				return;
			}
			const merged = this.mergeBootstrap({ ...bootstrap, state });
			this.set({
				...this.snapshot,
				bootstrap: merged,
				activeProjectId: this.resolveActiveProject(merged),
				activeConversation: null,
				activeThreadId: null,
				error: null,
			});
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async previewRetention(
		conversation: ConversationRef,
	): Promise<CommonspaceRetentionPreview> {
		return requestJson<CommonspaceRetentionPreview>("/api/retention/preview", {
			method: "POST",
			body: JSON.stringify({ conversation }),
		});
	}

	async applyRetention(preview: CommonspaceRetentionPreview): Promise<void> {
		try {
			await requestJson<CommonspaceRetentionPreview>("/api/retention/apply", {
				method: "POST",
				body: JSON.stringify({
					conversation: preview.conversation,
					expectedRevision: preview.revision,
				}),
			});
			await this.refresh();
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async stopAgentRuns(messageId: string, agentId?: string): Promise<string[]> {
		try {
			const request: { messageId: string; agentId?: string } = { messageId };
			if (agentId !== undefined) request.agentId = agentId;
			const result = await requestJson<StopAgentRunsResponse>("/api/stop", {
				method: "POST",
				body: JSON.stringify(request),
			});
			this.set({ ...this.snapshot, error: null });
			return result.stoppedAgentIds;
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async reorderFollowup(
		messageId: string,
		direction: "up" | "down",
	): Promise<void> {
		await this.updateFollowupQueue("/api/followups/reorder", {
			messageId,
			direction,
		});
	}

	async removeFollowup(messageId: string): Promise<void> {
		await this.updateFollowupQueue("/api/followups/remove", { messageId });
	}

	private async updateFollowupQueue(
		path: string,
		body:
			| { messageId: string }
			| { messageId: string; direction: "up" | "down" },
	): Promise<void> {
		try {
			const result = await requestJson<FollowupQueueResponse>(path, {
				method: "POST",
				body: JSON.stringify(body),
			});
			const bootstrap = this.snapshot.bootstrap;
			const next = { ...this.snapshot, error: null };
			if (bootstrap !== null)
				next.bootstrap = {
					...bootstrap,
					queuedFollowups: result.queuedFollowups,
				};
			this.set(next);
		} catch (error) {
			this.set({
				...this.snapshot,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	private async sendMessage(
		text: string,
		threadId?: string,
		targetAgentId?: string,
		attachments: readonly SendImageAttachment[] = [],
		delivery?: SendMessageRequest["delivery"],
		projectIds?: readonly string[],
		files: readonly SendFileAttachment[] = [],
	): Promise<void> {
		const conversation = this.snapshot.activeConversation;
		if (conversation === null || this.snapshot.sending) return;
		const request: SendMessageRequest = {
			conversation,
			text,
		};
		if (projectIds !== undefined) request.projectIds = [...projectIds];
		if (threadId !== undefined) request.threadId = threadId;
		if (targetAgentId !== undefined) request.targetAgentId = targetAgentId;
		if (attachments.length > 0) request.attachments = [...attachments];
		if (files.length > 0) request.files = [...files];
		if (delivery !== undefined) request.delivery = delivery;
		this.set({ ...this.snapshot, sending: true, error: null });
		try {
			const result = await requestJson<SendMessageResponse>("/api/send", {
				method: "POST",
				body: JSON.stringify(request),
			});
			const bootstrap = this.snapshot.bootstrap;
			if (bootstrap !== null) {
				const merged = this.mergeBootstrap({
					...bootstrap,
					state: result.state,
				});
				this.set({
					...this.snapshot,
					sending: false,
					bootstrap: merged,
					activeProjectId: this.resolveActiveProject(merged),
					activeThreadId: result.thread?.id ?? this.snapshot.activeThreadId,
				});
			} else {
				await this.refresh();
				this.set({ ...this.snapshot, sending: false });
			}
		} catch (error) {
			this.set({
				...this.snapshot,
				sending: false,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	private set(snapshot: CommonspaceClientSnapshot): void {
		this.snapshot = snapshot;
		for (const listener of this.listeners) listener();
	}

	private mergeBootstrap(
		candidate: CommonspaceBootstrap,
	): CommonspaceBootstrap {
		const current = this.snapshot.bootstrap;
		if (current !== null && candidate.state.revision < current.state.revision)
			return current;
		if (
			candidate.liveActivities === undefined &&
			current?.liveActivities !== undefined
		) {
			return { ...candidate, liveActivities: current.liveActivities };
		}
		return candidate;
	}

	private resolveActiveProject(bootstrap: CommonspaceBootstrap): string | null {
		const current = this.snapshot.activeProjectId;
		if (
			current !== null &&
			bootstrap.state.projects.some((project) => project.id === current)
		)
			return current;
		return bootstrap.state.projects[0]?.id ?? null;
	}
}
