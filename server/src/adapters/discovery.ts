import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Discovery output is bounded and never includes native credential/session files. */
export async function readHarnessCommand(
	command: string,
	args: readonly string[],
	signal?: AbortSignal,
	env?: NodeJS.ProcessEnv,
): Promise<string> {
	const { stdout } = await execFileAsync(command, [...args], {
		maxBuffer: 1024 * 1024,
		timeout: 30_000,
		encoding: "utf8",
		signal,
		env: { ...process.env, ...env },
	});
	return stdout;
}
