import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CommonspaceHostService } from "../server/src/service.ts";
import { addTestHarness, discoverTestHarnesses } from "./test-harnesses.ts";
import { mustExist } from "./test-helpers.ts";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

const archiveShapes = ["current", "legacy defaults", "legacy overrides"];

describe.each(archiveShapes)("workspace portability (%s)", (shape) => {
	it("exports sanitized metadata and imports into a clean workspace with explicit Project remapping", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-export-source-"));
		roots.push(root);
		const projectRoot = join(root, "private-source-project");
		await mkdir(projectRoot);
		const sharedRoot = await realpath("/tmp");
		const source = new CommonspaceHostService(
			{},
			{ root: join(root, "state") },
			{
				discoverAgents: discoverTestHarnesses,
				runAgent: async () => ({
					text: "Portable reply.",
					sessionId: "123e4567-e89b-42d3-a456-426614174777",
				}),
			},
		);
		await source.initialize();
		await addTestHarness(source, "codex", "Review Bot");
		await source.mutate({
			action: "set-defaults",
			model: "workspace-model",
			reasoning: "high",
		});
		await source.mutate({
			action: "create-channel",
			name: "portable-room",
			agentIds: ["codex"],
		});
		await source.mutate({
			action: "set-notifications",
			notifications: {
				enabled: true,
				replies: true,
				mentions: true,
				permissions: true,
				failures: true,
				sound: false,
			},
		});
		const project = mustExist(
			(
				await source.mutate({
					action: "create-project",
					name: "Portable App",
					paths: [projectRoot, sharedRoot],
				})
			).projects[0],
		);
		await source.send({
			conversation: { kind: "dm", id: "codex" },
			projectIds: [project.id],
			text: "Keep portable history.",
			files: [
				{
					name: "opaque.bin",
					mimeType: "application/octet-stream",
					data: sharedRoot,
				},
			],
		});
		await source.whenIdle();
		const exportWorkspace = source.exportWorkspace;

		const archive = await exportWorkspace.call(source);
		if (shape !== "current") {
			archive.workspace.channels = archive.workspace.channels.map(
				(channel) => ({
					...channel,
					settings:
						shape === "legacy defaults"
							? { model: null, reasoning: null }
							: { model: "legacy-channel-model", reasoning: "low" },
				}),
			);
		}
		const serialized = JSON.stringify(archive);
		expect(archive).toMatchObject({
			format: "commonspace-workspace",
			version: 1,
			workspace: {
				projects: [{ id: project.id, name: "Portable App", rootCount: 2 }],
			},
			attachments: [
				expect.objectContaining({ name: "opaque.bin", data: sharedRoot }),
			],
		});
		expect(serialized).not.toContain(await realpath(projectRoot));
		expect(serialized).not.toContain("123e4567-e89b-42d3-a456-426614174777");
		expect(serialized).not.toContain("agentSessions");
		expect(serialized).not.toContain("dmSessions");
		await source.close();

		const targetRoot = await mkdtemp(
			join(tmpdir(), "commonspace-export-target-"),
		);
		roots.push(targetRoot);
		const mappedProject = join(targetRoot, "mapped-project");
		await mkdir(mappedProject);
		let importedNotificationCount = 0;
		const target = new CommonspaceHostService(
			{},
			{ root: join(targetRoot, "state") },
			{
				discoverAgents: discoverTestHarnesses,
				runAgent: async () => ({ text: "No run expected." }),
				notify: async () => {
					importedNotificationCount += 1;
				},
			},
		);
		await target.initialize();
		target.attachClientUrl("http://127.0.0.1:3100");
		const importWorkspace = target.importWorkspace;
		const mappings = { [project.id]: [mappedProject, targetRoot] };
		const malformed = structuredClone(archive);
		malformed.workspace.channels.push({});
		await expect(
			importWorkspace.call(target, malformed, mappings),
		).rejects.toThrow("workspace archive failed structural validation");
		for (const settings of [
			{ model: 42, reasoning: "low" },
			{ model: null, reasoning: "invalid" },
			{ model: null, reasoning: null, extra: "unexpected" },
		]) {
			const invalidSettings = structuredClone(archive);
			invalidSettings.workspace.channels =
				invalidSettings.workspace.channels.map((channel) => ({
					...channel,
					settings,
				}));
			await expect(
				importWorkspace.call(target, invalidSettings, mappings),
			).rejects.toThrow("workspace archive failed structural validation");
		}

		await importWorkspace.call(target, archive, mappings);

		expect(importedNotificationCount).toBe(0);
		expect(target.snapshot().defaults).toMatchObject({
			model: "workspace-model",
			reasoning: "high",
		});
		expect(target.snapshot().channels[0]).toMatchObject({
			name: "portable-room",
			agentIds: ["codex"],
		});
		expect(target.snapshot().channels[0]).not.toHaveProperty("settings");
		expect(target.snapshot().projects[0]).toMatchObject({
			id: project.id,
			paths: [await realpath(mappedProject), await realpath(targetRoot)],
		});
		expect(
			target.snapshot().messages["dm:codex"]?.map((message) => message.text),
		).toEqual(["Keep portable history.", "Portable reply."]);
		expect(target.snapshot().agentSessions).toEqual({});
		expect(target.snapshot().dmSessions).toEqual({});
		const fileId = target.snapshot().messages["dm:codex"]?.[0]?.files?.[0]?.id;
		await expect(
			target.readFileAttachment(mustExist(fileId)),
		).resolves.toMatchObject({
			data: Buffer.from(sharedRoot, "base64"),
		});
		await expect(
			importWorkspace.call(target, archive, mappings),
		).rejects.toThrow("workspace import requires an empty workspace");
		await target.close();
	});
});
