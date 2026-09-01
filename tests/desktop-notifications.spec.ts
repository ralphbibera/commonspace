import type {
	CommonspaceInboxItem,
	CommonspaceNotificationSettings,
} from "@commonspace/shared";
import { describe, expect, it } from "vitest";
import { desktopNotificationForItem } from "../server/src/desktop-notifications.ts";
import { mustExist } from "./test-helpers.ts";

const settings: CommonspaceNotificationSettings = {
	enabled: true,
	replies: true,
	mentions: true,
	permissions: true,
	failures: true,
	sound: false,
};

function item(
	overrides: Partial<CommonspaceInboxItem> = {},
): CommonspaceInboxItem {
	return {
		id: "message:reply-1",
		messageId: "reply-1",
		sessionId: "root-1:codex",
		kind: "completion",
		actorId: "codex",
		actorName: "Codex",
		conversation: { kind: "channel", id: "general" },
		conversationName: "#general",
		threadId: "thread-1",
		createdAt: "2026-08-31T12:00:00.000Z",
		text: "Implementation is ready.",
		unread: true,
		saved: false,
		muted: false,
		...overrides,
	};
}

describe("desktop notifications", () => {
	it("builds a click-through notification for an exact durable Inbox item", () => {
		const notification = desktopNotificationForItem(
			item(),
			settings,
			"http://127.0.0.1:3100",
		);

		expect(notification).toMatchObject({
			category: "reply",
			title: "Codex replied in #general",
			body: "Implementation is ready.",
			sound: false,
		});
		const url = new URL(mustExist(notification).url);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			conversation: "channel",
			conversationId: "general",
			threadId: "thread-1",
			messageId: "reply-1",
		});
	});

	it("maps event categories to independent preferences without changing Inbox items", () => {
		expect(
			desktopNotificationForItem(
				item({ kind: "mention" }),
				{ ...settings, mentions: false },
				"http://127.0.0.1:3100",
			),
		).toBeNull();
		expect(
			desktopNotificationForItem(
				item({ id: "permission:p1", kind: "permission-request" }),
				{ ...settings, permissions: false },
				"http://127.0.0.1:3100",
			),
		).toBeNull();
		expect(
			desktopNotificationForItem(
				item({ kind: "failure" }),
				{ ...settings, failures: false },
				"http://127.0.0.1:3100",
			),
		).toBeNull();
		expect(
			desktopNotificationForItem(
				item(),
				{ ...settings, enabled: false },
				"http://127.0.0.1:3100",
			),
		).toBeNull();
		expect(
			desktopNotificationForItem(
				item({ muted: true }),
				settings,
				"http://127.0.0.1:3100",
			),
		).toBeNull();
	});
});
