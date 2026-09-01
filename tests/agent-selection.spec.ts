import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommonspaceMutation } from "@commonspace/shared";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { CommonspaceHostService } from "../server/src/service.ts";
import { discoverTestHarnesses } from "./test-harnesses.ts";
import { mustExist } from "./test-helpers.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("Commonspace agent selection", () => {
	it("adds the explicitly selected Hermes harness and persists that choice", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-agent-selection-"));
		roots.push(root);
		const discoverAgents = vi.fn(discoverTestHarnesses);
		const dependencies = { discoverAgents };
		const service = new CommonspaceHostService({}, { root }, dependencies);
		await service.initialize();

		expect((await service.bootstrap()).agents).toEqual([]);
		expect((await service.bootstrap()).discoveredAgents).toEqual([]);
		expect(discoverAgents).not.toHaveBeenCalled();
		const discoveredAgent = mustExist(
			(await service.discoverAgents("hermes")).discoveredAgents[0],
		);
		expect(discoveredAgent).toMatchObject({ id: "hermes", adapter: "hermes" });
		expect(discoverAgents).toHaveBeenCalledOnce();
		await service.mutate({ action: "add-discovered-agent", agentId: "hermes" });
		expect((await service.bootstrap()).agents).toEqual([discoveredAgent]);
		await service.close();

		const restarted = new CommonspaceHostService({}, { root }, dependencies);
		await restarted.initialize();
		expect((await restarted.bootstrap()).agents).toEqual([
			{
				id: "hermes",
				displayName: "Hermes",
				adapter: "hermes",
				model: null,
				status: "unknown",
			},
		]);
		expect((await restarted.discoverAgents("hermes")).agents).toEqual([
			discoveredAgent,
		]);
		await restarted.close();
	});

	it("persists Commonspace-local appearance without changing the harness identity", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-agent-identity-"));
		roots.push(root);
		const dependencies = { discoverAgents: vi.fn(discoverTestHarnesses) };
		const service = new CommonspaceHostService({}, { root }, dependencies);
		await service.initialize();
		await service.discoverAgents("hermes");
		await service.mutate({ action: "add-discovered-agent", agentId: "hermes" });

		await service.mutate({
			action: "update-agent-profile",
			agentId: "hermes",
			displayName: "Atlas",
			avatarEmoji: "🧭",
			accentColor: "#7c3aed",
		});

		expect((await service.bootstrap()).agents).toEqual([
			expect.objectContaining({
				id: "hermes",
				displayName: "Atlas",
				avatarEmoji: "🧭",
				accentColor: "#7c3aed",
				adapter: "hermes",
				status: "stopped",
			}),
		]);
		await service.close();

		const statePath = join(root, "state.json");
		const persisted = z
			.record(z.string(), z.json())
			.parse(JSON.parse(await readFile(statePath, "utf8")));
		await writeFile(statePath, JSON.stringify({ ...persisted, version: 11 }));

		const restarted = new CommonspaceHostService({}, { root }, dependencies);
		await restarted.initialize();
		expect((await restarted.bootstrap()).agents).toEqual([
			expect.objectContaining({
				id: "hermes",
				displayName: "Atlas",
				avatarEmoji: "🧭",
				accentColor: "#7c3aed",
				adapter: "hermes",
				status: "unknown",
			}),
		]);
		await restarted.close();
	});

	it("excludes managed Codex Agent creation from mutation contracts", () => {
		expectTypeOf<{
			action: "add-agent";
			displayName: string;
			adapter: "codex";
		}>().not.toMatchTypeOf<CommonspaceMutation>();
	});

	it("discovers and persists the selected Codex harness", async () => {
		const root = await mkdtemp(
			join(tmpdir(), "commonspace-codex-harness-selection-"),
		);
		roots.push(root);
		const service = new CommonspaceHostService(
			{},
			{ root },
			{ discoverAgents: discoverTestHarnesses },
		);
		await service.initialize();

		const discovery = await service.discoverAgents("codex");
		expect(discovery.discoveredAgents).toEqual([
			expect.objectContaining({ id: "codex", adapter: "codex" }),
		]);
		await service.mutate({ action: "add-discovered-agent", agentId: "codex" });

		expect(service.snapshot().agents).toEqual([
			expect.objectContaining({ id: "codex", adapter: "codex" }),
		]);
		await service.close();
	});
});
