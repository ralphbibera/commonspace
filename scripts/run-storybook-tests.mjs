import { spawn } from "node:child_process";
import process from "node:process";
import { URL } from "node:url";

const mode = process.argv[2];
if (mode !== "run")
	throw new Error(`Expected Storybook test mode run, received ${mode}`);

const forwardedArguments = process.argv.slice(3);
if (forwardedArguments[0] === "--") forwardedArguments.shift();

const child = spawn(
	"pnpm",
	[
		"exec",
		"vitest",
		mode,
		"--config",
		"vitest.storybook.config.ts",
		...forwardedArguments,
	],
	{
		cwd: new URL("../ui", import.meta.url),
		env: {
			...process.env,
			COMMONSPACE_STORYBOOK_TEST: "1",
			STORYBOOK_DISABLE_TELEMETRY: "1",
		},
		stdio: "inherit",
	},
);

child.once("error", (error) => {
	throw error;
});
child.once("exit", (code, signal) => {
	if (signal !== null) process.kill(process.pid, signal);
	else process.exitCode = code ?? 1;
});
