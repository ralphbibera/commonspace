import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default async function globalTeardown() {
	const temporaryRoot = tmpdir();
	const entries = await readdir(temporaryRoot, { withFileTypes: true });
	await Promise.all(
		entries
			.filter(
				(entry) =>
					entry.isDirectory() && entry.name.startsWith("commonspace-e2e-home-"),
			)
			.map((entry) =>
				rm(join(temporaryRoot, entry.name), {
					force: true,
					recursive: true,
				}),
			),
	);
}
