import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CommonspaceHostService } from "../server/src/service.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

async function createService(): Promise<{
	root: string;
	service: CommonspaceHostService;
}> {
	const root = await mkdtemp(join(tmpdir(), "commonspace-workspace-settings-"));
	roots.push(root);
	const service = new CommonspaceHostService(
		{},
		{ root },
		{ discoverAgents: async () => [] },
	);
	await service.initialize();
	return { root, service };
}

describe("workspace settings", () => {
	it("validates an unsaved routing candidate without changing durable settings", async () => {
		const { root, service } = await createService();
		const before = service.routing();

		const inference = service.validateRoutingConfiguration({
			provider: "openai-compatible",
			model: "candidate-model",
			baseUrl: "https://example.test/v1/",
			apiKey: "candidate-secret",
		});

		expect(inference).toMatchObject({
			provider: "openai-compatible",
			location: "remote",
			configured: true,
		});
		expect(service.routing()).toEqual(before);
		await expect(readFile(join(root, "routing.json"), "utf8")).rejects.toMatchObject(
			{ code: "ENOENT" },
		);
	});

	it("persists routing and agent defaults as one workspace operation", async () => {
		const { root, service } = await createService();

		const bootstrap = await service.updateWorkspaceSettings({
			routing: {
				provider: "openai-compatible",
				model: "workspace-router",
				baseUrl: "https://example.test/v1/",
				apiKey: "workspace-secret",
			},
			defaults: {
				model: "agent-default",
				reasoning: "high",
				maxAgentsPerTurn: 3,
				memoryThreads: 8,
			},
		});

		expect(bootstrap.routing).toEqual({
			provider: "openai-compatible",
			model: "workspace-router",
			harnessAgentId: null,
			baseUrl: "https://example.test/v1",
			apiKeyConfigured: true,
		});
		expect(bootstrap.state.defaults).toEqual({
			model: "agent-default",
			reasoning: "high",
			maxAgentsPerTurn: 3,
			memoryThreads: 8,
		});
		expect(JSON.parse(await readFile(join(root, "routing.json"), "utf8"))).toEqual(
			{
				provider: "openai-compatible",
				model: "workspace-router",
				harnessAgentId: null,
				baseUrl: "https://example.test/v1",
				apiKey: "workspace-secret",
			},
		);
		expect(
			JSON.parse(await readFile(join(root, "state.json"), "utf8")).defaults,
		).toEqual({
			model: "agent-default",
			reasoning: "high",
			maxAgentsPerTurn: 3,
			memoryThreads: 8,
		});
	});

	it("rolls routing and in-memory defaults back when state persistence fails", async () => {
		const { root, service } = await createService();
		const beforeState = service.snapshot();
		const beforeRouting = service.routing();
		const statePath = join(root, "state.json");
		await rm(statePath);
		await mkdir(statePath);

		await expect(
			service.updateWorkspaceSettings({
				routing: {
					provider: "openai-compatible",
					model: "should-not-commit",
					baseUrl: "https://rollback.example/v1",
					apiKey: "should-not-commit",
				},
				defaults: {
					model: "should-not-commit",
					reasoning: "low",
					maxAgentsPerTurn: 1,
					memoryThreads: 1,
				},
			}),
		).rejects.toThrow();

		expect(service.snapshot()).toEqual(beforeState);
		expect(service.routing()).toEqual(beforeRouting);
		expect(JSON.parse(await readFile(join(root, "routing.json"), "utf8"))).toEqual(
			{
				provider: beforeRouting.provider,
				model: beforeRouting.model,
				harnessAgentId: beforeRouting.harnessAgentId,
				baseUrl: beforeRouting.baseUrl,
			},
		);
	});
});
