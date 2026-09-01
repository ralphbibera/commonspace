// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	COMMONSPACE_STATE_VERSION,
	type CommonspaceBootstrap,
	type CommonspaceLiveAgentActivity,
} from "../packages/shared/src/contracts.ts";
import { CommonspaceClientStore } from "../ui/src/commonspace-store.ts";
import { mustExist } from "./test-helpers.ts";

function bootstrap(
	revision: number,
	projectName: string,
): CommonspaceBootstrap {
	return {
		agents: [],
		discoveredAgents: [],
		state: {
			version: COMMONSPACE_STATE_VERSION,
			revision,
			defaults: {
				model: null,
				reasoning: "max",
				maxAgentsPerTurn: 4,
				memoryThreads: 12,
			},
			agents: [],
			dmSessions: {},
			agentSessions: {},
			projects: [
				{
					id: `project-${revision}`,
					name: projectName,
					paths: ["/workspace"],
					createdAt: "2026-08-25T00:00:00.000Z",
				},
			],
			channels: [],
			threads: [],
			messages: {},
		},
	};
}

function response<Value>(value: Value): Response {
	return new Response(JSON.stringify(value), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

class FakeEventSource {
	static readonly instances: FakeEventSource[] = [];
	private readonly listeners = new Map<string, EventListener>();
	readonly close = vi.fn();
	onerror: ((event: Event) => void) | null = null;
	onopen: ((event: Event) => void) | null = null;

	constructor() {
		FakeEventSource.instances.push(this);
	}

	addEventListener(type: string, listener: EventListener): void {
		this.listeners.set(type, listener);
	}

	emit(type: string, data: string): void {
		this.listeners.get(type)?.(new MessageEvent(type, { data }));
	}
}

afterEach(() => {
	FakeEventSource.instances.length = 0;
	vi.unstubAllGlobals();
});

describe("Commonspace client revision ordering", () => {
	it("clears a transient live-update error when SSE reconnects without a new revision", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(response(bootstrap(1, "Initial"))),
		);
		vi.stubGlobal("EventSource", FakeEventSource);

		const store = new CommonspaceClientStore();
		await store.refresh();
		store.connectEvents();
		const events = mustExist(FakeEventSource.instances[0]);
		events.onerror?.(new Event("error"));
		expect(store.getSnapshot().error).toContain("disconnected");

		events.onopen?.(new Event("open"));
		expect(store.getSnapshot().error).toBeNull();
	});

	it("keeps live provider activity delivered before bootstrap refresh", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(response(bootstrap(1, "Initial"))),
		);
		vi.stubGlobal("EventSource", FakeEventSource);

		const activity: CommonspaceLiveAgentActivity = {
			id: "run-1",
			agentId: "backend",
			agentName: "Backend",
			adapter: "codex",
			conversation: { kind: "dm", id: "backend" },
			startedAt: "2026-08-25T00:00:00.000Z",
			entries: [],
		};
		const store = new CommonspaceClientStore();
		store.connectEvents();
		mustExist(FakeEventSource.instances[0]).emit(
			"activity",
			JSON.stringify({ activities: [activity] }),
		);
		await store.refresh();

		expect(store.getSnapshot().bootstrap?.liveActivities).toEqual([activity]);
	});

	it("ignores a stale refresh that resolves after a newer mutation", async () => {
		const staleRefresh = deferred<Response>();
		const mutation = deferred<Response>();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(bootstrap(1, "Initial")))
			.mockImplementationOnce(() => staleRefresh.promise)
			.mockImplementationOnce(() => mutation.promise);
		vi.stubGlobal("fetch", fetch);

		const store = new CommonspaceClientStore();
		await store.refresh();
		const refreshing = store.refresh();
		const mutating = store.mutate({
			action: "remove-project",
			projectId: "missing",
		});

		mutation.resolve(response(bootstrap(2, "Newest")));
		await mutating;
		staleRefresh.resolve(response(bootstrap(1, "Stale")));
		await refreshing;

		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
		expect(store.getSnapshot().bootstrap?.state.projects[0]?.name).toBe(
			"Newest",
		);
	});

	it("replaces the agent roster directly from a mutation response", async () => {
		const discovered = {
			id: "codex",
			displayName: "Codex",
			adapter: "codex" as const,
			model: null,
			status: "stopped" as const,
		};
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		updated.agents = [discovered];
		updated.state.agents = [
			{
				id: discovered.id,
				displayName: discovered.displayName,
				adapter: discovered.adapter,
				model: discovered.model,
				createdAt: "2026-08-25T00:00:00.000Z",
			},
		];
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response(updated));
		vi.stubGlobal("fetch", fetch);

		const store = new CommonspaceClientStore();
		await store.refresh();
		await store.mutate({
			action: "add-discovered-agent",
			agentId: discovered.id,
		});

		expect(store.getSnapshot().bootstrap?.agents).toEqual([discovered]);
	});

	it("requests discovery for the selected harness and merges its candidates", async () => {
		const initial = bootstrap(1, "Initial");
		const discovered = bootstrap(1, "Initial");
		discovered.discoveredAgents = [
			{
				id: "backend",
				displayName: "Backend",
				adapter: "hermes",
				model: "gpt-test",
				status: "stopped",
			},
		];
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response(discovered));
		vi.stubGlobal("fetch", fetch);

		const store = new CommonspaceClientStore();
		await store.refresh();
		await store.discoverAgents("hermes");

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/discover-agents",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ adapter: "hermes" }),
			}),
		);
		expect(store.getSnapshot().bootstrap?.discoveredAgents).toEqual(
			discovered.discoveredAgents,
		);
	});

	it("includes the selected agent and inherits thread Projects when sending a direct channel reply", async () => {
		const initial = bootstrap(1, "Initial");
		initial.state.channels = [
			{
				id: "general",
				name: "general",
				projectId: mustExist(initial.state.projects[0]).id,
				agentIds: ["frontend", "backend"],
				instructions: "",
				memory: {
					summary: "",
					decisions: [],
					openQuestions: [],
					threadIds: [],
					updatedAt: null,
				},
				settings: { model: null, reasoning: null },
				createdAt: "2026-08-25T00:00:00.000Z",
			},
		];
		const accepted = {
			id: "reply-2",
			conversation: { kind: "channel" as const, id: "general" },
			authorType: "user" as const,
			authorId: "user",
			authorName: "Ralph",
			text: "Check that boundary again.",
			createdAt: "2026-08-25T00:01:00.000Z",
			threadId: "thread-1",
			parentMessageId: "root-1",
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response({ accepted, state: initial.state }));
		vi.stubGlobal("fetch", fetch);

		const store = new CommonspaceClientStore();
		await store.refresh();
		store.selectConversation({ kind: "channel", id: "general" });
		await store.sendDirectReply(
			"Check that boundary again.",
			"thread-1",
			"frontend",
		);

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/send",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					conversation: { kind: "channel", id: "general" },
					text: "Check that boundary again.",
					threadId: "thread-1",
					targetAgentId: "frontend",
				}),
			}),
		);
	});

	it("sends explicit Thread Project references including projectless scope", async () => {
		const initial = bootstrap(1, "Initial");
		const accepted = {
			id: "reply-projectless",
			conversation: { kind: "channel" as const, id: "general" },
			authorType: "user" as const,
			authorId: "user",
			authorName: "Ralph",
			text: "Continue projectless.",
			createdAt: "2026-08-25T00:01:00.000Z",
			threadId: "thread-1",
			parentMessageId: "root-1",
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response({ accepted, state: initial.state }));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		store.selectConversation({ kind: "channel", id: "general" });

		const send = store.send;
		await send.call(
			store,
			"Continue projectless.",
			"thread-1",
			[],
			undefined,
			[],
		);

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/send",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					conversation: { kind: "channel", id: "general" },
					text: "Continue projectless.",
					projectIds: [],
					threadId: "thread-1",
				}),
			}),
		);
	});

	it("posts a routing correction and merges the accepted state revision", async () => {
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		const request = {
			sourceMessageId: "root-1",
			assignmentId: "assignment-1",
			agentId: "reviewer",
			subRequest: "Review only the UI boundary.",
			projectIds: ["project-1"],
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(
				response({
					sourceMessageId: request.sourceMessageId,
					assignment: {
						id: "assignment-2",
						agentId: request.agentId,
						subRequest: request.subRequest,
						projectIds: request.projectIds,
					},
					correction: {
						id: "correction-1",
						fromAssignmentId: request.assignmentId,
						toAssignmentId: "assignment-2",
						createdAt: "2026-08-30T00:00:00.000Z",
					},
					state: updated.state,
				}),
			);
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();

		const reroute = store.rerouteAssignment;
		await reroute.call(store, request);

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/reroute",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(request),
			}),
		);
		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
	});

	it("updates Thread context and refreshes its durable state", async () => {
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		const request = {
			summary: "Focused Thread context.",
			decisions: ["Keep the fix scoped."],
			openQuestions: ["Does verification pass?"],
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response({ channelSnapshot: {}, memory: request }))
			.mockResolvedValueOnce(response(updated));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();

		const updateThreadContext = store.updateThreadContext;
		await updateThreadContext.call(store, "thread-1", request);

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/threads/thread-1/context",
			expect.objectContaining({
				method: "PUT",
				body: JSON.stringify(request),
			}),
		);
		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
	});

	it("compacts Thread context and refreshes its durable state", async () => {
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(
				response({ channelSnapshot: {}, memory: { summary: "Compacted." } }),
			)
			.mockResolvedValueOnce(response(updated));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();

		const compactThreadContext = store.compactThreadContext;
		await compactThreadContext.call(store, "thread-1");

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/threads/thread-1/context/compact",
			expect.objectContaining({ method: "POST" }),
		);
		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
	});

	it("compacts Channel context and refreshes its durable state", async () => {
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response({ summary: "Compacted Channel." }))
			.mockResolvedValueOnce(response(updated));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();

		const compactChannelContext = store.compactChannelContext;
		await compactChannelContext.call(store, "general");

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/channels/general/context/compact",
			expect.objectContaining({ method: "POST" }),
		);
		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
	});

	it("adds and removes shared-context pins with durable refreshes", async () => {
		const initial = bootstrap(1, "Initial");
		const afterAdd = bootstrap(2, "Initial");
		const afterRemove = bootstrap(3, "Initial");
		const pin = {
			id: "pin-1",
			scope: { kind: "thread" as const, id: "thread-1" },
			kind: "note" as const,
			note: "Keep this visible.",
			createdAt: "2026-08-30T00:00:00.000Z",
			removedAt: null,
		};
		afterAdd.state.pins = [pin];
		afterRemove.state.pins = [
			{ ...pin, removedAt: "2026-08-30T00:01:00.000Z" },
		];
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response(pin))
			.mockResolvedValueOnce(response(afterAdd))
			.mockResolvedValueOnce(
				response({ ...pin, removedAt: "2026-08-30T00:01:00.000Z" }),
			)
			.mockResolvedValueOnce(response(afterRemove));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		const pinStore = store;

		await pinStore.addPin({
			scope: { kind: "thread", id: "thread-1" },
			kind: "note",
			note: "Keep this visible.",
		});
		await pinStore.removePin("pin-1");

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/pins",
			expect.objectContaining({ method: "POST" }),
		);
		expect(fetch).toHaveBeenNthCalledWith(
			4,
			"/api/pins/pin-1/remove",
			expect.objectContaining({ method: "POST" }),
		);
		expect(store.getSnapshot().bootstrap?.state.pins[0]?.removedAt).toBe(
			"2026-08-30T00:01:00.000Z",
		);
	});

	it("edits a message and focuses the returned conversation branch", async () => {
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		const accepted = {
			id: "edited-1",
			conversation: { kind: "channel" as const, id: "general" },
			authorType: "user" as const,
			authorId: "user",
			authorName: "Ralph",
			text: "Corrected message.",
			createdAt: "2026-08-30T00:00:00.000Z",
			threadId: "thread-2",
			versionRootMessageId: "root-1",
			supersedesMessageId: "root-1",
			branchId: "branch-1",
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(
				response({
					accepted,
					thread: { id: "thread-2" },
					state: updated.state,
				}),
			);
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		const editMessage = store.editMessage;

		await editMessage.call(store, "root-1", { text: "Corrected message." });

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/messages/root-1/edit",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ text: "Corrected message." }),
			}),
		);
		expect(store.getSnapshot()).toMatchObject({
			activeThreadId: "thread-2",
			bootstrap: { state: { revision: 2 } },
		});
	});

	it("deletes a message and refreshes its durable marker", async () => {
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(
				response({
					id: "root-1",
					text: "",
					deletedAt: "2026-08-30T00:00:00.000Z",
				}),
			)
			.mockResolvedValueOnce(response(updated));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		const deleteMessage = store.deleteMessage;

		await deleteMessage.call(store, "root-1");

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/messages/root-1/delete",
			expect.objectContaining({ method: "POST" }),
		);
		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
	});

	it("refreshes again when an SSE revision arrives during an in-flight refresh", async () => {
		const firstRefresh = deferred<Response>();
		const followUpRefresh = deferred<Response>();
		const latest = bootstrap(2, "Initial");
		latest.state.messages["dm:backend"] = [
			{
				id: "reply-1",
				conversation: { kind: "dm", id: "backend" },
				authorType: "agent",
				authorId: "backend",
				authorName: "Backend",
				text: "Reply arrived",
				createdAt: "2026-08-25T00:00:00.000Z",
			},
		];
		const fetch = vi
			.fn()
			.mockImplementationOnce(() => firstRefresh.promise)
			.mockImplementationOnce(() => followUpRefresh.promise);
		vi.stubGlobal("fetch", fetch);
		vi.stubGlobal("EventSource", FakeEventSource);

		const store = new CommonspaceClientStore();
		store.connectEvents();
		const refreshing = store.refresh();
		mustExist(FakeEventSource.instances[0]).emit(
			"revision",
			JSON.stringify({ revision: 2 }),
		);
		firstRefresh.resolve(response(bootstrap(1, "Initial")));
		await refreshing;

		await vi.waitFor(() => {
			expect(fetch).toHaveBeenCalledTimes(2);
		});
		followUpRefresh.resolve(response(latest));
		await vi.waitFor(() => {
			expect(
				store.getSnapshot().bootstrap?.state.messages["dm:backend"]?.[0]?.text,
			).toBe("Reply arrived");
		});
	});

	it("includes pasted image payloads in the send request", async () => {
		const initial = bootstrap(1, "Initial");
		const accepted = bootstrap(2, "Initial");
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(
				response({
					accepted: {
						id: "message-1",
						conversation: { kind: "dm", id: "backend" },
						authorType: "user",
						authorId: "user",
						authorName: "Ralph",
						text: "Inspect this",
						createdAt: "2026-08-27T00:00:00.000Z",
					},
					state: accepted.state,
				}),
			);
		vi.stubGlobal("fetch", fetch);

		const store = new CommonspaceClientStore();
		await store.refresh();
		store.selectConversation({ kind: "dm", id: "backend" });
		await store.send("Inspect this", undefined, [
			{
				name: "clipboard.png",
				mimeType: "image/png",
				data: "iVBORw==",
			},
		]);

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/send",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					conversation: { kind: "dm", id: "backend" },
					text: "Inspect this",
					attachments: [
						{ name: "clipboard.png", mimeType: "image/png", data: "iVBORw==" },
					],
				}),
			}),
		);
	});

	it("includes general file payloads in the send request", async () => {
		const initial = bootstrap(1, "Initial");
		const accepted = bootstrap(2, "Initial");
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(
				response({
					accepted: {
						id: "message-file",
						conversation: { kind: "dm", id: "backend" },
						authorType: "user",
						authorId: "user",
						authorName: "Ralph",
						text: "Inspect file",
						createdAt: "2026-08-31T00:00:00.000Z",
					},
					state: accepted.state,
				}),
			);
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		store.selectConversation({ kind: "dm", id: "backend" });
		const send = store.send;

		await send.call(
			store,
			"Inspect file",
			undefined,
			[],
			undefined,
			undefined,
			[
				{
					name: "notes.txt",
					mimeType: "text/plain",
					data: "bm90ZXM=",
				},
			],
		);

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/send",
			expect.objectContaining({
				body: JSON.stringify({
					conversation: { kind: "dm", id: "backend" },
					text: "Inspect file",
					files: [
						{ name: "notes.txt", mimeType: "text/plain", data: "bm90ZXM=" },
					],
				}),
			}),
		);
	});

	it("responds with an exact permission option and refreshes state", async () => {
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(
				response({
					id: "permission-1",
					status: "resolved",
					selectedOptionId: "allow",
				}),
			)
			.mockResolvedValueOnce(response(updated));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		const respondPermission = store.respondPermission;

		await respondPermission.call(store, "permission-1", "allow");

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/permissions/permission-1/respond",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ optionId: "allow" }),
			}),
		);
		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
	});

	it("fetches runtime diagnostics on demand", async () => {
		const initial = bootstrap(1, "Initial");
		const diagnostics = {
			service: { status: "ready" },
			inference: { location: "local" },
			harnesses: [],
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response(diagnostics));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();

		await expect(store.diagnostics()).resolves.toEqual(diagnostics);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/diagnostics",
			expect.any(Object),
		);
	});

	it("exports and imports a mapped workspace archive", async () => {
		const initial = bootstrap(1, "Initial");
		const imported = bootstrap(2, "Imported");
		const archive = {
			format: "commonspace-workspace" as const,
			version: 1 as const,
			exportedAt: "2026-08-31T00:00:00.000Z",
			workspace: {
				projects: [{ id: "project-1", name: "Imported", rootCount: 1 }],
			},
			attachments: [],
		};
		const mappings = { "project-1": ["/mapped/project"] };
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response(archive))
			.mockResolvedValueOnce(response(imported.state));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		const portableStore = store;

		await expect(portableStore.exportWorkspace()).resolves.toEqual(archive);
		await portableStore.importWorkspace(archive, mappings);

		expect(fetch).toHaveBeenNthCalledWith(2, "/api/export", expect.any(Object));
		expect(fetch).toHaveBeenNthCalledWith(
			3,
			"/api/import",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ archive, projectMappings: mappings }),
			}),
		);
		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
	});

	it("previews and applies explicit conversation retention", async () => {
		const initial = bootstrap(1, "Initial");
		const updated = bootstrap(2, "Initial");
		const conversation = { kind: "channel" as const, id: "general" };
		const preview = {
			revision: 1,
			conversation,
			messages: 4,
			threads: 2,
			attachments: 1,
			pins: 1,
			permissions: 0,
		};
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(response(initial))
			.mockResolvedValueOnce(response(preview))
			.mockResolvedValueOnce(response(preview))
			.mockResolvedValueOnce(response(updated));
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		const retentionStore = store;

		await expect(
			retentionStore.previewRetention(conversation),
		).resolves.toEqual(preview);
		await retentionStore.applyRetention(preview);

		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/retention/preview",
			expect.objectContaining({ body: JSON.stringify({ conversation }) }),
		);
		expect(fetch).toHaveBeenNthCalledWith(
			3,
			"/api/retention/apply",
			expect.objectContaining({
				body: JSON.stringify({ conversation, expectedRevision: 1 }),
			}),
		);
		expect(store.getSnapshot().bootstrap?.state.revision).toBe(2);
	});
});
