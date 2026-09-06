import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { cpus, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import type {
	CommonspaceAgentProfile,
	CommonspaceState,
} from "@commonspace/shared";
import { searchCommonspace } from "../server/src/search.ts";
import { CommonspaceHostService } from "../server/src/service.ts";
import { createInitialState } from "../server/src/state.ts";

interface Measurement<T> {
	result: T;
	durationMs: number;
	heapDeltaBytes: number;
	rssDeltaBytes: number;
}

const benchmarkAgent: CommonspaceAgentProfile = {
	id: "codex",
	displayName: "Benchmark Agent",
	adapter: "codex",
	model: null,
	status: "stopped",
	description: "Synthetic benchmark runtime.",
};

const dependencies = {
	discoverAgents: async (adapter: CommonspaceAgentProfile["adapter"]) =>
		adapter === "codex" ? [benchmarkAgent] : [],
	runAgent: async () => ({ text: "Synthetic benchmark reply." }),
};

function collectGarbage(): void {
	globalThis.gc?.();
}

async function measure<T>(
	operation: () => Promise<T>,
): Promise<Measurement<T>> {
	collectGarbage();
	const before = process.memoryUsage();
	const startedAt = performance.now();
	const result = await operation();
	const durationMs = performance.now() - startedAt;
	const after = process.memoryUsage();
	return {
		result,
		durationMs,
		heapDeltaBytes: after.heapUsed - before.heapUsed,
		rssDeltaBytes: after.rss - before.rss,
	};
}

function syntheticState(messageCount: number): CommonspaceState {
	const state = createInitialState();
	const createdAt = "2026-01-01T00:00:00.000Z";
	state.revision = messageCount;
	state.agents = [
		{
			id: benchmarkAgent.id,
			displayName: benchmarkAgent.displayName,
			adapter: benchmarkAgent.adapter,
			model: benchmarkAgent.model,
			createdAt,
		},
	];
	state.messages["dm:codex"] = Array.from(
		{ length: messageCount },
		(_, index) => {
			const userTurn = index % 2 === 0;
			const id = `benchmark-message-${String(index)}`;
			const message = {
				id,
				conversation: { kind: "dm" as const, id: "codex" },
				authorType: userTurn ? ("user" as const) : ("agent" as const),
				authorId: userTurn ? "user" : "codex",
				authorName: userTurn ? "You" : benchmarkAgent.displayName,
				text: `Synthetic benchmark needle message ${String(index)} with stable transcript content.`,
				createdAt: new Date(Date.parse(createdAt) + index).toISOString(),
			};
			if (userTurn) return { ...message, replyStatus: "complete" as const };
			return {
				...message,
				sourceMessageId: `benchmark-message-${String(index - 1)}`,
			};
		},
	);
	return state;
}

function configuredSizes(): number[] {
	const raw = process.env.COMMONSPACE_BENCHMARK_SIZES ?? "100,1000,5000";
	const sizes = raw.split(",").map((value) => Number(value.trim()));
	if (
		sizes.length === 0 ||
		sizes.some(
			(value) => !Number.isSafeInteger(value) || value < 2 || value % 2 !== 0,
		)
	)
		throw new Error(
			"COMMONSPACE_BENCHMARK_SIZES must contain positive even integers",
		);
	return sizes;
}

function configuredRepetitions(): number {
	const repetitions = Number(
		process.env.COMMONSPACE_BENCHMARK_REPETITIONS ?? "3",
	);
	if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 20)
		throw new Error(
			"COMMONSPACE_BENCHMARK_REPETITIONS must be an integer from 1 to 20",
		);
	return repetitions;
}

async function runSize(messageCount: number) {
	const root = await mkdtemp(
		join(tmpdir(), "commonspace-workspace-benchmark-"),
	);
	const importRoot = await mkdtemp(
		join(tmpdir(), "commonspace-workspace-import-benchmark-"),
	);
	try {
		await mkdir(root, { recursive: true });
		await writeFile(
			join(root, "state.json"),
			JSON.stringify(syntheticState(messageCount)),
			{ mode: 0o600 },
		);
		const service = new CommonspaceHostService({}, { root }, dependencies);
		const initialization = await measure(() => service.initialize());
		const acceptance = await measure(() =>
			service.send({
				conversation: { kind: "dm", id: "codex" },
				text: "Synthetic benchmark acceptance turn.",
			}),
		);
		await service.whenIdle();
		const bootstrap = await measure(() => service.bootstrap());
		const bootstrapBytes = Buffer.byteLength(
			JSON.stringify(bootstrap.result),
			"utf8",
		);
		const search = await measure(() =>
			searchCommonspace(bootstrap.result, {
				query: "benchmark needle",
				limit: 24,
			}),
		);
		const exported = await measure(() => service.exportWorkspace());
		const archiveBytes = Buffer.byteLength(
			JSON.stringify(exported.result),
			"utf8",
		);
		const imported = new CommonspaceHostService(
			{},
			{ root: importRoot },
			dependencies,
		);
		await imported.initialize();
		const importMeasurement = await measure(() =>
			imported.importWorkspace(exported.result, {}),
		);
		await imported.close();
		await service.close();
		return {
			messageCount,
			initialization,
			acceptance: {
				durationMs: acceptance.durationMs,
				heapDeltaBytes: acceptance.heapDeltaBytes,
				rssDeltaBytes: acceptance.rssDeltaBytes,
			},
			bootstrap: {
				durationMs: bootstrap.durationMs,
				heapDeltaBytes: bootstrap.heapDeltaBytes,
				rssDeltaBytes: bootstrap.rssDeltaBytes,
				payloadBytes: bootstrapBytes,
			},
			search: {
				durationMs: search.durationMs,
				heapDeltaBytes: search.heapDeltaBytes,
				rssDeltaBytes: search.rssDeltaBytes,
				resultCount: search.result.results.length,
			},
			export: {
				durationMs: exported.durationMs,
				heapDeltaBytes: exported.heapDeltaBytes,
				rssDeltaBytes: exported.rssDeltaBytes,
				archiveBytes,
			},
			import: {
				durationMs: importMeasurement.durationMs,
				heapDeltaBytes: importMeasurement.heapDeltaBytes,
				rssDeltaBytes: importMeasurement.rssDeltaBytes,
			},
		};
	} finally {
		await Promise.all([
			rm(root, { recursive: true, force: true }),
			rm(importRoot, { recursive: true, force: true }),
		]);
	}
}

const sizes = configuredSizes();
const repetitions = configuredRepetitions();
await runSize(sizes[0] ?? 100);
const results = [];
for (const size of sizes) {
	const samples = [];
	for (let repetition = 0; repetition < repetitions; repetition += 1)
		samples.push(await runSize(size));
	results.push({ messageCount: size, samples });
}

process.stdout.write(
	`${JSON.stringify(
		{
			methodology: {
				node: process.version,
				platform: process.platform,
				osRelease: release(),
				arch: process.arch,
				cpu: cpus()[0]?.model ?? "unknown",
				logicalCpuCount: cpus().length,
				totalMemoryBytes: totalmem(),
				messageShape: "alternating synthetic DM request/reply pairs",
				acceptance: "one service.send call through atomic JSON persistence",
				bootstrap: "service bootstrap plus serialized UTF-8 payload size",
				search: "in-memory query for two matching terms, limit 24",
				exportImport: "version-1 JSON archive through service boundaries",
				memory:
					"process.memoryUsage deltas with explicit GC before each operation when available",
				warmup: "one discarded run at the smallest configured message count",
				repetitions,
			},
			results,
		},
		null,
		2,
	)}\n`,
);
