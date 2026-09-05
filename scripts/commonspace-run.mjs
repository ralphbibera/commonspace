#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

// This entry point is copied to the root of the runtime archive.
async function main() {
	const [command = "start", ...rest] = process.argv.slice(2);
	if (rest.length > 0 || !["start", "--version", "--help"].includes(command)) {
		throw new Error("Usage: node commonspace.mjs [start|--version|--help]");
	}
	if (command === "--help") {
		process.stdout.write(
			"Usage: node commonspace.mjs [start|--version|--help]\nRequires Node.js 22+. Opens UI and API at http://127.0.0.1:3100.\nSet COMMONSPACE_PORT or COMMONSPACE_HOME to override port or state directory.\nStop with Ctrl+C. macOS background install: node scripts/commonspace-service.mjs install --release .\n",
		);
		return;
	}
	const metadata = JSON.parse(
		await readFile(
			new URL("./commonspace-release.json", import.meta.url),
			"utf8",
		),
	);
	if (command === "--version") {
		process.stdout.write(`${metadata.version}\n`);
		return;
	}
	if (Number(process.versions.node.split(".")[0]) < 22)
		throw new Error("Commonspace requires Node.js 22 or newer");
	if (
		metadata.platform !== process.platform ||
		metadata.arch !== process.arch
	) {
		throw new Error(
			`This package requires ${metadata.platform}-${metadata.arch}; running ${process.platform}-${process.arch}`,
		);
	}
	process.env.NODE_ENV = "production";
	process.env.COMMONSPACE_UI_ROOT = fileURLToPath(
		new URL("./ui/dist", import.meta.url),
	);
	const { runCommonspaceCli } = await import(
		new URL("./server/dist/index.js", import.meta.url).href
	);
	await runCommonspaceCli();
}

void main().catch((error) => {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = 1;
});
