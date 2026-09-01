import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { findStartupUrl } from "./startup-output.mjs";

const repoRoot = process.cwd();
const stateRoot = await mkdtemp(join(tmpdir(), "commonspace-live-"));
const installedStateRoot = await mkdtemp(
	join(tmpdir(), "commonspace-installed-live-"),
);
const server = spawn(
	process.execPath,
	[join(repoRoot, "server/dist/index.js")],
	{
		cwd: repoRoot,
		env: {
			...process.env,
			COMMONSPACE_HOME: stateRoot,
			COMMONSPACE_PORT: "0",
			NODE_ENV: "production",
		},
		stdio: ["ignore", "pipe", "pipe"],
	},
);

let uiServer;
let installedServer;
let browser;

function waitForUrl(child, pattern, label) {
	return new Promise((resolve, reject) => {
		let output = "";
		const timer = setTimeout(() => {
			reject(new Error(`${label} did not start in time\n${output}`));
		}, 15_000);
		const inspect = (chunk) => {
			output += chunk.toString();
			const url = findStartupUrl(output, pattern);
			if (url === undefined) return;
			clearTimeout(timer);
			resolve(url);
		};
		child.stdout.on("data", inspect);
		child.stderr.on("data", inspect);
		child.once("exit", (code) => {
			clearTimeout(timer);
			reject(
				new Error(
					`${label} exited before startup (${String(code)})\n${output}`,
				),
			);
		});
	});
}

async function stopProcess(child) {
	if (
		child === undefined ||
		child.exitCode !== null ||
		child.signalCode !== null
	)
		return;
	const exit = once(child, "exit");
	child.kill("SIGTERM");
	await Promise.race([
		exit,
		new Promise((resolve) => setTimeout(resolve, 5_000)),
	]);
	if (child.exitCode === null && child.signalCode === null) {
		child.kill("SIGKILL");
		await exit;
	}
}

async function mutate(url, mutation) {
	const response = await fetch(`${url}/api/mutate`, {
		method: "POST",
		headers: { origin: url, "content-type": "application/json" },
		body: JSON.stringify(mutation),
	});
	if (!response.ok)
		throw new Error(
			`verification fixture mutation failed with ${String(response.status)}: ${await response.text()}`,
		);
}

try {
	const url = await waitForUrl(
		server,
		/Commonspace is running at (http:\/\/127\.0\.0\.1:\d+)/,
		"Commonspace server",
	);
	const health = await fetch(`${url}/api/health`);
	if (!health.ok)
		throw new Error(`health check failed with ${String(health.status)}`);
	const healthBody = await health.json();
	if (healthBody.status !== "ok")
		throw new Error("health check returned an unexpected body");
	const rootResponse = await fetch(url);
	if (!rootResponse.ok)
		throw new Error(
			`API root health check failed with ${String(rootResponse.status)}`,
		);
	const rootBody = await rootResponse.json();
	if (rootBody.status !== "ok")
		throw new Error("API root health check returned an unexpected body");
	const assetResponse = await fetch(`${url}/index.html`);
	if (assetResponse.status !== 404)
		throw new Error(
			`API server served UI asset with status ${String(assetResponse.status)}`,
		);
	await mutate(url, {
		action: "create-project",
		name: "Verification Project",
		paths: [stateRoot],
	});
	await mutate(url, {
		action: "create-channel",
		name: "verification",
		agentIds: [],
	});

	uiServer = spawn(
		process.execPath,
		[
			join(repoRoot, "ui/node_modules/vite/bin/vite.js"),
			"preview",
			"--host",
			"127.0.0.1",
			"--port",
			"0",
		],
		{
			cwd: join(repoRoot, "ui"),
			env: {
				...process.env,
				COMMONSPACE_API_TARGET: url,
			},
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const uiUrl = await waitForUrl(
		uiServer,
		/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/,
		"Vite preview",
	);

	browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({
		viewport: { width: 1180, height: 820 },
	});
	const pageErrors = [];
	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});
	await page.goto(uiUrl, { waitUntil: "domcontentloaded" });
	await page
		.getByRole("main", { name: "Workspace home" })
		.waitFor({ state: "visible" });
	await page.getByLabel("Commonspace browser").waitFor({ state: "visible" });
	await page.getByLabel("Workspace home").waitFor({ state: "visible" });
	if (pageErrors.length > 0)
		throw new Error(`browser errors: ${pageErrors.join(" | ")}`);

	const verificationChannel = page.getByRole("button", {
		name: "Open channel verification",
	});
	await verificationChannel.waitFor({ state: "visible" });
	await verificationChannel.focus();
	await page.keyboard.press("Enter");
	await page
		.getByLabel("Commonspace conversation")
		.waitFor({ state: "visible" });
	await page.getByLabel("Post in verification").waitFor({ state: "visible" });
	for (const label of [
		"Infer Projects",
		"Use no Projects",
		"Choose Projects",
	]) {
		if ((await page.getByRole("button", { name: label }).count()) !== 0)
			throw new Error(`unexpected Project picker: ${label}`);
	}
	const taggingHelp = await page
		.getByLabel("Tagging help")
		.first()
		.textContent();
	if (!taggingHelp?.includes("@@"))
		throw new Error("explicit @@project tagging help is unavailable");

	await page.emulateMedia({ colorScheme: "light" });
	const lightPalette = await page.evaluate(() =>
		globalThis
			.getComputedStyle(globalThis.document.documentElement)
			.getPropertyValue("--csp-shell-bg")
			.trim(),
	);
	await page.emulateMedia({ colorScheme: "dark" });
	const darkPalette = await page.evaluate(() => ({
		colorScheme: globalThis.getComputedStyle(
			globalThis.document.documentElement,
		).colorScheme,
		shell: globalThis
			.getComputedStyle(globalThis.document.documentElement)
			.getPropertyValue("--csp-shell-bg")
			.trim(),
	}));
	if (
		darkPalette.colorScheme !== "dark" ||
		lightPalette === "" ||
		darkPalette.shell === lightPalette
	) {
		throw new Error("light/dark palette verification failed");
	}
	await page.emulateMedia({ colorScheme: "light" });

	await page.keyboard.press("Control+K");
	await page
		.getByRole("dialog", { name: "Search Commonspace" })
		.waitFor({ state: "visible" });
	await page.keyboard.press("Escape");
	await page
		.getByRole("dialog", { name: "Search Commonspace" })
		.waitFor({ state: "detached" });

	await page.setViewportSize({ width: 390, height: 844 });
	const navigationToggle = page.getByRole("button", {
		name: "Open navigation",
	});
	await navigationToggle.waitFor({ state: "visible" });
	await navigationToggle.focus();
	await page.keyboard.press("Enter");
	await page
		.getByRole("button", { name: "Close navigation" })
		.first()
		.waitFor({ state: "visible" });
	await page.keyboard.press("Escape");
	await page
		.getByRole("button", { name: "Open navigation" })
		.waitFor({ state: "visible" });
	const narrowLayout = await page.evaluate(() => ({
		viewport: globalThis.innerWidth,
		documentWidth: globalThis.document.documentElement.scrollWidth,
		conversationWidth:
			globalThis.document
				.querySelector('[aria-label="Commonspace conversation"]')
				?.getBoundingClientRect().width ?? 0,
	}));
	if (
		narrowLayout.documentWidth > narrowLayout.viewport ||
		narrowLayout.conversationWidth <= 0
	) {
		throw new Error(
			`narrow layout overflowed: ${JSON.stringify(narrowLayout)}`,
		);
	}

	installedServer = spawn(
		process.execPath,
		[join(repoRoot, "server/dist/index.js")],
		{
			cwd: repoRoot,
			env: {
				...process.env,
				COMMONSPACE_HOME: installedStateRoot,
				COMMONSPACE_PORT: "0",
				COMMONSPACE_UI_ROOT: join(repoRoot, "ui/dist"),
				NODE_ENV: "production",
			},
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const installedUrl = await waitForUrl(
		installedServer,
		/Commonspace is running at (http:\/\/127\.0\.0\.1:\d+)/,
		"Installed Commonspace server",
	);
	const installedPage = await browser.newPage({
		viewport: { width: 1180, height: 820 },
	});
	const installedPageErrors = [];
	installedPage.on("pageerror", (error) => {
		installedPageErrors.push(error.message);
	});
	await installedPage.goto(installedUrl, { waitUntil: "domcontentloaded" });
	await installedPage
		.getByRole("main", { name: "Workspace home" })
		.waitFor({ state: "visible" });
	await installedPage
		.getByLabel("Commonspace browser")
		.waitFor({ state: "visible" });
	await installedPage
		.getByLabel("Workspace home")
		.waitFor({ state: "visible" });
	if (installedPageErrors.length > 0)
		throw new Error(
			`installed browser errors: ${installedPageErrors.join(" | ")}`,
		);

	process.stdout.write(
		`${JSON.stringify({
			apiUrl: url,
			uiUrl,
			installedUrl,
			health: healthBody,
			apiServer: true,
			browserMounted: true,
			installedBrowserMounted: true,
			keyboardNavigation: true,
			narrowLayout: true,
			lightDarkPalettes: true,
		})}\n`,
	);
} finally {
	await browser?.close();
	await stopProcess(installedServer);
	await stopProcess(uiServer);
	await stopProcess(server);
	await rm(stateRoot, { recursive: true, force: true });
	await rm(installedStateRoot, { recursive: true, force: true });
}
