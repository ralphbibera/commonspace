// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { resolveProjectDirectory } from "../server/src/directory-picker.ts";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("project directory selection", () => {
	it("uses the repository root when a nested Git directory is selected", async () => {
		const repository = await mkdtemp(
			join(tmpdir(), "commonspace-directory-picker-"),
		);
		roots.push(repository);
		const nestedDirectory = join(repository, "packages", "ui");
		await mkdir(nestedDirectory, { recursive: true });
		await execFileAsync("git", ["init", "--quiet"], { cwd: repository });

		await expect(resolveProjectDirectory(nestedDirectory)).resolves.toBe(
			await realpath(repository),
		);
	});
});
