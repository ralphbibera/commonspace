import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function packageArchiveName(name, version) {
	const normalized = name.startsWith("@")
		? name.slice(1).replaceAll("/", "-")
		: name;
	return `${normalized}-${version}.tgz`;
}

async function verifyRuntime(entry, root, home, version) {
	const reported = await run(process.execPath, [entry, "--version"], {
		cwd: root,
		env: { HOME: home, PATH: process.env.PATH ?? "" },
	});
	assert.equal(reported.stdout.trim(), version);
	const child = spawn(process.execPath, [entry], {
		cwd: root,
		env: {
			HOME: home,
			PATH: process.env.PATH ?? "",
			COMMONSPACE_HOME: join(home, ".commonspace"),
			COMMONSPACE_PORT: "0",
			COMMONSPACE_LOG_LEVEL: "error",
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	let closed = false;
	let spawnError;
	child.on("error", (error) => {
		spawnError = error;
	});
	child.stdout.on("data", (chunk) => {
		output = `${output}${String(chunk)}`.slice(-100_000);
	});
	child.stderr.on("data", (chunk) => {
		output = `${output}${String(chunk)}`.slice(-100_000);
	});
	const stopped = new Promise((resolveStop) => {
		child.once("close", (code) => {
			closed = true;
			resolveStop(code);
		});
	});
	try {
		let url;
		for (let attempt = 0; attempt < 120; attempt += 1) {
			if (spawnError !== undefined) throw spawnError;
			url = output.match(
				/Commonspace is running at (http:\/\/127\.0\.0\.1:\d+)/u,
			)?.[1];
			if (url !== undefined || closed) break;
			await new Promise((resolveWait) => setTimeout(resolveWait, 250));
		}
		assert(
			url !== undefined,
			`Installed npm package failed to start:\n${output}`,
		);
		const request = (path) =>
			fetch(`${url}${path}`, {
				headers: { Origin: url, "Sec-Fetch-Site": "same-origin" },
				signal: globalThis.AbortSignal.timeout(5_000),
			});
		const health = await request("/api/health");
		assert.equal(health.status, 200);
		assert.deepEqual(await health.json(), { status: "ok" });
		const page = await request("/");
		assert.equal(page.status, 200);
		const html = await page.text();
		assert.match(html, /id="root"/u);
		const assets = [
			...html.matchAll(/(?:src|href)="(\/assets\/[^"#]+)"/gu),
		].map((match) => match[1]);
		assert(assets.some((asset) => asset.endsWith(".js")));
		for (const asset of assets) {
			const response = await request(asset);
			assert.equal(response.status, 200, `Missing packaged asset: ${asset}`);
		}
		child.kill("SIGINT");
		const deadline = setTimeout(() => child.kill("SIGKILL"), 5_000);
		try {
			assert.equal(
				await stopped,
				0,
				`Installed npm package failed to stop:\n${output}`,
			);
		} finally {
			clearTimeout(deadline);
		}
	} finally {
		if (!closed) {
			child.kill("SIGTERM");
			const deadline = setTimeout(() => child.kill("SIGKILL"), 5_000);
			await stopped;
			clearTimeout(deadline);
		}
	}
}

async function main() {
	if (process.argv.length > 3)
		throw new Error("Usage: node scripts/verify-npm-package.mjs [package.tgz]");
	const sourceManifest = JSON.parse(
		await readFile(join(repoRoot, "cli/package.json"), "utf8"),
	);
	const archive = resolve(
		process.argv[2] ??
			join(
				repoRoot,
				"artifacts/npm",
				packageArchiveName(sourceManifest.name, sourceManifest.version),
			),
	);
	const temporary = await mkdtemp(join(tmpdir(), "commonspace-npm-smoke-"));
	try {
		const home = join(temporary, "home");
		const installRoot = join(temporary, "install");
		await mkdir(home);
		await run(
			"npm",
			[
				"install",
				"--prefix",
				installRoot,
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				archive,
			],
			{ cwd: temporary, maxBuffer: 8 * 1024 * 1024 },
		);
		const packageRoot = join(installRoot, "node_modules", sourceManifest.name);
		const installedManifest = JSON.parse(
			await readFile(join(packageRoot, "package.json"), "utf8"),
		);
		assert.equal(installedManifest.version, sourceManifest.version);
		assert.equal(installedManifest.private, undefined);
		assert(
			Object.values(installedManifest.dependencies).every(
				(specifier) => !specifier.startsWith("workspace:"),
			),
		);
		await verifyRuntime(
			join(packageRoot, installedManifest.bin.commonspace),
			installRoot,
			home,
			sourceManifest.version,
		);
		process.stdout.write(
			`${JSON.stringify({ package: archive, cleanInstall: true, runtime: true, uiAssets: true })}\n`,
		);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

void main().catch((error) => {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exitCode = 1;
});
