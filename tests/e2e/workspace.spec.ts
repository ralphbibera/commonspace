import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { z } from "zod";

const VERIFICATION_PROJECT = "Select project Verification Project";
const VERIFICATION_CHANNEL = "Open channel verification";
const GENERAL_CHANNEL = "Open channel general";
const VERIFICATION_MESSAGE_SNIPPET =
	"Review the workspace hierarchy and report a concise checkpoint.";
const desktopNotificationSchema = z.object({
	title: z.string(),
	body: z.string(),
	url: z.string(),
});
const bootstrapSchema = z.object({
	state: z.object({
		channels: z.array(z.object({ id: z.string(), name: z.string() })),
		inboxReadMessageIds: z.array(z.string()),
	}),
});

async function readCapturedNotification(capturePath: string) {
	return desktopNotificationSchema.parse(
		JSON.parse(await readFile(capturePath, "utf8")),
	);
}

function verificationPosts(page: Page) {
	return page.getByRole("region", { name: "verification posts" });
}

function postRowByText(page: Page, text: string): Locator {
	return verificationPosts(page)
		.locator("article")
		.filter({ hasText: text })
		.first();
}

async function openVerificationProject(page: Page): Promise<void> {
	await page.goto("/");
	await page.getByRole("button", { name: VERIFICATION_PROJECT }).click();
}

async function openVerificationChannel(page: Page): Promise<void> {
	await openVerificationProject(page);
	await page.getByRole("button", { name: VERIFICATION_CHANNEL }).click();
	await expect(verificationPosts(page)).toBeVisible();
}

async function postVerificationMessage(
	page: Page,
	text: string,
): Promise<Locator> {
	await openVerificationChannel(page);
	const composer = page.getByLabel("Post in verification");
	await composer.fill(text);
	await page.getByRole("button", { name: "Post message" }).click();
	const messageRow = postRowByText(page, text);
	await expect(messageRow).toBeVisible();
	await expect(composer).toHaveValue("");
	return messageRow;
}

async function openRootVerificationThread(page: Page): Promise<void> {
	const replyButton = verificationPosts(page).getByRole("button", {
		name: /\d+ replies?/i,
	});
	await expect(replyButton).toBeVisible();
	await replyButton.first().click();

	await expect(page.getByLabel("Thread replies")).toBeVisible();
}

test("boots with the seeded projects, channels, agents, and messages", async ({
	page,
}) => {
	await page.goto("/");

	await expect(
		page.getByRole("button", { name: VERIFICATION_PROJECT }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Select project Reference Notes" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: VERIFICATION_CHANNEL }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Message agent Review Bot" }),
	).toBeVisible();

	await openVerificationChannel(page);
	await expect(
		verificationPosts(page).getByText(VERIFICATION_MESSAGE_SNIPPET, {
			exact: false,
		}),
	).toBeVisible();
	await expect(page.getByLabel("Post in verification")).toBeVisible();
});

test("opens project settings and closes it", async ({ page }) => {
	await openVerificationProject(page);
	const projectSettingsButton = page.getByRole("button", {
		name: "Open project settings",
	});
	await expect(projectSettingsButton).toBeVisible();
	await projectSettingsButton.click();
	const projectSettings = page.getByRole("complementary", {
		name: "Project settings",
	});
	await expect(projectSettings).toBeVisible();
	await projectSettings
		.getByRole("button", { name: "Close project settings" })
		.click();
	await expect(projectSettings).toBeHidden();
});

test("opens channel settings and closes it", async ({ page }) => {
	await openVerificationChannel(page);
	await page.getByRole("button", { name: "Open channel settings" }).click();
	const channelSettings = page.getByRole("complementary", {
		name: "Channel settings",
	});
	await expect(channelSettings).toBeVisible();
	await channelSettings
		.getByRole("button", { name: "Close channel settings" })
		.click();
	await expect(channelSettings).toBeHidden();
});

test("sends a channel message and keeps composer state correct", async ({
	page,
}) => {
	const messageText = `E2E channel post: ${Math.floor(
		Math.random() * 1_000_000,
	)}.`;
	await postVerificationMessage(page, messageText);
});

test("refreshes the Inbox, captures native delivery, and opens the exact notification target", async ({
	page,
}) => {
	const e2ePort = process.env.COMMONSPACE_E2E_PORT ?? "3199";
	const capturePath =
		process.env.COMMONSPACE_E2E_NOTIFICATION_CAPTURE ??
		join(tmpdir(), `commonspace-e2e-notification-${e2ePort}.json`);
	await page.goto("/");
	await page.getByRole("button", { name: "Commonspace settings" }).click();
	const settings = page.getByRole("form", { name: "Workspace settings" });
	const masterSwitch = settings.getByRole("switch", {
		name: "Allow native notifications",
	});
	if ((await masterSwitch.getAttribute("aria-checked")) !== "true")
		await masterSwitch.click();
	await settings
		.getByRole("button", { name: "Save notification settings" })
		.click();
	await expect(settings.getByRole("status")).toContainText(
		"Notification settings saved.",
	);
	await settings
		.getByRole("button", { name: "Send test notification" })
		.click();
	await expect(settings.getByRole("status")).toContainText(
		"Test notification delivered.",
	);
	await expect
		.poll(async () => {
			try {
				const notification = await readCapturedNotification(capturePath);
				return notification.title;
			} catch {
				return null;
			}
		})
		.toBe("Commonspace notifications are working");
	await settings
		.getByRole("button", { name: "Close settings" })
		.first()
		.click();

	await page.getByRole("button", { name: /Open Inbox/iu }).click();
	await page.getByRole("button", { name: /Activity/iu }).click();
	const bootstrap = await page.request
		.get("/api/bootstrap", { headers: { origin: page.url() } })
		.then(async (response) => bootstrapSchema.parse(await response.json()));
	const channel = bootstrap.state.channels.find(
		(candidate) => candidate.name === "verification",
	);
	if (channel === undefined)
		throw new Error("verification channel fixture missing");
	const responseText = "Review Bot completed the seeded workspace checkpoint.";
	const previousReplies = await page
		.getByText(responseText, { exact: true })
		.count();

	const send = await page.request.post("/api/send", {
		headers: { origin: page.url() },
		data: {
			conversation: { kind: "channel", id: channel.id },
			text: "@review-bot Verify the complete notification path.",
		},
	});
	expect(send.ok()).toBe(true);
	await expect(page.getByText(responseText, { exact: true })).toHaveCount(
		previousReplies + 1,
	);

	await expect
		.poll(async () => {
			try {
				const notification = await readCapturedNotification(capturePath);
				return notification.body;
			} catch {
				return null;
			}
		})
		.toBe(responseText);
	const notification = await readCapturedNotification(capturePath);
	const target = new URL(notification.url);
	const messageId = target.searchParams.get("messageId");
	if (messageId === null)
		throw new Error("notification message target missing");

	await page.goto(notification.url);
	const targetMessage = page.locator(`[id="commonspace-message-${messageId}"]`);
	await expect(targetMessage).toBeVisible();
	await expect(targetMessage).toHaveAttribute("aria-current", "true");
	await expect
		.poll(async () => {
			const current = await page.request
				.get("/api/bootstrap", { headers: { origin: page.url() } })
				.then(async (response) => bootstrapSchema.parse(await response.json()));
			return current.state.inboxReadMessageIds.includes(messageId);
		})
		.toBe(true);
});

test("opens a seeded thread, replies, and uses thread context", async ({
	page,
}) => {
	const threadReply = `E2E thread reply: ${Math.floor(
		Math.random() * 1_000_000,
	)}.`;

	await openVerificationChannel(page);
	await openRootVerificationThread(page);

	const threadPanel = page.getByLabel("Thread replies");
	const threadComposer = threadPanel.getByLabel("Reply in thread");
	await threadComposer.fill(threadReply);
	await threadPanel
		.locator("form")
		.getByRole("button", { name: "Reply" })
		.click();
	await expect(threadPanel.getByText(threadReply)).toBeVisible();

	await threadPanel
		.getByRole("button", { name: "Open thread context" })
		.click();
	const threadContext = page.getByRole("region", {
		name: "Thread context",
	});
	await expect(threadContext).toBeVisible();
	await expect(threadContext.getByText("Current Thread context")).toBeVisible();
	await threadPanel
		.getByRole("button", { name: "Open thread context" })
		.click();
	await expect(threadContext).toBeHidden();

	await threadPanel.getByRole("button", { name: "Close thread" }).click();
	await expect(threadPanel).toBeHidden();
});

test("edits a user message and creates an edited branch", async ({ page }) => {
	const original = `E2E editable message: ${Math.floor(
		Math.random() * 1_000_000,
	)}.`;
	const edited = `${original} edited`;
	const messageRow = await postVerificationMessage(page, original);

	await messageRow.hover();
	await messageRow.getByRole("button", { name: /^Edit message from / }).click();

	const editForm = messageRow.getByLabel("Edit delivered message");
	await expect(editForm).toBeVisible();
	await editForm.getByLabel("Edited message").fill(edited);
	const editRequest = page.waitForResponse((response) => {
		return (
			response.url().includes("/api/messages/") &&
			response.url().includes("/edit") &&
			response.request().method() === "POST" &&
			response.status() === 202
		);
	});
	await editForm.getByRole("button", { name: "Create branch" }).click();
	const response = await editRequest;
	expect(response.status()).toBe(202);
	await expect(editForm).toBeHidden();
	await expect(messageRow).toBeVisible();
});

test("opens the message action menu and closes it", async ({ page }) => {
	const toSave = `E2E saved message: ${Math.floor(Math.random() * 1_000_000)}.`;
	const messageRow = await postVerificationMessage(page, toSave);

	await messageRow.hover();
	const actionMenu = messageRow.getByRole("button", {
		name: /^More actions for message from /,
	});
	await actionMenu.click();
	await expect(
		page.getByRole("menuitem", { name: "Save for later" }),
	).toBeVisible();
	await actionMenu.click();
	await page.keyboard.press("Escape");
	await expect(
		page.getByRole("menuitem", { name: "Save for later" }),
	).toBeHidden();
	await expect(messageRow).toBeVisible();
});

test("copies a message link from action menu", async ({ page }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
		origin: "http://127.0.0.1:3199",
	});

	const toCopy = `E2E copy link message: ${Math.floor(
		Math.random() * 1_000_000,
	)}.`;
	const messageRow = await postVerificationMessage(page, toCopy);

	await messageRow.hover();
	const actionMenu = messageRow.getByRole("button", {
		name: /^More actions for message from /,
	});
	await actionMenu.click();
	await page.getByRole("menuitem", { name: "Copy link" }).click();

	const copiedText = await page.evaluate(() => navigator.clipboard.readText());
	expect(typeof copiedText).toBe("string");
	const copiedUrl = new URL(copiedText);
	expect(copiedUrl.origin).toBe("http://127.0.0.1:3199");
	expect(copiedUrl.searchParams.get("conversation")).toBe("channel");
	expect(copiedUrl.searchParams.get("conversationId")).toBeTruthy();
	expect(copiedUrl.searchParams.get("messageId")).toBeTruthy();
	expect(copiedUrl.searchParams.get("threadId")).toBeTruthy();
});

test("opens thread from the message action menu", async ({ page }) => {
	await openVerificationChannel(page);
	await openRootVerificationThread(page);

	const messageRoot = verificationPosts(page).locator("article").first();
	await messageRoot.hover();
	await messageRoot
		.getByRole("button", { name: /^More actions for message from / })
		.click();
	await page.getByRole("menuitem", { name: "Reply in thread" }).click();

	await expect(page.getByLabel("Thread replies")).toBeVisible();
});

test("deletes a user message and preserves the deleted tombstone", async ({
	page,
}) => {
	const toDelete = `E2E delete message: ${Math.floor(
		Math.random() * 1_000_000,
	)}.`;
	const messageRow = await postVerificationMessage(page, toDelete);

	await messageRow.hover();
	await page.once("dialog", (dialog) => dialog.accept());
	await messageRow
		.getByRole("button", { name: /^Delete message from / })
		.click();
	await expect(messageRow).toBeHidden();
	await expect(
		verificationPosts(page).getByText("Message deleted"),
	).toBeVisible();
});

test("switches between channels with focused composer target", async ({
	page,
}) => {
	await openVerificationChannel(page);
	await page.getByRole("button", { name: GENERAL_CHANNEL }).click();

	await expect(page.getByLabel("Post in general")).toBeVisible();
	await expect(page.getByLabel("Thread replies")).toBeHidden();
});
