import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 720 } });

test("long confirmation details scroll by keyboard while actions remain visible", async ({
	page,
}) => {
	await page.goto(
		"/iframe.html?id=foundations-alertdialog--long-content&viewMode=story",
	);
	const dialog = page.getByRole("alertdialog");
	const cancel = dialog.getByRole("button", { name: "Cancel" });
	await cancel.focus();
	await page.keyboard.press("Shift+Tab");
	const details = dialog.getByRole("region", { name: "Confirmation details" });
	await expect(details).toBeFocused();
	await page.keyboard.press("PageDown");
	await expect
		.poll(() => details.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	await expect(cancel).toBeInViewport();
	await expect(
		dialog.getByRole("button", { name: "Remove channel" }),
	).toBeInViewport();
});

test("long dialog content responds to wheel scrolling", async ({ page }) => {
	await page.goto(
		"/iframe.html?id=foundations-dialog--long-content&viewMode=story",
	);
	const dialog = page.getByRole("dialog", { name: "Shared context" });
	await expect(dialog).toBeVisible();
	await dialog.hover();
	await page.mouse.wheel(0, 1000);
	await expect
		.poll(() => dialog.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	await expect(dialog.getByRole("button", { name: "Done" })).toBeInViewport();
});

test("search scrolls results while input, filters, and footer remain fixed", async ({
	page,
}) => {
	await page.goto(
		"/iframe.html?id=workspace-commonspacesearch--dense-results&viewMode=story",
	);
	const dialog = page.getByRole("dialog", { name: "Search Commonspace" });
	const input = dialog.getByRole("searchbox", { name: "Search Commonspace" });
	const first = dialog
		.getByRole("listbox", { name: "Commonspace search results" })
		.getByRole("option")
		.first();
	await expect(first).toBeVisible();
	const inputTop = await input.evaluate(
		(element) => element.getBoundingClientRect().top,
	);
	await first.hover();
	await page.mouse.wheel(0, 700);
	await expect(first).not.toBeInViewport();
	await expect(input).toBeInViewport();
	await expect(
		dialog.getByRole("region", { name: "Search filters" }),
	).toBeInViewport();
	await expect(dialog.getByText("Navigate", { exact: false })).toBeInViewport();
	expect(
		await input.evaluate((element) => element.getBoundingClientRect().top),
	).toBe(inputTop);
	await dialog
		.getByRole("button", { name: "Filter result types: All types" })
		.click();
	await page.getByRole("menuitemcheckbox", { name: "Messages" }).click();
	await page.keyboard.press("Escape");
	await expect(dialog.getByRole("listbox").getByRole("option")).toHaveCount(8);
});

test("search keyboard selection stays visible without moving its input", async ({
	page,
}) => {
	await page.goto(
		"/iframe.html?id=workspace-commonspacesearch--dense-results&viewMode=story",
	);
	const dialog = page.getByRole("dialog", { name: "Search Commonspace" });
	const input = dialog.getByRole("searchbox", { name: "Search Commonspace" });
	await expect(
		dialog
			.getByRole("listbox", { name: "Commonspace search results" })
			.getByRole("option"),
	).toHaveCount(24);
	await input.focus();
	const inputTop = await input.evaluate(
		(element) => element.getBoundingClientRect().top,
	);
	for (let index = 0; index < 18; index += 1) await input.press("ArrowDown");
	await expect(
		dialog
			.getByRole("listbox", { name: "Commonspace search results" })
			.getByRole("option", { selected: true }),
	).toBeInViewport();
	expect(
		await input.evaluate((element) => element.getBoundingClientRect().top),
	).toBe(inputTop);
});
