import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommonspaceHostService } from "../server/src/service.ts";
import { addTestHarness, discoverTestHarnesses } from "./test-harnesses.ts";
import { mustExist } from "./test-helpers.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("general file attachments", () => {
	it("persists and delivers a safe file without exposing its host URI to the browser", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-file-attachment-"));
		roots.push(root);
		const runAgent = vi.fn(async () => ({ text: "File received." }));
		const service = new CommonspaceHostService(
			{},
			{ root },
			{
				discoverAgents: discoverTestHarnesses,
				runAgent,
			},
		);
		await service.initialize();
		await addTestHarness(service, "codex", "Review Bot");
		const channel = mustExist(
			(
				await service.mutate({
					action: "create-channel",
					name: "files",
					agentIds: ["codex"],
				})
			).channels[0],
		);

		const sent = await service.send({
			conversation: { kind: "channel", id: channel.id },
			text: "@review-bot inspect the attached notes.",
			files: [
				{
					name: "notes.txt",
					mimeType: "text/plain",
					data: Buffer.from("verification notes").toString("base64"),
				},
			],
		});
		await service.whenIdle();

		const file = sent.accepted.files?.[0];
		expect(file).toMatchObject({
			id: expect.any(String),
			name: "notes.txt",
			mimeType: "text/plain",
			size: 18,
		});
		expect(runAgent.mock.calls[0]?.[0].files).toEqual([
			{
				name: "notes.txt",
				mimeType: "text/plain",
				size: 18,
				uri: expect.stringMatching(/^file:\/\//u),
			},
		]);
		const deliveredUri = runAgent.mock.calls[0]?.[0].files?.[0]?.uri;
		expect(await readFile(fileURLToPath(mustExist(deliveredUri)), "utf8")).toBe(
			"verification notes",
		);
		expect(JSON.stringify(await service.bootstrap())).not.toContain(
			deliveredUri,
		);
		await expect(
			service.readFileAttachment(mustExist(file).id),
		).resolves.toMatchObject({
			metadata: file,
			data: Buffer.from("verification notes"),
		});
		await service.close();

		const restarted = new CommonspaceHostService(
			{},
			{ root },
			{
				discoverAgents: discoverTestHarnesses,
				runAgent: async () => ({ text: "No run expected." }),
			},
		);
		await restarted.initialize();
		await expect(
			restarted.readFileAttachment(mustExist(file).id),
		).resolves.toMatchObject({
			metadata: file,
			data: Buffer.from("verification notes"),
		});
		await restarted.close();
	});

	it.each([".pypirc", "auth.json", "id_ecdsa"])(
		"refuses credential-bearing file %s before accepting a message",
		async (name) => {
			const root = await mkdtemp(join(tmpdir(), "commonspace-secret-file-"));
			roots.push(root);
			const runAgent = vi.fn(async () => ({ text: "Should not run." }));
			const service = new CommonspaceHostService(
				{},
				{ root },
				{
					discoverAgents: discoverTestHarnesses,
					runAgent,
				},
			);
			await service.initialize();
			await addTestHarness(service, "codex", "Review Bot");

			await expect(
				service.send({
					conversation: { kind: "dm", id: "codex" },
					text: "Inspect this.",
					files: [
						{
							name,
							mimeType: "text/plain",
							data: Buffer.from("synthetic test value").toString("base64"),
						},
					],
				}),
			).rejects.toThrow("credential-bearing files cannot be attached");
			expect(service.snapshot().messages["dm:codex"]).toBeUndefined();
			expect(runAgent).not.toHaveBeenCalled();
			await service.close();
		},
	);
});
