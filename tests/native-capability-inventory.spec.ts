import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	parseNamedJsonInventory,
	parseTerminalInventory,
} from "../server/src/adapters/capability-inventory.ts";
import { createCodexAdapter } from "../server/src/adapters/codex.ts";
import { createHermesAdapter } from "../server/src/adapters/hermes.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("native capability inventory", () => {
	it("keeps only browser-safe names and native state from JSON", () => {
		const output = JSON.stringify({
			installed: [
				{
					name: "browser",
					enabled: true,
					source: { path: "/private/alice" },
					token: "secret",
				},
				{ name: "/private/alice", enabled: true },
				{ id: "disabled@example", enabled: false, installPath: "/secret" },
			],
		});
		expect(parseNamedJsonInventory(output)).toEqual([
			{ name: "browser", status: "enabled" },
			{ name: "disabled@example", status: "disabled" },
		]);
	});

	it("normalizes native terminal formats without retaining descriptions", () => {
		expect(
			parseTerminalInventory(
				"●  ✓ context7 connected\nExplore · haiku\n✓ enabled  web  private detail",
			),
		).toEqual([
			{ name: "context7", status: "enabled" },
			{ name: "Explore", status: "configured" },
			{ name: "web", status: "enabled" },
		]);
	});

	it("does not execute Hermes inventory commands during read-only browsing", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-capabilities-"));
		roots.push(root);
		const executable = join(root, "hermes");
		const log = join(root, "args.log");
		await writeFile(
			executable,
			`#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\nprintf '✓ enabled  fixture\\n'\n`,
		);
		await chmod(executable, 0o755);
		const groups = await createHermesAdapter({
			hermesPath: executable,
		}).inspectCapabilities({
			id: "reviewer",
			displayName: "Reviewer",
			adapter: "hermes",
			model: null,
			createdAt: "2026-01-01T00:00:00.000Z",
		});
		expect(groups).toHaveLength(6);
		expect(groups.filter((group) => group.status === "available")).toHaveLength(
			0,
		);
		await expect(readFile(log, "utf8")).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it("isolates failed categories and never exposes raw Codex configuration", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-capabilities-"));
		roots.push(root);
		const executable = join(root, "codex");
		await writeFile(
			executable,
			`#!/bin/sh\nif [ "$1" = "mcp" ]; then printf '%s' '[{"name":"catalog","enabled":true,"transport":{"command":"/private/secret","args":["TOKEN=secret"]}}]'; exit 0; fi\nprintf '%s' 'credential failure at /private/secret' >&2\nexit 1\n`,
		);
		await chmod(executable, 0o755);
		const groups = await createCodexAdapter({
			codexPath: executable,
		}).inspectCapabilities({
			id: "codex",
			displayName: "Codex",
			adapter: "codex",
			model: null,
			createdAt: "2026-01-01T00:00:00.000Z",
		});
		expect(groups.find((group) => group.id === "mcp")).toMatchObject({
			status: "available",
			items: [{ name: "catalog", status: "enabled" }],
		});
		expect(groups.find((group) => group.id === "plugins")).toMatchObject({
			status: "error",
			items: [],
		});
		expect(JSON.stringify(groups)).not.toMatch(
			/private\/secret|TOKEN=|credential failure/u,
		);
	});
});
