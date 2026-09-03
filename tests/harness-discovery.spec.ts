// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
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

describe("known harness discovery", () => {
	it("adds the installed Codex harness and distinct Hermes profiles", async () => {
		const root = await mkdtemp(
			join(tmpdir(), "commonspace-harness-discovery-"),
		);
		roots.push(root);
		const service = new CommonspaceHostService(
			{},
			{ root },
			{
				discoverAgents: async (adapter) =>
					adapter === "codex"
						? [
								{
									id: "codex",
									displayName: "Codex",
									adapter: "codex",
									model: null,
									status: "stopped",
									description: "Installed Codex harness.",
								},
							]
						: [
								{
									id: "default",
									displayName: "AgentOps",
									adapter: "hermes",
									model: "gpt-test",
									status: "running",
								},
								{
									id: "frontend",
									displayName: "Frontend",
									adapter: "hermes",
									model: "gpt-test",
									status: "stopped",
								},
							],
			},
		);
		await service.initialize();

		const codex = await service.discoverAgents("codex");
		expect(codex.discoveredAgents).toEqual([
			{
				id: "codex",
				displayName: "Codex",
				adapter: "codex",
				model: null,
				status: "stopped",
				description: "Installed Codex harness.",
			},
		]);
		await service.mutate({ action: "add-discovered-agent", agentId: "codex" });

		const hermes = await service.discoverAgents("hermes");
		expect(
			hermes.discoveredAgents.filter((agent) => agent.adapter === "hermes"),
		).toEqual([
			{
				id: "default",
				displayName: "AgentOps",
				adapter: "hermes",
				model: "gpt-test",
				status: "running",
			},
			{
				id: "frontend",
				displayName: "Frontend",
				adapter: "hermes",
				model: "gpt-test",
				status: "stopped",
			},
		]);
		await service.mutate({
			action: "add-discovered-agent",
			agentId: "default",
		});
		await service.mutate({
			action: "add-discovered-agent",
			agentId: "frontend",
		});

		expect(
			service.snapshot().agents.map((agent) => ({
				id: agent.id,
				adapter: agent.adapter,
				nativeProfile: agent.nativeProfile,
			})),
		).toEqual([
			{ id: "codex", adapter: "codex", nativeProfile: undefined },
			{ id: "default", adapter: "hermes", nativeProfile: undefined },
			{ id: "frontend", adapter: "hermes", nativeProfile: undefined },
		]);
		await service.close();
	});
});
