import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConversationRef } from "@commonspace/shared";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { CommonspaceHostService } from "../server/src/service.ts";
import { addTestHarness, discoverTestHarnesses } from "./test-harnesses.ts";
import { mustExist } from "./test-helpers.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("explicit retention", () => {
	it("previews and revision-guards a scoped conversation purge", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-retention-"));
		roots.push(root);
		let holdRun = false;
		let signalRunStarted = (): void => {};
		let releaseRun = (): void => {};
		const runStarted = new Promise<void>((resolve) => {
			signalRunStarted = resolve;
		});
		const heldRun = new Promise<{ text: string }>((resolve) => {
			releaseRun = () => resolve({ text: "Held reply." });
		});
		const service = new CommonspaceHostService(
			{},
			{ root },
			{
				discoverAgents: discoverTestHarnesses,
				runAgent: async () => {
					if (!holdRun) return { text: "Retained reply." };
					signalRunStarted();
					return heldRun;
				},
			},
		);
		await service.initialize();
		await addTestHarness(service, "codex", "Review Bot");
		const channel = mustExist(
			(
				await service.mutate({
					action: "create-channel",
					name: "retention",
					agentIds: ["codex"],
				})
			).channels[0],
		);
		const sent = await service.send({
			conversation: { kind: "channel", id: channel.id },
			text: "@review-bot retain until explicit purge.",
			files: [
				{
					name: "retention.txt",
					mimeType: "text/plain",
					data: Buffer.from("retention").toString("base64"),
				},
			],
		});
		await service.whenIdle();
		await service.addPin({
			scope: { kind: "thread", id: mustExist(sent.thread).id },
			kind: "message",
			messageId: sent.accepted.id,
		});
		await service.send({
			conversation: { kind: "dm", id: "codex" },
			text: "Unrelated DM history.",
		});
		await service.whenIdle();
		const fileId = mustExist(sent.accepted.files?.[0]).id;
		expectTypeOf<{
			kind: "bogus";
			id: "codex";
		}>().not.toMatchTypeOf<ConversationRef>();

		const preview = service.previewRetention({
			kind: "channel",
			id: channel.id,
		});
		expect(preview).toMatchObject({
			messages: 2,
			threads: 1,
			attachments: 1,
			pins: 1,
		});
		expect(service.snapshot().messages[`channel:${channel.id}`]).toHaveLength(
			2,
		);
		await service.mutate({
			action: "set-channel-context",
			channelId: channel.id,
			instructions: "Changed after preview.",
		});
		await expect(
			service.applyRetention({
				conversation: { kind: "channel", id: channel.id },
				expectedRevision: preview.revision,
			}),
		).rejects.toThrow("retention preview is stale");

		holdRun = true;
		await service.send({
			conversation: { kind: "channel", id: channel.id },
			text: "@review-bot keep this run active.",
		});
		await runStarted;
		const activePreview = service.previewRetention({
			kind: "channel",
			id: channel.id,
		});
		await expect(
			service.applyRetention({
				conversation: { kind: "channel", id: channel.id },
				expectedRevision: activePreview.revision,
			}),
		).rejects.toThrow("conversation has active work");
		releaseRun();
		await service.whenIdle();
		const current = service.previewRetention({
			kind: "channel",
			id: channel.id,
		});
		await service.applyRetention({
			conversation: { kind: "channel", id: channel.id },
			expectedRevision: current.revision,
		});

		expect(
			service
				.snapshot()
				.channels.some((candidate) => candidate.id === channel.id),
		).toBe(true);
		expect(
			service.snapshot().messages[`channel:${channel.id}`],
		).toBeUndefined();
		expect(
			service
				.snapshot()
				.threads.some((thread) => thread.channelId === channel.id),
		).toBe(false);
		expect(service.snapshot().pins).toHaveLength(0);
		expect(
			service.snapshot().messages["dm:codex"]?.map((message) => message.text),
		).toEqual(["Unrelated DM history.", "Retained reply."]);
		await expect(service.readFileAttachment(fileId)).rejects.toThrow(
			"unknown file attachment",
		);
		await service.close();
	});
});
