import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
	chmod,
	cp,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { parseArgs, promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export function releaseName(version, platform, arch) {
	if (
		typeof version !== "string" ||
		!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)?$/u.test(
			version,
		)
	) {
		throw new Error(
			"Release version must be a semantic version without a v prefix",
		);
	}
	const target = `${platform}-${arch}`;
	if (!["darwin-arm64", "darwin-x64", "linux-x64"].includes(target)) {
		throw new Error(`Unsupported release target: ${target}`);
	}
	return `commonspace-${version}-${target}`;
}

export async function copyReleaseAssets(source, target) {
	const assets = [
		["ui/dist", "ui/dist"],
		["scripts/commonspace-run.mjs", "commonspace.mjs"],
		["scripts/commonspace-service.mjs", "scripts/commonspace-service.mjs"],
		["docs/install.md", "README.md"],
		["LICENSE", "LICENSE"],
	];
	for (const [from, to] of assets) {
		await mkdir(dirname(join(target, to)), { recursive: true });
		await cp(join(source, from), join(target, to), {
			recursive: true,
			verbatimSymlinks: true,
		});
	}
}

async function writeDependencyNotices(target) {
	const { stdout } = await run(
		"corepack",
		["pnpm", "licenses", "list", "--prod", "--json"],
		{ cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 },
	);
	const packages = Object.values(JSON.parse(stdout))
		.flat()
		.sort((left, right) => left.name.localeCompare(right.name));
	const sections = [
		"Third-party notices\n\nApplication dependencies retain their respective licenses and copyright notices.",
	];
	for (const dependency of packages) {
		const notices = new Set();
		for (const path of dependency.paths) {
			for (const entry of await readdir(path, { withFileTypes: true })) {
				if (
					entry.isFile() &&
					/^(?:licen[cs]e|notice|copying)(?:[._-]|$)/iu.test(entry.name)
				)
					notices.add((await readFile(join(path, entry.name), "utf8")).trim());
			}
		}
		if (notices.size === 0) {
			const readmePath = join(dependency.paths[0], "README.md");
			const readme = await readFile(readmePath, "utf8");
			const license =
				/^#{1,3} License[^\n]*\n([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/imu.exec(
					readme,
				)?.[1];
			if (
				license !== undefined &&
				license.includes("Permission is hereby granted")
			)
				notices.add(license.trim());
			else if (
				dependency.name === "@openai/codex" &&
				dependency.license === "Apache-2.0"
			)
				notices.add(
					(
						await readFile(join(repoRoot, "licenses/codex-LICENSE.txt"), "utf8")
					).trim(),
				);
			else throw new Error(`Missing license text for ${dependency.name}`);
		}
		sections.push(
			`${dependency.name} ${dependency.versions.join(", ")}\n\n${[...notices].join("\n\n")}`,
		);
	}
	await writeFile(
		join(target, "THIRD_PARTY_NOTICES.txt"),
		`${sections.join("\n\n---\n\n")}\n`,
	);
}

async function main() {
	const { values } = parseArgs({
		options: { output: { type: "string" }, "check-tag": { type: "string" } },
	});
	const { version } = JSON.parse(
		await readFile(join(repoRoot, "package.json"), "utf8"),
	);
	const name = releaseName(version, process.platform, process.arch);
	if (values["check-tag"] !== undefined) {
		if (values["check-tag"] !== `v${version}`)
			throw new Error(`Release tag must be v${version}`);
		return;
	}
	const output = resolve(values.output ?? join(repoRoot, "artifacts/release"));
	await mkdir(join(repoRoot, "artifacts"), { recursive: true });
	const temporary = await mkdtemp(join(repoRoot, "artifacts", ".package-"));
	try {
		const staging = join(temporary, name);
		await mkdir(staging);
		await run(
			"corepack",
			[
				"pnpm",
				"--filter",
				"@commonspace/server",
				"deploy",
				"--prod",
				"--legacy",
				"--config.hoist-workspace-packages=false",
				"--config.prefer-symlinked-executables=true",
				join(staging, "server"),
			],
			{ cwd: repoRoot, maxBuffer: 8 * 1024 * 1024 },
		);
		// pnpm installation metadata contains the builder's private store path.
		await rm(join(staging, "server/node_modules/.modules.yaml"), {
			force: true,
		});
		await rm(join(staging, "server/node_modules/.pnpm/lock.yaml"), {
			force: true,
		});
		await rm(
			join(staging, "server/node_modules/.pnpm-workspace-state-v1.json"),
			{ force: true },
		);
		await copyReleaseAssets(repoRoot, staging);
		await writeDependencyNotices(staging);
		await chmod(join(staging, "commonspace.mjs"), 0o755);
		await chmod(join(staging, "scripts/commonspace-service.mjs"), 0o755);
		const { stdout: revision } = await run("git", ["rev-parse", "HEAD"], {
			cwd: repoRoot,
		});
		const { stdout: status } = await run("git", ["status", "--porcelain"], {
			cwd: repoRoot,
		});
		await writeFile(
			join(staging, "commonspace-release.json"),
			`${JSON.stringify(
				{
					version,
					revision: revision.trim(),
					dirty: status.trim() !== "",
					platform: process.platform,
					arch: process.arch,
					distribution: "archive",
				},
				null,
				2,
			)}\n`,
		);
		const archive = join(temporary, `${name}.tar.gz`);
		await run("tar", ["-czf", archive, "-C", temporary, name], {
			env: { ...process.env, COPYFILE_DISABLE: "1" },
		});
		const digest = createHash("sha256")
			.update(await readFile(archive))
			.digest("hex");
		await mkdir(output, { recursive: true });
		await rename(archive, join(output, basename(archive)));
		await writeFile(
			join(output, `${name}.tar.gz.sha256`),
			`${digest}  ${name}.tar.gz\n`,
		);
		process.stdout.write(`${join(output, `${name}.tar.gz`)}\n`);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

if (
	process.argv[1] !== undefined &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	void main().catch((error) => {
		process.stderr.write(
			`${[error.message, error.stdout, error.stderr].filter(Boolean).join("\n")}\n`,
		);
		process.exitCode = 1;
	});
}
