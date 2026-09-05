import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	realpath,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { promisify } from "node:util";
import { releaseName } from "./package-release.mjs";

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

async function verifyLinks(root, path = root) {
	for (const entry of await readdir(path, { withFileTypes: true })) {
		const child = join(path, entry.name);
		assert(
			![".modules.yaml", ".pnpm-workspace-state-v1.json"].includes(entry.name),
			"Package contains builder-specific package manager state",
		);
		if (basename(path) === ".bin")
			assert(
				entry.isSymbolicLink(),
				"Packaged executables must use portable links, not build-machine launchers",
			);
		if (entry.isSymbolicLink()) {
			const target = relative(root, await realpath(child));
			assert(
				!target.startsWith("..") && !isAbsolute(target),
				`Dependency link escapes the package: ${relative(root, child)}`,
			);
		} else if (entry.isDirectory()) {
			await verifyLinks(root, child);
		}
	}
}

async function verifyMacInstallation(root, home) {
	const { installOrUpdate, rollbackRelease } = await import(
		pathToFileURL(join(root, "scripts/commonspace-service.mjs")).href
	);
	let loaded = false;
	const runtime = {
		home,
		uid: process.getuid(),
		log: () => undefined,
		health: async () => true,
		run: async (command, args, options = {}) => {
			if (command === "/bin/launchctl") {
				if (args[0] === "bootstrap") loaded = true;
				if (args[0] === "bootout") loaded = false;
				return {
					exitCode: args[0] === "print" && !loaded ? 113 : 0,
					stdout: "",
					stderr: "",
				};
			}
			const result = await run(command, args, options);
			return { ...result, exitCode: 0 };
		},
	};
	const appRoot = join(home, "Commonspace");
	const layout = await installOrUpdate({ appRoot, release: root }, runtime);
	await writeFile(
		join(layout.current, "rollback-proof"),
		"original installation",
	);
	await installOrUpdate({ appRoot, release: root, mode: "update" }, runtime);
	assert(!(await readdir(layout.current)).includes("rollback-proof"));
	await rollbackRelease({ appRoot }, runtime);
	assert.equal(
		await readFile(join(layout.current, "rollback-proof"), "utf8"),
		"original installation",
	);
	await rm(root, { recursive: true });
	return layout.current;
}

async function verifyRuntime(root, temporary, home, version) {
	const entry = join(root, "commonspace.mjs");
	const environment = {
		HOME: home,
		PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
		COMMONSPACE_HOME: join(home, ".commonspace"),
		COMMONSPACE_PORT: "0",
		COMMONSPACE_LOG_LEVEL: "error",
	};
	const reported = await run(process.execPath, [entry, "--version"], {
		cwd: temporary,
		env: environment,
	});
	assert.equal(reported.stdout.trim(), version);
	const child = spawn(process.execPath, [entry], {
		cwd: temporary,
		env: environment,
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	let spawnError;
	child.on("error", (error) => {
		spawnError = error;
	});
	child.stdout.on("data", (chunk) => {
		output = `${output}${chunk}`.slice(-100_000);
	});
	child.stderr.on("data", (chunk) => {
		output = `${output}${chunk}`.slice(-100_000);
	});
	let closed = false;
	const stopped = new Promise((resolveStop) =>
		child.once("close", (code) => {
			closed = true;
			resolveStop(code);
		}),
	);
	try {
		let url;
		for (let attempt = 0; attempt < 120; attempt += 1) {
			if (spawnError !== undefined) throw spawnError;
			url = output.match(
				/Commonspace is running at (http:\/\/127\.0\.0\.1:\d+)/u,
			)?.[1];
			if (url !== undefined || closed) break;
			await delay(250);
		}
		assert(url !== undefined, `Packaged server failed to start:\n${output}`);
		const request = (path) =>
			fetch(`${url}${path}`, {
				headers: { Origin: url, "Sec-Fetch-Site": "same-origin" },
				signal: globalThis.AbortSignal.timeout(5000),
			});
		const health = await request("/api/health");
		assert.equal(health.status, 200, "Packaged health endpoint failed");
		assert.deepEqual(await health.json(), { status: "ok" });
		const bootstrap = await request("/api/bootstrap");
		assert.equal(bootstrap.status, 200, "Packaged bootstrap endpoint failed");
		assert.match(bootstrap.headers.get("content-type"), /application\/json/u);
		const page = await request("/");
		assert.equal(page.status, 200, "Packaged UI document failed");
		const html = await page.text();
		assert.match(html, /id="root"/u);
		const assets = [
			...html.matchAll(/(?:src|href)="(\/assets\/[^"#]+)"/gu),
		].map((match) => match[1]);
		assert(
			assets.some((asset) => asset.endsWith(".js")),
			"The package must serve the built browser entry",
		);
		for (const asset of assets) {
			const response = await request(asset);
			assert.equal(response.status, 200, `Missing packaged asset: ${asset}`);
			assert((await response.arrayBuffer()).byteLength > 0);
		}
		// A terminal sends Ctrl+C to the whole foreground process group.
		process.kill(-child.pid, "SIGINT");
		const deadline = setTimeout(() => child.kill("SIGKILL"), 5000);
		try {
			assert.equal(await stopped, 0, `Packaged shutdown failed:\n${output}`);
		} finally {
			clearTimeout(deadline);
		}
	} finally {
		if (!closed) {
			child.kill("SIGTERM");
			const deadline = setTimeout(() => child.kill("SIGKILL"), 5000);
			await stopped;
			clearTimeout(deadline);
		}
	}
}

async function main() {
	if (process.argv.length > 3)
		throw new Error("Usage: node scripts/verify-release.mjs [archive.tar.gz]");
	const { version } = JSON.parse(
		await readFile(join(repoRoot, "package.json"), "utf8"),
	);
	const name = releaseName(version, process.platform, process.arch);
	const archive = resolve(
		process.argv[2] ?? join(repoRoot, "artifacts/release", `${name}.tar.gz`),
	);
	const checksum = await readFile(`${archive}.sha256`, "utf8");
	const digest = createHash("sha256")
		.update(await readFile(archive))
		.digest("hex");
	assert.equal(
		checksum,
		`${digest}  ${basename(archive)}\n`,
		"Release checksum mismatch",
	);
	const temporary = await mkdtemp(join(tmpdir(), "commonspace-release-smoke-"));
	try {
		const { stdout: listing } = await run("tar", ["-tzf", archive], {
			maxBuffer: 8 * 1024 * 1024,
		});
		for (const path of listing.trim().split("\n")) {
			assert(
				path === `${name}/` || path.startsWith(`${name}/`),
				"Unexpected archive root",
			);
			assert(!path.split("/").includes(".."), "Unsafe archive path");
		}
		await run("tar", ["-xzf", archive, "-C", temporary]);
		let root = await realpath(join(temporary, name));
		await verifyLinks(root);
		const metadata = JSON.parse(
			await readFile(join(root, "commonspace-release.json"), "utf8"),
		);
		assert.equal(metadata.version, version);
		assert.equal(metadata.platform, process.platform);
		assert.equal(metadata.arch, process.arch);
		assert.equal(metadata.distribution, "archive");
		const notices = await readFile(
			join(root, "THIRD_PARTY_NOTICES.txt"),
			"utf8",
		);
		assert(
			notices.includes("Third-party notices"),
			"Missing dependency notices",
		);
		const home = join(temporary, "home");
		await mkdir(join(home, ".commonspace"), { recursive: true });
		const sentinel = join(home, ".commonspace/release-smoke-sentinel");
		await writeFile(sentinel, "preserve user data");
		if (process.platform === "darwin")
			root = await realpath(await verifyMacInstallation(root, home));
		await verifyLinks(root);
		await verifyRuntime(root, temporary, home, version);
		assert.equal(await readFile(sentinel, "utf8"), "preserve user data");
		process.stdout.write(
			`${JSON.stringify({ package: basename(archive), checksum: true, portableDependencies: true, runtime: true, uiAssets: true, cleanShutdown: true, macServiceLifecycle: process.platform === "darwin" ? "verified with launchctl and service health stubbed; real plist and foreground runtime" : "not applicable" })}\n`,
		);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

void main().catch((error) => {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = 1;
});
