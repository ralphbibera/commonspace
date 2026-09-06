import { fileURLToPath } from "node:url";
import { runCommonspaceCli } from "../../server/src/index.js";
import { COMMONSPACE_VERSION } from "../../server/src/version.js";

async function main(): Promise<void> {
	const [command = "start", ...rest] = process.argv.slice(2);
	if (rest.length > 0 || !["start", "--version", "--help"].includes(command))
		throw new Error("Usage: commonspace [start|--version|--help]");
	if (command === "--version") {
		process.stdout.write(`${COMMONSPACE_VERSION}\n`);
		return;
	}
	if (command === "--help") {
		process.stdout.write(
			"Usage: commonspace [start|--version|--help]\nStarts Commonspace at http://127.0.0.1:3100.\nSet COMMONSPACE_PORT or COMMONSPACE_HOME to override runtime defaults.\n",
		);
		return;
	}
	process.env.NODE_ENV = "production";
	process.env.COMMONSPACE_UI_ROOT ??= fileURLToPath(
		new URL("../ui-dist", import.meta.url),
	);
	await runCommonspaceCli();
}

void main().catch((error: Error) => {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = 1;
});
