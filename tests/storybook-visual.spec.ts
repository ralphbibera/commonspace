import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

type StoryReady = (page: Page) => Promise<void>;

interface StorybookIndexEntry {
	id: string;
	type: string;
}

const stories: Array<{ id: string; name: string; ready?: StoryReady }> = [
	{
		id: "design-system-agentavatar--size-and-status-matrix",
		name: "agent-avatar-status-and-sizes",
	},
	{
		id: "design-system-collectionactionmenu--rest",
		name: "collection-action-menu-rest",
	},
	{
		id: "design-system-collectionactionmenu--long-metadata",
		name: "collection-action-menu-long-metadata",
	},
	{
		id: "design-system-collectionactionmenu--open-menu",
		name: "collection-action-menu-open",
		ready: async (page) => {
			await expect(page.getByRole("menu")).toBeVisible();
		},
	},
	{
		id: "design-system-messageactionmenu--rest",
		name: "message-action-menu-rest",
	},
	{
		id: "design-system-messageactionmenu--open-menu",
		name: "message-action-menu-open",
		ready: async (page) => {
			await expect(page.getByRole("menu")).toBeVisible();
		},
	},
	{
		id: "design-system-messageactionmenu--attachment-only",
		name: "message-action-menu-attachment-only",
	},
	{
		id: "design-system-workspaceheader--default",
		name: "workspace-header-default",
	},
	{
		id: "design-system-workspaceheader--with-visible-close-action",
		name: "workspace-header-with-close-action",
	},
	{
		id: "design-system-workspaceheader--long-title",
		name: "workspace-header-long-title",
	},
	{
		id: "workspace-commonspacesearch--browse",
		name: "commonspace-search-browse",
		ready: async (page) => {
			await expect(
				page.getByRole("dialog", { name: "Search Commonspace" }),
			).toBeVisible();
			await expect(
				page.getByRole("listbox", { name: "Commonspace search results" }),
			).toBeVisible();
		},
	},
	{
		id: "workspace-commonspacesearch--query-and-keyboard-selection",
		name: "commonspace-search-query-and-keyboard-selection",
		ready: async (page) => {
			await expect(
				page.getByRole("option", {
					name: /Open Message: Review the visual baseline/iu,
				}),
			).toHaveAttribute("aria-selected", "true");
		},
	},
];

test("every Storybook story renders without an error boundary", async ({
	page,
	request,
}) => {
	const response = await request.get("/index.json");
	await expect(response).toBeOK();
	const payload: unknown = await response.json();
	if (
		typeof payload !== "object" ||
		payload === null ||
		Array.isArray(payload) ||
		!("entries" in payload) ||
		typeof payload.entries !== "object" ||
		payload.entries === null ||
		Array.isArray(payload.entries)
	)
		throw new Error("Storybook index did not contain an entries object");
	const candidates: unknown[] = Object.values(payload.entries);
	const storyEntries: StorybookIndexEntry[] = [];
	for (const candidate of candidates) {
		if (
			typeof candidate !== "object" ||
			candidate === null ||
			Array.isArray(candidate) ||
			!("id" in candidate) ||
			typeof candidate.id !== "string" ||
			!("type" in candidate) ||
			typeof candidate.type !== "string"
		)
			throw new Error("Storybook index contained an invalid entry");
		if (candidate.type === "story")
			storyEntries.push({ id: candidate.id, type: candidate.type });
	}
	for (const entry of storyEntries) {
		await page.goto(`/iframe.html?id=${entry.id}&viewMode=story`, {
			waitUntil: "domcontentloaded",
		});
		await expect(page.locator("#storybook-root")).toBeAttached();
		await page.waitForTimeout(150);
		const errorBoundary = page.getByText(
			"The component failed to render properly",
			{ exact: false },
		);
		for (let index = 0; index < (await errorBoundary.count()); index += 1) {
			await expect(errorBoundary.nth(index)).not.toBeVisible();
		}
	}
});

for (const story of stories) {
	test(`${story.name} matches the reviewed Storybook baseline`, async ({
		page,
	}) => {
		await page.goto(`/iframe.html?id=${story.id}&viewMode=story`, {
			waitUntil: "domcontentloaded",
		});
		if (story.id.startsWith("workspace-commonspacesearch--")) {
			await expect(
				page.getByRole("dialog", { name: "Search Commonspace" }),
			).toBeVisible();
		} else {
			await expect(page.locator("#storybook-root")).toBeVisible();
		}
		if (story.ready !== undefined) await story.ready(page);
		await expect(page).toHaveScreenshot(`${story.name}.png`, {
			fullPage: true,
		});
	});
}
