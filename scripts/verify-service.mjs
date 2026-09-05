import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	installOrUpdate,
	rollbackRelease,
	serviceLayout,
	serviceStatus,
} from "./commonspace-service.mjs";

if (process.platform !== "darwin")
	throw new Error("installed service verification currently requires macOS");

const repoRoot = process.cwd();
const temporaryHome = await mkdtemp(
	join(tmpdir(), "commonspace-service-live-"),
);
const appRoot = join(temporaryHome, "Commonspace");
let loaded = false;

function run(command, args, options = {}) {
	if (command === "/bin/launchctl") {
		if (args[0] === "bootstrap") loaded = true;
		if (args[0] === "bootout") loaded = false;
		return Promise.resolve({
			exitCode: args[0] === "print" && !loaded ? 113 : 0,
			stdout: "",
			stderr: "",
		});
	}
	return new Promise((resolveRun) => {
		execFile(
			command,
			args,
			{ cwd: options.cwd, env: process.env, maxBuffer: 8 * 1024 * 1024 },
			(error, stdout, stderr) => {
				resolveRun({
					exitCode:
						typeof error?.code === "number"
							? error.code
							: error === null || error === undefined
								? 0
								: 1,
					stdout,
					stderr:
						error !== null && error !== undefined && stderr === ""
							? error.message
							: stderr,
				});
			},
		);
	});
}

const runtime = {
	platform: "darwin",
	home: temporaryHome,
	uid: process.getuid(),
	nodePath: process.execPath,
	pathEnvironment: process.env.PATH,
	run,
	health: async () => true,
	log: () => undefined,
};

try {
	await installOrUpdate(
		{ mode: "install", source: repoRoot, appRoot },
		runtime,
	);
	await installOrUpdate({ mode: "update", source: repoRoot, appRoot }, runtime);
	await rollbackRelease({ appRoot }, runtime);
	const status = await serviceStatus({ appRoot }, runtime);
	if (
		!status.installed ||
		!status.loaded ||
		!status.healthy ||
		status.release === null
	) {
		throw new Error(
			`installed service status failed: ${JSON.stringify(status)}`,
		);
	}
	const layout = serviceLayout({
		appRoot,
		home: temporaryHome,
		uid: runtime.uid,
	});
	const [server, ui] = await Promise.all([
		readFile(join(layout.current, "server", "dist", "index.js"), "utf8"),
		readFile(join(layout.current, "ui", "dist", "index.html"), "utf8"),
	]);
	if (server === "" || !ui.includes("<!doctype html>"))
		throw new Error("installed release build is incomplete");
	process.stdout.write(
		`${JSON.stringify({
			installed: true,
			updated: true,
			rolledBack: true,
			release: status.release,
			plistValidated: true,
		})}\n`,
	);
} finally {
	await rm(temporaryHome, { recursive: true, force: true });
}
