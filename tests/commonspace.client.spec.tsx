// @vitest-environment jsdom

import {
	COMMONSPACE_STATE_VERSION,
	type CommonspaceBootstrap,
	type CommonspaceState,
} from "@commonspace/shared";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommonspaceSidebar } from "../ui/src/CommonspaceSidebar.tsx";
import type { CommonspaceStore } from "../ui/src/commonspace-store.ts";
import { tagReferenceParts, tagSuggestions } from "../ui/src/tagging.ts";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function state(overrides: Partial<CommonspaceState> = {}): CommonspaceState {
	return {
		version: COMMONSPACE_STATE_VERSION,
		revision: 0,
		defaults: {
			model: null,
			reasoning: "max",
			maxAgentsPerTurn: 4,
			memoryThreads: 12,
		},
		agents: [],
		dmSessions: {},
		agentSessions: {},
		projects: [],
		channels: [],
		threads: [],
		pins: [],
		messages: {},
		...overrides,
	};
}

function sidebarStore(
	bootstrap: Partial<CommonspaceBootstrap> = {},
	additions: Partial<CommonspaceStore> = {},
) {
	const mutate = vi.fn(async () => undefined);
	const snapshot = {
		bootstrap: {
			agents: [],
			discoveredAgents: [],
			state: state(),
			...bootstrap,
		},
		loading: false,
		sending: false,
		error: null,
		activeConversation: null,
		activeProjectId: null,
		activeThreadId: null,
	};
	return {
		mutate,
		store: {
			subscribe: () => () => undefined,
			getSnapshot: () => snapshot,
			refresh: vi.fn(async () => undefined),
			discoverAgents: vi.fn(async () => undefined),
			mutate,
			selectConversation: vi.fn(),
			selectThread: vi.fn(),
			selectProject: vi.fn(),
			...additions,
		},
	};
}

describe("Commonspace interface", () => {
	it("checks and reads back the configured inference source", async () => {
		const diagnostics = vi.fn(async () => ({
			service: {
				status: "ready",
				stateVersion: 2,
				storage: "ready",
				projectlessWorkspace: "ready",
			},
			inference: {
				provider: "openai-compatible",
				location: "remote",
				configured: true,
				sends: ["routing"],
			},
			harnesses: [],
		}));
		const { store } = sidebarStore(
			{
				routing: {
					provider: "openai-compatible",
					model: "gpt-test",
					baseUrl: "https://example.test/v1",
					apiKeyConfigured: true,
				},
			},
			{ diagnostics },
		);
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Commonspace settings" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Check configuration" }),
		);

		await waitFor(() => {
			expect(diagnostics).toHaveBeenCalledOnce();
			expect(
				screen.getByRole("status", { name: "Inference configuration status" })
					.textContent,
			).toContain("Configuration verified");
		});
	});

	it("configures OS notifications without changing durable Inbox behavior", async () => {
		const updateRoutingConfiguration = vi.fn(async () => undefined);
		const { store, mutate } = sidebarStore(
			{
				state: state({
					notifications: {
						enabled: false,
						replies: true,
						mentions: true,
						permissions: true,
						failures: true,
						sound: false,
					},
				}),
			},
			{ updateRoutingConfiguration },
		);
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Commonspace settings" }),
		);

		fireEvent.click(screen.getByLabelText("Enable OS notifications"));
		fireEvent.click(screen.getByLabelText("Reply notifications"));
		fireEvent.click(screen.getByLabelText("Notification sound"));
		fireEvent.click(
			screen.getByRole("button", { name: "Save notification settings" }),
		);

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith({
				action: "set-notifications",
				notifications: {
					enabled: true,
					replies: false,
					mentions: true,
					permissions: true,
					failures: true,
					sound: true,
				},
			});
			expect(updateRoutingConfiguration).not.toHaveBeenCalled();
		});
	});

	it("previews and confirms scoped retention without hidden deletion", async () => {
		const channel = {
			id: "general",
			name: "general",
			agentIds: [],
			instructions: "",
			memory: {
				summary: "",
				decisions: [],
				openQuestions: [],
				threadIds: [],
				updatedAt: null,
			},
			routingMemory: {
				summary: "",
				status: "empty" as const,
				correctionCount: 0,
				compactedThroughCorrectionId: null,
				updatedAt: null,
			},
			settings: { model: null, reasoning: null },
			createdAt: "",
		};
		const preview = {
			revision: 7,
			conversation: { kind: "channel" as const, id: "general" },
			messages: 12,
			threads: 3,
			attachments: 2,
			pins: 1,
			permissions: 0,
		};
		const previewRetention = vi.fn(async () => preview);
		const applyRetention = vi.fn(async () => undefined);
		const { store } = sidebarStore(
			{ state: state({ revision: 7, channels: [channel] }) },
			{ previewRetention, applyRetention },
		);
		vi.spyOn(window, "confirm").mockReturnValue(true);
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Commonspace settings" }),
		);

		fireEvent.change(screen.getByLabelText("Retention conversation"), {
			target: { value: "channel:general" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Preview retention" }));
		const impact = await screen.findByRole("region", {
			name: "Retention impact",
		});
		expect(
			within(impact).getByText(
				"12 messages · 3 threads · 2 attachments · 1 pin",
			),
		).toBeTruthy();
		fireEvent.click(
			within(impact).getByRole("button", { name: "Apply retention" }),
		);

		await waitFor(() => {
			expect(applyRetention).toHaveBeenCalledWith(preview);
		});
	});

	it("exports data and requires explicit local-root mappings before import", async () => {
		const archive = {
			format: "commonspace-workspace" as const,
			version: 1 as const,
			exportedAt: "2026-08-31T00:00:00.000Z",
			workspace: {
				projects: [
					{
						id: "imported-project",
						name: "Imported App",
						rootCount: 2,
						createdAt: "",
					},
				],
			},
			attachments: [],
		};
		const exportWorkspace = vi.fn(async () => archive);
		const importWorkspace = vi.fn(async () => undefined);
		const selectDirectory = vi
			.fn()
			.mockResolvedValueOnce("/mapped/primary")
			.mockResolvedValueOnce("/mapped/context");
		vi.stubGlobal("URL", {
			...URL,
			createObjectURL: vi.fn(() => "blob:export"),
			revokeObjectURL: vi.fn(),
		});
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
			() => undefined,
		);
		const { store } = sidebarStore(
			{},
			{ exportWorkspace, importWorkspace, selectDirectory },
		);
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Commonspace settings" }),
		);

		fireEvent.click(
			screen.getByRole("button", { name: "Export workspace data" }),
		);
		await waitFor(() => {
			expect(exportWorkspace).toHaveBeenCalledOnce();
		});

		const file = new File(
			[JSON.stringify(archive)],
			"commonspace-export.json",
			{ type: "application/json" },
		);
		fireEvent.change(screen.getByLabelText("Import workspace archive"), {
			target: { files: [file] },
		});
		const mappings = await screen.findByRole("region", {
			name: "Import Project mappings",
		});
		fireEvent.click(
			within(mappings).getByRole("button", {
				name: "Choose root 1 for Imported App",
			}),
		);
		fireEvent.click(
			within(mappings).getByRole("button", {
				name: "Choose root 2 for Imported App",
			}),
		);
		await waitFor(() => {
			expect(within(mappings).getByText("/mapped/context")).toBeTruthy();
		});
		fireEvent.click(
			within(mappings).getByRole("button", { name: "Import workspace data" }),
		);

		await waitFor(() => {
			expect(importWorkspace).toHaveBeenCalledWith(archive, {
				"imported-project": ["/mapped/primary", "/mapped/context"],
			});
		});
	});

	it("shows runtime readiness, inference disclosure, and recovery guidance", async () => {
		const diagnostics = vi.fn(async () => ({
			service: {
				status: "ready",
				stateVersion: 24,
				storage: "ready",
				projectlessWorkspace: "ready",
			},
			inference: {
				provider: "openai-compatible",
				location: "remote",
				configured: true,
				sends: [
					"message text",
					"Agent labels",
					"Project labels",
					"shared context",
					"routing corrections",
				],
			},
			harnesses: [
				{
					adapter: "codex",
					installed: true,
					rostered: true,
					runReadiness: "unknown",
					recovery: "Authenticate with Codex and retry.",
				},
			],
		}));
		const { store } = sidebarStore({}, { diagnostics });
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "Commonspace settings" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Run runtime diagnostics" }),
		);

		const panel = await screen.findByRole("region", {
			name: "Runtime diagnostics",
		});
		expect(within(panel).getByText("Remote inference")).toBeTruthy();
		expect(
			within(panel).getByText(/message text · Agent labels · Project labels/u),
		).toBeTruthy();
		expect(
			within(panel).getByText("Authenticate with Codex and retry."),
		).toBeTruthy();
	});

	it("edits, compacts, and pins canonical Channel context", async () => {
		const compactChannelContext = vi.fn(async () => undefined);
		const addPin = vi.fn(async () => undefined);
		const removePin = vi.fn(async () => undefined);
		const channel = {
			id: "general",
			name: "general",
			agentIds: [],
			instructions: "Keep work scoped.",
			memory: {
				summary: "Existing Channel summary.",
				decisions: ["Existing decision."],
				openQuestions: ["Existing question?"],
				threadIds: [],
				updatedAt: "2026-08-30T00:00:00.000Z",
				origin: "user" as const,
				status: "current" as const,
				sourceMessageCount: 1,
				estimatedTokens: 10,
				compactedThroughMessageId: "message-1",
			},
			routingMemory: {
				summary: "",
				status: "empty" as const,
				correctionCount: 0,
				compactedThroughCorrectionId: null,
				updatedAt: null,
			},
			settings: { model: null, reasoning: null },
			createdAt: "2026-08-30T00:00:00.000Z",
		};
		const { store, mutate } = sidebarStore(
			{
				state: state({
					channels: [channel],
					pins: [
						{
							id: "channel-pin-1",
							scope: { kind: "channel", id: channel.id },
							kind: "note",
							note: "Pinned Channel guidance.",
							createdAt: "2026-08-30T00:00:00.000Z",
							removedAt: null,
						},
					],
				}),
			},
			{ compactChannelContext, addPin, removePin },
		);
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "Manage agents in channel general" }),
		);
		fireEvent.change(screen.getByLabelText("Channel summary for general"), {
			target: { value: "Updated Channel summary." },
		});
		fireEvent.change(screen.getByLabelText("Channel decisions for general"), {
			target: { value: "Decision one.\nDecision two." },
		});
		fireEvent.click(
			screen.getByRole("button", {
				name: "Compact context for channel general",
			}),
		);
		expect(compactChannelContext).toHaveBeenCalledWith("general");
		fireEvent.click(
			screen.getByRole("button", {
				name: "Remove Channel pin Pinned Channel guidance.",
			}),
		);
		expect(removePin).toHaveBeenCalledWith("channel-pin-1");
		const note = screen.getByLabelText("New Channel pin note for general");
		fireEvent.change(note, { target: { value: "New Channel pin." } });
		fireEvent.click(
			screen.getByRole("button", { name: "Add Channel pin note for general" }),
		);
		expect(addPin).toHaveBeenCalledWith({
			scope: { kind: "channel", id: "general" },
			kind: "note",
			note: "New Channel pin.",
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Save channel general" }),
		);

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledTimes(1);
			expect(mutate).toHaveBeenCalledWith({
				action: "set-channel-configuration",
				channelId: "general",
				agentIds: [],
				instructions: "Keep work scoped.",
				model: null,
				reasoning: null,
				summary: "Updated Channel summary.",
				decisions: ["Decision one.", "Decision two."],
				openQuestions: ["Existing question?"],
			});
		});
	});

	it("keeps each agent runtime status visible in the sidebar", () => {
		const agents = [
			{
				id: "agentops",
				displayName: "AgentOps",
				adapter: "hermes" as const,
				model: "gpt-test",
				status: "unknown" as const,
			},
			{
				id: "backend",
				displayName: "Backend",
				adapter: "hermes" as const,
				model: "gpt-test",
				status: "stopped" as const,
			},
			{
				id: "frontend",
				displayName: "Frontend",
				adapter: "hermes" as const,
				model: "gpt-test",
				status: "unknown" as const,
			},
		];
		const { store } = sidebarStore({
			agents,
			liveActivities: [
				{
					id: "run-agentops",
					sourceMessageId: "message-1",
					agentId: "agentops",
					agentName: "AgentOps",
					adapter: "hermes",
					conversation: { kind: "dm", id: "agentops" },
					startedAt: "2026-08-28T00:00:00.000Z",
					entries: [],
				},
			],
		});

		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		expect(screen.getByText("online").getAttribute("data-status")).toBe(
			"running",
		);
		expect(screen.getByText("available").getAttribute("data-status")).toBe(
			"stopped",
		);
		expect(screen.getByText("configured").getAttribute("data-status")).toBe(
			"unknown",
		);
		expect(getComputedStyle(screen.getByText("online")).display).not.toBe(
			"none",
		);
	});

	it("formats and suggests agent, project, and channel references", () => {
		expect(
			tagReferenceParts("Ask @backend about @@commonspace in #general"),
		).toEqual([
			{ text: "Ask ", kind: "text" },
			{ text: "@backend", kind: "agent" },
			{ text: " about ", kind: "text" },
			{ text: "@@commonspace", kind: "project" },
			{ text: " in ", kind: "text" },
			{ text: "#general", kind: "channel" },
		]);

		const bootstrap: CommonspaceBootstrap = {
			agents: [
				{
					id: "backend",
					displayName: "Backend",
					adapter: "hermes",
					model: "x",
					status: "running",
				},
				{
					id: "default",
					displayName: "AgentOps",
					adapter: "hermes",
					model: "x",
					status: "running",
				},
				{
					id: "codex-default",
					displayName: "default (Codex)",
					adapter: "codex",
					nativeProfile: "default",
					model: "x",
					status: "unknown",
				},
			],
			discoveredAgents: [],
			state: state({
				projects: [
					{ id: "project-1", name: "Client Portal", paths: [], createdAt: "" },
				],
				channels: [
					{
						id: "general",
						name: "general",
						projectId: null,
						agentIds: [],
						instructions: "",
						memory: {
							summary: "",
							decisions: [],
							openQuestions: [],
							threadIds: [],
							updatedAt: null,
						},
						settings: { model: null, reasoning: null },
						createdAt: "",
					},
				],
			}),
		};
		expect(tagReferenceParts("@anything", bootstrap)).toEqual([
			{ text: "@anything", kind: "text" },
		]);
		expect(
			tagReferenceParts("@backend @@client-portal #general", bootstrap),
		).toEqual([
			{ text: "@backend", kind: "agent" },
			{ text: " ", kind: "text" },
			{ text: "@@client-portal", kind: "project" },
			{ text: " ", kind: "text" },
			{ text: "#general", kind: "channel" },
		]);
		expect(tagSuggestions("Please ask @ba", bootstrap)).toEqual([
			{ kind: "agent", id: "backend", label: "Backend", token: "@backend" },
		]);
		expect(tagSuggestions("Please ask @ag", bootstrap)).toEqual([
			{ kind: "agent", id: "default", label: "AgentOps", token: "@agentops" },
		]);
		expect(tagSuggestions("Please ask @def", bootstrap)).toEqual([
			{
				kind: "agent",
				id: "codex-default",
				label: "default (Codex)",
				token: "@default-codex",
			},
		]);
		expect(tagSuggestions("Please ask @all", bootstrap)).toEqual([
			{ kind: "agent", id: "all", label: "All agents", token: "@all" },
		]);
		expect(tagSuggestions("Please inspect @@client-p", bootstrap)).toEqual([
			{
				kind: "project",
				id: "project-1",
				label: "Client Portal",
				token: "@@client-portal",
			},
		]);
	});

	it("searches unified history, highlights receipts, and opens the matching thread", async () => {
		const { store } = sidebarStore({
			agents: [
				{
					id: "frontend",
					displayName: "Frontend",
					adapter: "hermes",
					model: null,
					status: "running",
				},
				{
					id: "backend",
					displayName: "Backend",
					adapter: "codex",
					model: null,
					status: "unknown",
				},
			],
			state: state({
				projects: [
					{
						id: "storefront",
						name: "Storefront",
						paths: ["/work/storefront"],
						createdAt: "",
					},
				],
				channels: [
					{
						id: "general",
						name: "general",
						projectId: null,
						agentIds: ["frontend"],
						instructions: "",
						memory: {
							summary: "",
							decisions: [],
							openQuestions: [],
							threadIds: [],
							updatedAt: null,
						},
						settings: { model: null, reasoning: null },
						createdAt: "",
					},
				],
				messages: {
					"channel:general": [
						{
							id: "message-1",
							conversation: { kind: "channel", id: "general" },
							authorType: "user",
							authorId: "ralph",
							authorName: "Ralph",
							text: "The deployment plan is in the launch checklist.",
							createdAt: "2026-08-26T00:00:00.000Z",
						},
					],
				},
			}),
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							query: "launch checklist",
							results: [
								{
									id: "message:message-1",
									kind: "message",
									title: "Ralph",
									detail: "The deployment plan is in the launch checklist.",
									receipt: "#general · Ralph · 2026-08-26T00:00:00.000Z",
									highlights: [
										{ field: "detail", start: 30, end: 36 },
										{ field: "detail", start: 37, end: 46 },
									],
									target: {
										kind: "conversation",
										conversation: { kind: "channel", id: "general" },
										threadId: "thread-1",
										messageId: "message-1",
									},
								},
							],
							appliedFilters: { kinds: [], projectId: null },
							truncated: false,
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
			),
		);
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		expect(
			screen.getByRole("button", { name: "Search Commonspace" }),
		).toBeTruthy();
		fireEvent.keyDown(window, { key: "k", metaKey: true });
		expect(
			screen.getByRole("dialog", { name: "Search Commonspace" }),
		).toBeTruthy();

		const search = screen.getByRole("searchbox", {
			name: "Search Commonspace",
		});
		expect(document.activeElement).toBe(search);
		fireEvent.change(search, { target: { value: "launch checklist" } });
		const result = await screen.findByRole("option", {
			name: "Open Message: Ralph",
		});
		expect(
			within(result).getAllByText(/launch|checklist/u, { selector: "mark" }),
		).toHaveLength(2);
		expect(within(result).getByText(/#general · Ralph/u)).toBeTruthy();
		fireEvent.click(result);

		expect(store.selectConversation).toHaveBeenCalledWith({
			kind: "channel",
			id: "general",
		});
		expect(store.selectThread).toHaveBeenCalledWith("thread-1");
		expect(
			screen.queryByRole("dialog", { name: "Search everything" }),
		).toBeNull();
	});

	it("keeps the command palette result set bounded", async () => {
		const channels = Array.from({ length: 30 }, (_, index) => ({
			id: `channel-${String(index)}`,
			name: `channel-${String(index)}`,
			projectId: null,
			agentIds: [],
			instructions: "",
			memory: {
				summary: "",
				decisions: [],
				openQuestions: [],
				threadIds: [],
				updatedAt: null,
			},
			settings: { model: null, reasoning: null },
			createdAt: "",
		}));
		const { store } = sidebarStore({ state: state({ channels }) });
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							query: "",
							results: channels.slice(0, 24).map((channel) => ({
								id: `channel:${channel.id}`,
								kind: "channel",
								title: `#${channel.name}`,
								detail: "Channel",
								receipt: `Channel · #${channel.name}`,
								highlights: [],
								target: {
									kind: "conversation",
									conversation: { kind: "channel", id: channel.id },
								},
							})),
							appliedFilters: { kinds: [], projectId: null },
							truncated: true,
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
			),
		);
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.keyDown(window, { key: "k", metaKey: true });

		expect(
			await within(
				await screen.findByRole("listbox", {
					name: "Commonspace search results",
				}),
			).findAllByRole("option"),
		).toHaveLength(24);
	});

	it("contains modal focus and restores it to the control that opened the dialog", async () => {
		const { store } = sidebarStore();
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);
		const trigger = screen.getByRole("button", { name: "Add project" });
		trigger.focus();

		fireEvent.click(trigger);

		const dialog = screen.getByRole("dialog", { name: "Add a project" });
		const close = within(dialog).getByRole("button", {
			name: "Close Add a project",
		});
		const cancel = within(dialog).getByRole("button", { name: "Cancel" });
		expect(trigger.closest('[inert], [aria-hidden="true"]')).not.toBeNull();

		const user = userEvent.setup();
		cancel.focus();
		await user.tab();
		expect(dialog.contains(document.activeElement)).toBe(true);
		expect(close).toBeTruthy();

		fireEvent.keyDown(dialog, { key: "Escape" });
		expect(screen.queryByRole("dialog", { name: "Add a project" })).toBeNull();
		expect(trigger.closest('[inert], [aria-hidden="true"]')).toBeNull();
		expect(document.activeElement).toBe(trigger);
	});

	it("creates a project from the local folder picker", async () => {
		const selectDirectory = vi.fn(
			async () => "/Users/example/Developer/storefront",
		);
		const { store, mutate } = sidebarStore({}, { selectDirectory });
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Add project" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Choose project folder" }),
		);
		await waitFor(() => {
			expect(
				screen.getByLabelText<HTMLInputElement>("Project path").value,
			).toBe("/Users/example/Developer/storefront");
		});
		expect(screen.getByLabelText<HTMLInputElement>("Project name").value).toBe(
			"storefront",
		);
		fireEvent.click(screen.getByRole("button", { name: "Create project" }));

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith({
				action: "create-project",
				name: "storefront",
				paths: ["/Users/example/Developer/storefront"],
			});
		});
	});

	it("keeps a failed project form open without duplicating the application toast", async () => {
		const mutate = vi.fn(async () => {
			throw new Error("project name is required");
		});
		const { store } = sidebarStore({}, { mutate });
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Add project" }));
		const dialog = screen.getByRole("dialog", { name: "Add a project" });
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Create project" }),
		);

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledOnce();
		});
		expect(screen.getByRole("dialog", { name: "Add a project" })).toBe(dialog);
		expect(within(dialog).queryByRole("alert")).toBeNull();
	});

	it("creates an unbound channel", async () => {
		const { store, mutate } = sidebarStore();
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Add channel" }));
		expect(screen.queryByLabelText("Channel project")).toBeNull();
		fireEvent.change(screen.getByLabelText("Channel name"), {
			target: { value: "engineering" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create channel" }));

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith({
				action: "create-channel",
				name: "engineering",
				agentIds: [],
			});
		});
	});

	it("adds explicitly selected known harnesses", async () => {
		const discoveredAgents = [
			{
				id: "codex",
				displayName: "Codex",
				adapter: "codex" as const,
				model: null,
				status: "stopped" as const,
			},
			{
				id: "hermes",
				displayName: "Hermes",
				adapter: "hermes" as const,
				model: null,
				status: "stopped" as const,
			},
		];
		const { store, mutate } = sidebarStore({
			agents: [],
			discoveredAgents,
			state: state({ agents: [] }),
		});
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Add agent" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Choose Codex harness" }),
		);
		await waitFor(() => {
			expect(store.discoverAgents).toHaveBeenCalledWith("codex");
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Add discovered agent Codex" }),
		);

		fireEvent.click(screen.getByRole("button", { name: "Add agent" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Choose Hermes harness" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Add discovered agent Hermes" }),
		);
		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith({
				action: "add-discovered-agent",
				agentId: "codex",
			});
			expect(mutate).toHaveBeenCalledWith({
				action: "add-discovered-agent",
				agentId: "hermes",
			});
		});
	});

	it("limits agent customization to workspace appearance", async () => {
		const agent = {
			id: "frontend",
			displayName: "Frontend",
			adapter: "hermes" as const,
			model: "gpt-test",
			status: "running" as const,
		};
		const { store, mutate } = sidebarStore({
			agents: [agent],
			state: state({
				agents: [{ ...agent, createdAt: "2026-08-25T00:00:00.000Z" }],
			}),
		});
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "Customize agent Frontend" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Customize Frontend" });
		expect(within(dialog).queryByLabelText(/native profile/i)).toBeNull();
		expect(
			within(dialog).queryByText(/native hermes configuration/i),
		).toBeNull();
		expect(
			within(dialog).queryByRole("button", {
				name: "Save native configuration",
			}),
		).toBeNull();
		fireEvent.change(within(dialog).getByLabelText("Workspace name"), {
			target: { value: "Atlas" },
		});
		fireEvent.change(within(dialog).getByLabelText("Avatar emoji"), {
			target: { value: "🧭" },
		});
		fireEvent.change(within(dialog).getByLabelText("Accent color"), {
			target: { value: "#7c3aed" },
		});
		fireEvent.click(
			within(dialog).getByRole("button", { name: "Save appearance" }),
		);

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith({
				action: "update-agent-profile",
				agentId: "frontend",
				displayName: "Atlas",
				avatarEmoji: "🧭",
				accentColor: "#7c3aed",
			});
		});
	});

	it("starts Hermes discovery only after selecting Hermes in the agent form", async () => {
		const discoverAgents = vi.fn(async () => undefined);
		const { store } = sidebarStore({}, { discoverAgents });
		render(
			<CommonspaceSidebar wide expandSidebar={() => undefined} store={store} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Add agent" }));
		expect(discoverAgents).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole("button", { name: "Choose Hermes harness" }),
		);

		await waitFor(() => {
			expect(discoverAgents).toHaveBeenCalledWith("hermes");
		});
		expect(screen.queryByRole("button", { name: "Create agent" })).toBeNull();
	});
});
