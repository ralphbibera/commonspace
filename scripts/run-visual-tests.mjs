import { spawn } from "node:child_process";
import process from "node:process";
import { URL } from "node:url";

const forwardedArguments = process.argv.slice(2);
if (forwardedArguments[0] === "--") forwardedArguments.shift();

function run(arguments_) {
	return new Promise((resolve, reject) => {
		const child = spawn("pnpm", arguments_, {
			cwd: new URL("..", import.meta.url),
			env: process.env,
			stdio: "inherit",
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (signal !== null) process.kill(process.pid, signal);
			else resolve(code ?? 1);
		});
	});
}

const buildExitCode = await run(["build:storybook"]);
if (buildExitCode !== 0) process.exitCode = buildExitCode;
else {
	process.exitCode = await run([
		"exec",
		"playwright",
		"test",
		"--config",
		"playwright.visual.config.ts",
		...forwardedArguments,
	]);
}
