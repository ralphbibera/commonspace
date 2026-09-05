import { execFile } from "node:child_process";
import {
	cp,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	realpath,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { URL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { copyReleaseAssets, releaseName } from "../scripts/package-release.mjs";

const roots = [];
const run = promisify(execFile);
const workspacePackages = ["packages/shared", "server", "ui"];

async function versionCheckout(version) {
	const root = await realpath(
		await mkdtemp(join(tmpdir(), "commonspace-version-test-")),
	);
	roots.push(root);
	await cp(new URL("../scripts/", import.meta.url), join(root, "scripts"), {
		recursive: true,
	});
	for (const directory of [".", ...workspacePackages]) {
		await mkdir(join(root, directory), { recursive: true });
		await writeFile(
			join(root, directory, "package.json"),
			JSON.stringify({ version }),
		);
	}
	return root;
}

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("release packaging", () => {
	it("names only supported versioned runtime targets", () => {
		expect(releaseName("0.0.1", "darwin", "arm64")).toBe(
			"commonspace-0.0.1-darwin-arm64",
		);
		expect(releaseName("0.2.0-beta.1", "linux", "x64")).toBe(
			"commonspace-0.2.0-beta.1-linux-x64",
		);
		for (const version of [
			"../private",
			"v0.0.1",
			"01.2.3",
			"0.1",
			"0.0.1/extra",
			"0.0.1-rc.01",
			"0.0.1-01",
			"0.0.1+build..1",
			"0.0.1\n",
		]) {
			expect(() => releaseName(version, "darwin", "arm64")).toThrow("version");
		}
		expect(() => releaseName("0.1.0", "win32", "x64")).toThrow("target");
		expect(() => releaseName("0.1.0", "linux", "arm64")).toThrow("target");
	});

	it("preserves SemVer build metadata in archive names", () => {
		expect(releaseName("0.0.1+build.01", "linux", "x64")).toBe(
			"commonspace-0.0.1+build.01-linux-x64",
		);
		expect(releaseName("0.0.2-rc.1+build.01", "darwin", "arm64")).toBe(
			"commonspace-0.0.2-rc.1+build.01-darwin-arm64",
		);
	});

	it.each([
		["0.0.1", false],
		["0.0.1+build-alpha.01", false],
		["0.0.2-rc.1+build.01", true],
	])(
		"reports prerelease status for exact tag v%s",
		async (version, prerelease) => {
			const root = await versionCheckout(version);
			const result = await run(process.execPath, [
				join(root, "scripts/package-release.mjs"),
				"--check-tag",
				`v${version}`,
			]);
			expect(result.stdout).toBe(`prerelease=${String(prerelease)}\n`);
		},
	);

	it.each(workspacePackages)(
		"rejects a mismatched %s version before packaging",
		async (directory) => {
			const root = await versionCheckout("0.0.1");
			await writeFile(
				join(root, directory, "package.json"),
				JSON.stringify({ version: "0.0.2" }),
			);
			await expect(
				run(process.execPath, [
					join(root, "scripts/package-release.mjs"),
					"--check-tag",
					"v0.0.1",
				]),
			).rejects.toMatchObject({
				stderr: expect.stringContaining(
					`${directory}/package.json version must be 0.0.1`,
				),
			});
		},
	);

	it("rejects a tag that does not match the application version", async () => {
		const root = await versionCheckout("0.0.1");
		await expect(
			run(process.execPath, [
				join(root, "scripts/package-release.mjs"),
				"--check-tag",
				"v0.1.0",
			]),
		).rejects.toMatchObject({
			stderr: expect.stringContaining("Release tag must be v0.0.1"),
		});
	});

	it("copies only built UI and documented runtime assets from the checkout", async () => {
		const root = await mkdtemp(join(tmpdir(), "commonspace-package-test-"));
		roots.push(root);
		const source = join(root, "source");
		const target = join(root, "release");
		const files = {
			"ui/dist/index.html": "<html>packaged client</html>",
			"ui/dist/assets/client.js": "client",
			"scripts/commonspace-run.mjs": "launcher",
			"scripts/commonspace-service.mjs": "service",
			"scripts/release-version.mjs": "version validation",
			"docs/install.md": "installation instructions",
			LICENSE: "MIT",
			".env": "must stay local",
			".commonspace/state.json": "private transcript",
			"ui/src/private.ts": "source file",
			"scripts/private.mjs": "unrelated script",
		};
		for (const [path, contents] of Object.entries(files)) {
			await mkdir(dirname(join(source, path)), { recursive: true });
			await writeFile(join(source, path), contents);
		}
		await copyReleaseAssets(source, target);
		expect((await readdir(target)).sort()).toEqual([
			"LICENSE",
			"README.md",
			"commonspace.mjs",
			"scripts",
			"ui",
		]);
		expect(await readdir(join(target, "scripts"))).toEqual([
			"commonspace-service.mjs",
			"release-version.mjs",
		]);
		expect(
			await readFile(join(target, "ui/dist/assets/client.js"), "utf8"),
		).toBe("client");
		expect(await readFile(join(target, "README.md"), "utf8")).toBe(
			"installation instructions",
		);
	});
});
