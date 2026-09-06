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
