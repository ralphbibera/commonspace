import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyReleaseAssets, releaseName } from "../scripts/package-release.mjs";

const roots = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("release packaging", () => {
	it("names only supported versioned runtime targets", () => {
		expect(releaseName("0.1.0", "darwin", "arm64")).toBe(
			"commonspace-0.1.0-darwin-arm64",
		);
		expect(releaseName("0.2.0-beta.1", "linux", "x64")).toBe(
			"commonspace-0.2.0-beta.1-linux-x64",
		);
		for (const version of [
			"../private",
			"v0.1.0",
			"01.2.3",
			"0.1",
			"0.1.0/extra",
		]) {
			expect(() => releaseName(version, "darwin", "arm64")).toThrow("version");
		}
		expect(() => releaseName("0.1.0", "win32", "x64")).toThrow("target");
		expect(() => releaseName("0.1.0", "linux", "arm64")).toThrow("target");
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
		]);
		expect(
			await readFile(join(target, "ui/dist/assets/client.js"), "utf8"),
		).toBe("client");
		expect(await readFile(join(target, "README.md"), "utf8")).toBe(
			"installation instructions",
		);
	});
});
