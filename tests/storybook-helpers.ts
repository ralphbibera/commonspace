import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

interface StoryTarget {
	id: string;
	title: string;
	name: string;
}

export async function openStory(
	page: Page,
	target: StoryTarget,
): Promise<void> {
	const response = await page.request.get("/index.json");
	await expect(response).toBeOK();
	const index: unknown = await response.json();
	expect(index).toMatchObject({
		entries: {
			[target.id]: {
				id: target.id,
				type: "story",
				title: target.title,
				name: target.name,
			},
		},
	});
	await page.goto(`/iframe.html?id=${target.id}&viewMode=story`, {
		waitUntil: "domcontentloaded",
	});
}
