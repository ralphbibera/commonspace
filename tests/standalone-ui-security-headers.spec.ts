import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	type RunningCommonspaceServer,
	startCommonspaceServer,
} from "../server/src/index.ts";

const roots: string[] = [];
const servers: RunningCommonspaceServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("standalone UI security headers", () => {
	it.each(["/", "/project/deep-link"])(
		"prevents framing the UI response for %s",
		async (path) => {
			const root = await mkdtemp(join(tmpdir(), "commonspace-ui-headers-"));
			roots.push(root);
			const workspace = join(root, "workspace");
			const uiRoot = join(root, "ui");
			await Promise.all([mkdir(workspace), mkdir(uiRoot)]);
			await writeFile(
				join(uiRoot, "index.html"),
				'<!doctype html><main id="root">Installed Commonspace</main>',
			);

			const running = await startCommonspaceServer({
				root: join(root, "state"),
				defaultCwd: workspace,
				uiRoot,
				port: 0,
				logger: { warn: () => undefined, info: () => undefined },
			});
			servers.push(running);

			const response = await fetch(`${running.url}${path}`);
			expect(response.status).toBe(200);
			expect(response.headers.get("content-security-policy")).toBe(
				"frame-ancestors 'none'",
			);
			expect(response.headers.get("x-frame-options")).toBe("DENY");
			expect(await response.text()).toContain("Installed Commonspace");
		},
	);
});
