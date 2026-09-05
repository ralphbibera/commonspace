import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcpAgentProcess } from "../server/src/acp-runtime.ts";

const roots: string[] = [];
const fixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures",
	"fake-acp-agent.mjs",
);

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("ACP agent process", () => {
	it("starts a session and sends only the new message as the prompt", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-acp-"));
		roots.push(root);
		const logPath = join(root, "frames.ndjson");
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: { ...process.env, FAKE_ACP_LOG: logPath },
		});

		try {
			const result = await processClient.run({
				cwd: root,
				additionalCwds: [],
				message: "Only this new message.",
			});

			expect(result).toEqual({
				sessionId: "123e4567-e89b-42d3-a456-426614174000",
				text: "Echo: Only this new message.",
			});
			const frames = (await readFile(logPath, "utf8"))
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line));
			const prompt = frames.find((frame) => frame.method === "session/prompt");
			const manifest = JSON.parse(
				await readFile(
					new URL("../server/package.json", import.meta.url),
					"utf8",
				),
			);
			expect(
				frames.find((frame) => frame.method === "initialize")?.params
					.clientInfo,
			).toEqual({ name: "Commonspace", version: manifest.version });
			expect(prompt?.params.prompt).toEqual([
				{ type: "text", text: "Only this new message." },
			]);
		} finally {
			await processClient.close();
		}
	});

	it("sends pasted images as structured ACP prompt blocks", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-acp-image-"));
		roots.push(root);
		const logPath = join(root, "frames.ndjson");
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: { ...process.env, FAKE_ACP_LOG: logPath },
		});

		try {
			await processClient.run({
				cwd: root,
				message: "What is wrong here?",
				images: [
					{ name: "clipboard.png", mimeType: "image/png", data: "iVBORw==" },
				],
			});

			const frames = (await readFile(logPath, "utf8"))
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line));
			const prompt = frames.find((frame) => frame.method === "session/prompt");
			expect(prompt?.params.prompt).toEqual([
				{ type: "text", text: "What is wrong here?" },
				{ type: "image", mimeType: "image/png", data: "iVBORw==" },
			]);
		} finally {
			await processClient.close();
		}
	});

	it("returns a provider-neutral activity trace from ACP session updates", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-acp-trace-"));
		roots.push(root);
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: { ...process.env, FAKE_ACP_TRACE: "1" },
		});

		try {
			const result = await processClient.run({
				cwd: root,
				message: "Trace this turn.",
			});

			expect(result).toMatchObject({
				text: "Echo: Trace this turn.",
				trace: {
					startedAt: expect.any(String),
					completedAt: expect.any(String),
					entries: [
						expect.objectContaining({
							type: "reasoning",
							text: "Inspecting the workspace. Choosing the smallest safe change.",
						}),
						expect.objectContaining({
							type: "plan",
							steps: [
								{
									text: "Inspect the relevant files",
									priority: "high",
									status: "completed",
								},
								{
									text: "Implement and verify the change",
									priority: "high",
									status: "in_progress",
								},
							],
						}),
						expect.objectContaining({
							type: "tool",
							id: "call-1",
							title: "Read package metadata",
							toolName: "read_file",
							toolKind: "read",
							status: "completed",
							input: '{\n  "path": "/private/project/package.json"\n}',
							output: 'Package metadata loaded.\n{\n  "ok": true\n}',
						}),
						expect.objectContaining({
							type: "usage",
							usedTokens: 640,
							contextWindow: 128000,
						}),
					],
				},
			});
		} finally {
			await processClient.close();
		}
	});

	it("loads a persisted native session without leaking replayed history into the next reply", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-acp-resume-"));
		roots.push(root);
		const logPath = join(root, "frames.ndjson");
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: {
				...process.env,
				FAKE_ACP_LOG: logPath,
				FAKE_ACP_REPLAY_ON_LOAD: "1",
			},
		});

		try {
			const result = await processClient.run({
				cwd: root,
				additionalCwds: [],
				message: "Continue from there.",
				sessionId: "123e4567-e89b-42d3-a456-426614174000",
			});

			expect(result.text).toBe("Echo: Continue from there.");
			const frames = (await readFile(logPath, "utf8"))
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line));
			expect(frames.map((frame) => frame.method).filter(Boolean)).toEqual([
				"initialize",
				"session/load",
				"session/prompt",
			]);
		} finally {
			await processClient.close();
		}
	});

	it("terminates an agent that exceeds the ACP protocol frame limit", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-acp-frame-limit-"));
		roots.push(root);
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: { ...process.env, FAKE_ACP_LARGE_CHUNK: "2000" },
			maxProtocolFrameBytes: 512,
		});

		try {
			await expect(
				processClient.run({ cwd: root, message: "Overflow." }),
			).rejects.toThrow("ACP protocol frame exceeded");
		} finally {
			await processClient.close();
		}
	});

	it("cancels and rejects a response that exceeds the published output limit", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-acp-output-limit-"));
		roots.push(root);
		const logPath = join(root, "frames.ndjson");
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: {
				...process.env,
				FAKE_ACP_LOG: logPath,
				FAKE_ACP_LARGE_CHUNK: "2000",
			},
			maxResponseChars: 512,
		});

		try {
			await expect(
				processClient.run({ cwd: root, message: "Overflow." }),
			).rejects.toThrow("response exceeded the Commonspace output limit");
			await vi.waitFor(async () => {
				expect(
					(await readFile(logPath, "utf8")).includes("session/cancel"),
				).toBe(true);
			});
		} finally {
			await processClient.close();
		}
	});

	it("safely rejects an unexpected ACP permission request", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-acp-permission-"));
		roots.push(root);
		const logPath = join(root, "frames.ndjson");
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: {
				...process.env,
				FAKE_ACP_LOG: logPath,
				FAKE_ACP_PERMISSION_REQUEST: "1",
			},
		});

		try {
			await processClient.run({ cwd: root, message: "Request permission." });
			await vi.waitFor(async () => {
				const frames = (await readFile(logPath, "utf8"))
					.trim()
					.split("\n")
					.map((line) => JSON.parse(line));
				expect(
					frames.find(
						(frame) =>
							frame.id === "permission-1" && frame.method === undefined,
					)?.result,
				).toEqual({ outcome: { outcome: "selected", optionId: "reject" } });
			});
		} finally {
			await processClient.close();
		}
	});

	it("closes promptly while ACP initialization is still pending", async () => {
		const root = await mkdtemp(
			join(tmpdir(), "commonspace-acp-close-pending-"),
		);
		roots.push(root);
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: { ...process.env, FAKE_ACP_HANG_INITIALIZE: "1" },
			requestTimeoutMs: 60_000,
		});
		const running = processClient.run({
			cwd: root,
			message: "Never delivered.",
		});
		await delay(25);

		await expect(
			Promise.race([
				processClient.close().then(() => "closed"),
				delay(1_000).then(() => "timed-out"),
			]),
		).resolves.toBe("closed");
		await expect(running).rejects.toThrow();
	});

	it("reloads an active native session when its session-scoped MCP binding changes", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-acp-mcp-rebind-"));
		roots.push(root);
		const logPath = join(root, "frames.ndjson");
		const processClient = new AcpAgentProcess({
			command: process.execPath,
			args: [fixturePath],
			cwd: root,
			env: { ...process.env, FAKE_ACP_LOG: logPath },
		});
		const firstMcp = [
			{
				type: "http" as const,
				name: "commonspace",
				url: "http://127.0.0.1:3100/api/mcp",
				headers: [{ name: "Authorization", value: "Bearer first" }],
			},
		];
		const secondMcp = [
			{
				type: "http" as const,
				name: "commonspace",
				url: "http://127.0.0.1:3100/api/mcp",
				headers: [{ name: "Authorization", value: "Bearer second" }],
			},
		];

		try {
			const first = await processClient.run({
				cwd: root,
				message: "First.",
				mcpServers: firstMcp,
			});
			await processClient.run({
				cwd: root,
				message: "Second.",
				sessionId: first.sessionId,
				mcpServers: secondMcp,
			});
			const frames = (await readFile(logPath, "utf8"))
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line));
			expect(
				frames.filter((frame) => frame.method === "session/load"),
			).toHaveLength(1);
			expect(
				frames.find((frame) => frame.method === "session/load")?.params
					.mcpServers[0].headers[0].value,
			).toBe("Bearer second");
		} finally {
			await processClient.close();
		}
	});
});
