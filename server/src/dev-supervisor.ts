import {
	type ChildProcess,
	type Serializable,
	spawn,
} from "node:child_process";
import { type FSWatcher, statSync, watch } from "node:fs";

const DEVELOPMENT_READY_MESSAGE = "commonspace:development-ready";
const DEVELOPMENT_RESTART_MESSAGE = "commonspace:development-restart";

interface DevelopmentSupervisorLogger {
	info(message: string): void;
	error(message: string): void;
}

export interface StartDevelopmentSupervisorOptions {
	command: string;
	args: readonly string[];
	cwd: string;
	env?: NodeJS.ProcessEnv;
	watchPaths: readonly string[];
	debounceMs?: number;
	logger?: DevelopmentSupervisorLogger;
}

export interface DevelopmentSupervisor {
	requestRestart(reason?: string): void;
	close(): Promise<void>;
}

function isReadyMessage(value: Serializable): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		value.type === DEVELOPMENT_READY_MESSAGE
	);
}

function defaultLogger(): DevelopmentSupervisorLogger {
	return {
		info: (message) => process.stdout.write(`${message}\n`),
		error: (message) => process.stderr.write(`${message}\n`),
	};
}

async function terminateChild(child: ChildProcess | undefined): Promise<void> {
	if (
		child === undefined ||
		child.exitCode !== null ||
		child.signalCode !== null
	)
		return;
	let exited = false;
	const exit = new Promise<void>((resolve) => {
		child.once("exit", () => {
			exited = true;
			resolve();
		});
	});
	child.kill("SIGTERM");
	let timeout: NodeJS.Timeout | undefined;
	await Promise.race([
		exit,
		new Promise<void>((resolve) => {
			timeout = setTimeout(resolve, 5_000);
		}),
	]);
	if (timeout !== undefined) clearTimeout(timeout);
	if (exited) return;
	child.kill("SIGKILL");
	await exit;
}

export function startDevelopmentSupervisor(
	options: StartDevelopmentSupervisorOptions,
): DevelopmentSupervisor {
	const logger = options.logger ?? defaultLogger();
	const debounceMs = Math.max(10, Math.trunc(options.debounceMs ?? 100));
	const watchers: FSWatcher[] = [];
	const pendingReasons = new Set<string>();
	let child: ChildProcess | undefined;
	let childReady = false;
	let restartSent = false;
	let restartTimer: NodeJS.Timeout | undefined;
	let stopping = false;
	let closeOperation: Promise<void> | undefined;

	const startChild = (): void => {
		if (stopping || child !== undefined) return;
		const started = spawn(options.command, [...options.args], {
			cwd: options.cwd,
			env: options.env ?? process.env,
			shell: false,
			stdio: ["inherit", "inherit", "inherit", "ipc"],
			windowsHide: true,
		});
		child = started;
		childReady = false;
		restartSent = false;
		started.on("message", (message: Serializable) => {
			if (child !== started || !isReadyMessage(message)) return;
			childReady = true;
			dispatchRestart();
		});
		started.once("error", (error) => {
			logger.error(`[commonspace:dev] Server process failed: ${error.message}`);
		});
		started.once("exit", (code, signal) => {
			if (child !== started) return;
			const expectedRestart = restartSent || pendingReasons.size > 0;
			child = undefined;
			childReady = false;
			restartSent = false;
			if (stopping) return;
			if (expectedRestart) {
				pendingReasons.clear();
				logger.info(
					"[commonspace:dev] Starting the updated server generation.",
				);
				startChild();
				return;
			}
			const outcome =
				code === null ? (signal ?? "unknown signal") : `code ${String(code)}`;
			logger.error(
				`[commonspace:dev] Server exited with ${outcome}; waiting for a source change to restart.`,
			);
		});
	};

	const dispatchRestart = (): void => {
		if (stopping || pendingReasons.size === 0) return;
		if (child === undefined) {
			pendingReasons.clear();
			startChild();
			return;
		}
		if (!childReady || restartSent) return;
		restartSent = true;
		const reason = [...pendingReasons].at(-1);
		logger.info(
			`[commonspace:dev] ${reason ?? "Source changed"}; keeping the current server alive until active agents finish.`,
		);
		child.send({ type: DEVELOPMENT_RESTART_MESSAGE }, (error) => {
			if (error === null) return;
			logger.error(
				`[commonspace:dev] Could not request a graceful restart: ${error.message}`,
			);
		});
	};

	const requestRestart = (reason = "Source changed"): void => {
		if (stopping) return;
		pendingReasons.add(reason);
		if (restartSent) return;
		if (restartTimer !== undefined) clearTimeout(restartTimer);
		restartTimer = setTimeout(() => {
			restartTimer = undefined;
			dispatchRestart();
		}, debounceMs);
	};

	try {
		for (const path of options.watchPaths) {
			const recursive = statSync(path).isDirectory();
			const watcher = watch(path, { recursive }, (_event, filename) => {
				const changed = filename === null ? path : String(filename);
				requestRestart(`Change detected in ${changed}`);
			});
			watcher.on("error", (error) => {
				logger.error(
					`[commonspace:dev] Watcher failed for ${path}: ${error.message}`,
				);
			});
			watchers.push(watcher);
		}
	} catch (error) {
		for (const watcher of watchers) watcher.close();
		throw error;
	}
	startChild();

	return {
		requestRestart,
		async close() {
			closeOperation ??= (async () => {
				stopping = true;
				if (restartTimer !== undefined) clearTimeout(restartTimer);
				for (const watcher of watchers) watcher.close();
				await terminateChild(child);
			})();
			await closeOperation;
		},
	};
}

export const developmentServerMessages = {
	ready: DEVELOPMENT_READY_MESSAGE,
	restart: DEVELOPMENT_RESTART_MESSAGE,
} as const;
