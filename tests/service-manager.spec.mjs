import { execFile } from "node:child_process";
import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readlink,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_COMMONSPACE_SOURCE,
	installOrUpdate,
	rollbackRelease,
	serviceHealth,
	serviceLayout,
	serviceStatus,
} from "../scripts/commonspace-service.mjs";

const roots = [];

describe.skipIf(process.platform !== "darwin")("managed service health", () => {
	it.each([
		{ managedPid: process.pid, healthy: true },
		{ managedPid: 1, healthy: false },
	])(
		"requires the managed process to own the HTTP listener: $healthy",
		async ({ managedPid, healthy }) => {
			const server = createServer((_request, response) => {
				response.setHeader("Content-Type", "application/json");
				response.end(JSON.stringify({ status: "ok" }));
			});
			await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
			const address = server.address();
			const run = (command, args) => {
				if (command === "/bin/launchctl") {
					return Promise.resolve({
						exitCode: 0,
						stdout: `state = running\npid = ${String(managedPid)}\n`,
						stderr: "",
					});
				}
				return new Promise((resolve) => {
					execFile(command, args, (error, stdout, stderr) => {
						resolve({ exitCode: error === null ? 0 : 1, stdout, stderr });
					});
				});
			};
			try {
				expect(
					await serviceHealth(
						`http://127.0.0.1:${String(address.port)}`,
						{ target: "gui/501/dev.commonspace.service" },
						run,
					),
				).toBe(healthy);
			} finally {
				await new Promise((resolve) => server.close(resolve));
			}
		},
	);
});

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

async function fixture() {
	const home = await mkdtemp(join(tmpdir(), "commonspace-service-manager-"));
	roots.push(home);
	const appRoot = join(home, "Application Support", "Commonspace & Local");
	const calls = [];
	const logs = [];
	let clone = 0;
	let loaded = false;
	const dependencies = {
		platform: "darwin",
		home,
		uid: 501,
		nodePath: "/opt/homebrew/bin/node",
		pathEnvironment: "/opt/homebrew/bin:/usr/bin:/bin",
		now: () => "2026-08-31T12:00:00.000Z",
		randomId: () => `release-${String(clone + 1)}`,
		health: async () => true,
		log: (message) => {
			logs.push(message);
		},
		run: async (command, args, options = {}) => {
			calls.push({ command, args, options });
			if (command === "/bin/launchctl") {
				if (args[0] === "bootstrap") loaded = true;
				if (args[0] === "bootout") loaded = false;
				if (args[0] === "print" && !loaded)
					return { exitCode: 113, stdout: "", stderr: "not loaded" };
			}
			if (command === "git" && args[0] === "clone") {
				clone += 1;
				const target = args.at(-1);
				await mkdir(join(target, "server", "dist"), { recursive: true });
				await mkdir(join(target, "ui", "dist"), { recursive: true });
				await mkdir(join(target, "scripts"), { recursive: true });
				await writeFile(
					join(target, "server", "dist", "index.js"),
					`// server ${String(clone)}`,
				);
				await writeFile(
					join(target, "ui", "dist", "index.html"),
					`release ${String(clone)}`,
				);
				await writeFile(
					join(target, "scripts", "commonspace-service.mjs"),
					"#!/usr/bin/env node\n",
				);
				await writeFile(join(target, "release-marker"), String(clone));
				await writeFile(join(target, "scripts", "release-version.mjs"), "");
			}
			if (command === "git" && args[0] === "rev-parse") {
				return { exitCode: 0, stdout: `commit-${String(clone)}\n`, stderr: "" };
			}
			return { exitCode: 0, stdout: "", stderr: "" };
		},
	};
	return { home, appRoot, calls, logs, dependencies };
}

describe("packaged Commonspace service releases", () => {
	it("installs a packaged release without Git or a build and preserves relocated dependency links and state", async () => {
		const { appRoot, calls, dependencies, home } = await fixture();
		const release = join(home, "download");
		await mkdir(join(release, "server/dist"), { recursive: true });
		await mkdir(join(release, "server/node_modules/example"), {
			recursive: true,
		});
		await mkdir(join(release, "ui/dist"), { recursive: true });
		await mkdir(join(release, "scripts"), { recursive: true });
		await writeFile(join(release, "server/dist/index.js"), "packaged server");
		await writeFile(
			join(release, "server/node_modules/example/index.js"),
			"dependency",
		);
		await symlink("example", join(release, "server/node_modules/linked"));
		await writeFile(join(release, "ui/dist/index.html"), "packaged UI");
		await writeFile(
			join(release, "scripts/commonspace-service.mjs"),
			"#!/usr/bin/env node\n",
		);
		await writeFile(join(release, "scripts/release-version.mjs"), "");
		await writeFile(
			join(release, "commonspace-release.json"),
			JSON.stringify({
				version: "0.0.1+build.01",
				revision: "a".repeat(40),
				platform: "darwin",
				arch: process.arch,
				distribution: "archive",
			}),
		);
		await mkdir(join(home, ".commonspace"));
		await writeFile(
			join(home, ".commonspace/state.json"),
			"existing workspace",
		);
		await installOrUpdate({ appRoot, release }, dependencies);
		const layout = serviceLayout({ appRoot, home, uid: dependencies.uid });
		expect(
			JSON.parse(
				await readFile(
					join(layout.current, "commonspace-release.json"),
					"utf8",
				),
			).version,
		).toBe("0.0.1+build.01");
		await rm(release, { recursive: true });
		expect(
			await readFile(
				join(layout.current, "server/node_modules/linked/index.js"),
				"utf8",
			),
		).toBe("dependency");
		expect(await readFile(join(home, ".commonspace/state.json"), "utf8")).toBe(
			"existing workspace",
		);
		expect(
			calls.some(({ command }) =>
				["git", "corepack", "pnpm"].includes(command),
			),
		).toBe(false);
		await expect(
			installOrUpdate({ mode: "update", appRoot }, dependencies),
		).rejects.toThrow("--release");
	});

	it.each([
		{ version: "0.0.1", platform: "linux", error: "platform" },
		{ version: "0.0.1-rc.01", platform: "darwin", error: "version" },
		{ version: "0.0.1+build..1", platform: "darwin", error: "version" },
	])(
		"rejects an incompatible package ($version, $platform) before replacing the installed release",
		async ({ version, platform, error }) => {
			const { appRoot, dependencies, home } = await fixture();
			await installOrUpdate({ appRoot }, dependencies);
			const release = join(home, "wrong-platform");
			await mkdir(release);
			await writeFile(
				join(release, "commonspace-release.json"),
				JSON.stringify({
					version,
					revision: "a".repeat(40),
					platform,
					arch: "x64",
					distribution: "archive",
				}),
			);
			await expect(
				installOrUpdate({ mode: "update", appRoot, release }, dependencies),
			).rejects.toThrow(error);
			expect(
				await readFile(join(appRoot, "current/release-marker"), "utf8"),
			).toBe("1");
		},
	);
});

describe("installed Commonspace service manager", () => {
	it("waits for the previous job to unload before replacing its application files", async () => {
		const { appRoot, dependencies } = await fixture();
		await installOrUpdate({ appRoot }, dependencies);
		const originalRun = dependencies.run;
		let stopping = false;
		let checks = 0;
		dependencies.run = async (command, args, options) => {
			if (command === "/bin/launchctl" && args[0] === "bootout")
				stopping = true;
			if (command === "/bin/launchctl" && args[0] === "print" && stopping) {
				checks += 1;
				if (checks <= 2) {
					expect(
						await readFile(join(appRoot, "current/release-marker"), "utf8"),
					).toBe("1");
					return { exitCode: 0, stdout: "unloading", stderr: "" };
				}
			}
			return originalRun(command, args, options);
		};
		await installOrUpdate({ mode: "update", appRoot }, dependencies);
		expect(checks).toBe(3);
		expect(
			await readFile(join(appRoot, "current/release-marker"), "utf8"),
		).toBe("2");
	});

	it("installs and updates an atomic managed release with a launchd service and rollback", async () => {
		const { appRoot, calls, dependencies, home } = await fixture();
		const layout = serviceLayout({ appRoot, home, uid: dependencies.uid });

		await installOrUpdate({ mode: "install", appRoot }, dependencies);

		expect(calls[0]).toMatchObject({
			command: "git",
			args: expect.arrayContaining(["clone", DEFAULT_COMMONSPACE_SOURCE]),
		});
		expect(await readFile(join(layout.current, "release-marker"), "utf8")).toBe(
			"1",
		);
		expect(await readlink(layout.binPath)).toBe(
			join(layout.current, "scripts", "commonspace-service.mjs"),
		);
		expect((await lstat(layout.binPath)).isSymbolicLink()).toBe(true);
		const plist = await readFile(layout.launchAgentPath, "utf8");
		expect(plist).toContain("dev.commonspace.service");
		expect(plist).toContain("/opt/homebrew/bin/node");
		expect(plist).toContain("Commonspace &amp; Local/current/ui/dist");
		expect(plist).not.toContain("Commonspace & Local/current/ui/dist");
		expect(calls).toContainEqual(
			expect.objectContaining({
				command: "/usr/bin/plutil",
				args: ["-lint", expect.stringContaining(".plist.")],
			}),
		);
		expect(calls).toContainEqual(
			expect.objectContaining({
				command: "/bin/launchctl",
				args: ["bootstrap", "gui/501", layout.launchAgentPath],
			}),
		);

		await installOrUpdate({ mode: "update", appRoot }, dependencies);

		expect(await readFile(join(layout.current, "release-marker"), "utf8")).toBe(
			"2",
		);
		expect(
			await readFile(join(layout.previous, "release-marker"), "utf8"),
		).toBe("1");
		await rollbackRelease({ appRoot }, dependencies);
		expect(await readFile(join(layout.current, "release-marker"), "utf8")).toBe(
			"1",
		);
		expect(
			await readFile(join(layout.previous, "release-marker"), "utf8"),
		).toBe("2");

		await expect(
			serviceStatus({ appRoot }, dependencies),
		).resolves.toMatchObject({
			installed: true,
			loaded: true,
			healthy: true,
			release: "commit-1",
			url: "http://127.0.0.1:3100",
		});
	});

	it("rejects installation outside the supported macOS owner session", async () => {
		const { appRoot, dependencies } = await fixture();
		await expect(
			installOrUpdate(
				{ mode: "install", appRoot },
				{ ...dependencies, platform: "linux" },
			),
		).rejects.toThrow("macOS");
	});

	it("refuses broad roots and preserves an unrelated command at the install target", async () => {
		const { appRoot, dependencies, home } = await fixture();
		expect(() =>
			serviceLayout({ appRoot: home, home, uid: dependencies.uid }),
		).toThrow("dedicated Commonspace directory");

		const layout = serviceLayout({ appRoot, home, uid: dependencies.uid });
		await mkdir(dirname(layout.binPath), { recursive: true });
		await writeFile(layout.binPath, "unrelated command");
		await expect(
			installOrUpdate({ mode: "install", appRoot }, dependencies),
		).rejects.toThrow("refusing to overwrite an unrelated Commonspace command");
		await expect(readFile(layout.binPath, "utf8")).resolves.toBe(
			"unrelated command",
		);
		await expect(lstat(layout.current)).rejects.toThrow();
	});
});
