import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type RunningCommonspaceServer,
	startCommonspaceServer,
} from "../server/src/index.ts";
import { addTestHarness } from "./test-harnesses.ts";
import { mustExist } from "./test-helpers.ts";

const live = process.env.COMMONSPACE_LIVE_ACP_MCP === "1";
const roots: string[] = [];
const servers: RunningCommonspaceServer[] = [];

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all(servers.splice(0).map((server) => server.close()));
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe
	.skipIf(!live)
	.sequential("installed ACP bridge with Commonspace MCP", () => {
		it("lets real Codex read scoped Channel context and post visible progress", async () => {
			const root = await mkdtemp(join(tmpdir(), "commonspace-live-acp-mcp-"));
			roots.push(root);
			const workspace = join(root, "workspace");
			await mkdir(workspace);
			const running = await startCommonspaceServer({
				root,
				codexPath: process.env.COMMONSPACE_CODEX_PATH ?? "codex",
				port: 0,
				runBudgetSeconds: 120,
				logger: { info: () => undefined, warn: () => undefined },
			});
			servers.push(running);
			const codex = await addTestHarness(running.service, "codex");
			const project = mustExist(
				(
					await running.service.mutate({
						action: "create-project",
						name: "Live MCP Workspace",
						paths: [workspace],
					})
				).projects[0],
			);
			const channel = mustExist(
				(
					await running.service.mutate({
						action: "create-channel",
						name: "live-mcp",
						agentIds: [codex.id],
					})
				).channels[0],
			);
			await running.service.mutate({
				action: "set-channel-context",
				channelId: channel.id,
				instructions: "The verification token is CODEX_MCP_CONTEXT_OK.",
			});

			await running.service.send({
				conversation: { kind: "channel", id: channel.id },
				projectIds: [project.id],
				text: [
					"@Codex",
					"Use commonspace_get_context before answering and read the Channel instructions.",
					"Then call commonspace_post_progress with exactly CODEX_MCP_PROGRESS_OK.",
					"Finally reply with exactly the verification token from the Channel instructions and nothing else.",
				].join(" "),
			});
			await running.service.whenIdle();
			const state = running.service.snapshot();
			const messages = state.messages[`channel:${channel.id}`] ?? [];
			expect(
				messages.find((message) => message.authorType === "system"),
			).toBeUndefined();
			const replies = messages
				.filter((message) => message.authorType === "agent")
				.map((message) => message.text);
			expect(replies, JSON.stringify(replies)).toContain(
				"CODEX_MCP_PROGRESS_OK",
			);
			expect(
				messages.some(
					(message) =>
						message.authorType === "agent" &&
						message.text.includes("CODEX_MCP_CONTEXT_OK"),
				),
			).toBe(true);
		}, 210_000);

		it("lets real Hermes read scoped Channel context and post visible progress", async () => {
			const root = await mkdtemp(
				join(tmpdir(), "commonspace-live-hermes-mcp-"),
			);
			roots.push(root);
			const workspace = join(root, "workspace");
			await mkdir(workspace);
			const running = await startCommonspaceServer({
				root,
				port: 0,
				runBudgetSeconds: 120,
				logger: { info: () => undefined, warn: () => undefined },
			});
			servers.push(running);
			const discovered = await addTestHarness(
				running.service,
				"hermes",
				"Hermes",
			);
			const project = mustExist(
				(
					await running.service.mutate({
						action: "create-project",
						name: "Live Hermes MCP Workspace",
						paths: [workspace],
					})
				).projects[0],
			);
			const channel = mustExist(
				(
					await running.service.mutate({
						action: "create-channel",
						name: "live-hermes-mcp",
						agentIds: [discovered.id],
					})
				).channels[0],
			);
			await running.service.mutate({
				action: "set-channel-context",
				channelId: channel.id,
				instructions: "The verification token is HERMES_MCP_CONTEXT_OK.",
			});

			await running.service.send({
				conversation: { kind: "channel", id: channel.id },
				projectIds: [project.id],
				text: [
					"@Hermes",
					"Use commonspace_get_context before answering and read the Channel instructions.",
					"Then call commonspace_post_progress with exactly HERMES_MCP_PROGRESS_OK.",
					"Finally reply with exactly the verification token from the Channel instructions and nothing else.",
				].join(" "),
			});
			await running.service.whenIdle();
			const state = running.service.snapshot();
			const messages = state.messages[`channel:${channel.id}`] ?? [];
			expect(
				messages.find((message) => message.authorType === "system"),
			).toBeUndefined();
			expect(
				messages.some(
					(message) =>
						message.authorType === "agent" &&
						message.text === "HERMES_MCP_PROGRESS_OK",
				),
			).toBe(true);
			expect(
				messages.some(
					(message) =>
						message.authorType === "agent" &&
						message.text.includes("HERMES_MCP_CONTEXT_OK"),
				),
			).toBe(true);
		}, 210_000);
	});
