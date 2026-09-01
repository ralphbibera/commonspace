import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startDevelopmentSupervisor } from "./dev-supervisor.js";

async function runDevelopmentServer(): Promise<void> {
	const sourceDirectory = dirname(fileURLToPath(import.meta.url));
	const serverRoot = resolve(sourceDirectory, "..");
	const repositoryRoot = resolve(serverRoot, "..");
	const supervisor = startDevelopmentSupervisor({
		command: process.execPath,
		args: ["--import", "tsx", resolve(serverRoot, "src/index.ts")],
		cwd: serverRoot,
		env: process.env,
		watchPaths: [
			resolve(serverRoot, "src"),
			resolve(repositoryRoot, "packages/shared/src"),
		],
	});

	let stopping = false;
	const stop = () => {
		if (stopping) return;
		stopping = true;
		void supervisor
			.close()
			.then(() => {
				process.exitCode = 0;
			})
			.catch((error: Error) => {
				process.stderr.write(`${String(error)}\n`);
				process.exitCode = 1;
			});
	};
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
}

const entryPath = process.argv[1]?.replaceAll("\\", "/");
if (
	entryPath?.endsWith("/server/src/dev.ts") === true ||
	entryPath?.endsWith("/server/dist/dev.js") === true
) {
	void runDevelopmentServer().catch((error: Error) => {
		process.stderr.write(`${String(error)}\n`);
		process.exitCode = 1;
	});
}
