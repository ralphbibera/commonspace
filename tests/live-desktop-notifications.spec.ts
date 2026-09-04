// @vitest-environment node
import type { CommonspaceDesktopNotification } from "@commonspace/shared";
import { describe, expect, it } from "vitest";
import { createDesktopNotifier } from "../server/src/desktop-notifications.ts";

const liveNotificationsEnabled =
	process.platform === "darwin" &&
	process.env.COMMONSPACE_LIVE_NOTIFICATIONS === "1";

const describeLiveNotifications = liveNotificationsEnabled
	? describe
	: describe.skip;

describeLiveNotifications("live macOS desktop notifications", () => {
	it("hands a real test alert to macOS Notification Center", async () => {
		const notification: CommonspaceDesktopNotification = {
			category: "reply",
			title: "Commonspace notification verification",
			body: "The real macOS notification boundary accepted this test alert.",
			url: "http://127.0.0.1:3100/",
			sound: false,
		};

		await expect(createDesktopNotifier()(notification)).resolves.toBeUndefined();
	});
});
