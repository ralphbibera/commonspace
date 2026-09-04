import { createRequire } from "node:module";
import type {
	CommonspaceDesktopNotification,
	CommonspaceInboxItem,
	CommonspaceNotificationSettings,
} from "@commonspace/shared";

type DesktopNotifier = (
	notification: CommonspaceDesktopNotification,
) => Promise<void>;

interface NotificationCenterInstance {
	notify(
		options: {
			title: string;
			subtitle: string;
			message: string;
			open: string;
			sound: false | string;
			wait?: boolean;
			timeout: number;
		},
		callback: (error: Error | null) => void,
	): void;
}

interface NotificationCenterConstructor {
	new (options: { withFallback: boolean }): NotificationCenterInstance;
}

interface NodeNotifierModule {
	NotificationCenter: NotificationCenterConstructor;
}

const moduleRequire = createRequire(import.meta.url);

function category(
	item: CommonspaceInboxItem,
): CommonspaceDesktopNotification["category"] {
	if (item.kind === "mention") return "mention";
	if (item.kind === "permission-request") return "permission";
	if (item.kind === "failure" || item.kind === "timeout") return "failure";
	return "reply";
}

function categoryEnabled(
	value: CommonspaceDesktopNotification["category"],
	settings: CommonspaceNotificationSettings,
): boolean {
	if (value === "mention") return settings.mentions;
	if (value === "permission") return settings.permissions;
	if (value === "failure") return settings.failures;
	return settings.replies;
}

function title(item: CommonspaceInboxItem): string {
	const location = ` in ${item.conversationName}`;
	if (item.kind === "mention")
		return `${item.actorName} mentioned you${location}`;
	if (item.kind === "permission-request")
		return `${item.actorName} needs permission${location}`;
	if (item.kind === "failure") return `${item.actorName} failed${location}`;
	if (item.kind === "timeout") return `${item.actorName} timed out${location}`;
	if (item.kind === "input-request")
		return `${item.actorName} needs input${location}`;
	return `${item.actorName} replied${location}`;
}

export function desktopNotificationForItem(
	item: CommonspaceInboxItem,
	settings: CommonspaceNotificationSettings,
	clientUrl: string,
): CommonspaceDesktopNotification | null {
	const notificationCategory = category(item);
	if (
		!settings.enabled ||
		item.muted ||
		!categoryEnabled(notificationCategory, settings)
	)
		return null;
	const url = new URL("/", clientUrl);
	url.searchParams.set("conversation", item.conversation.kind);
	url.searchParams.set("conversationId", item.conversation.id);
	if (item.threadId !== undefined)
		url.searchParams.set("threadId", item.threadId);
	url.searchParams.set("messageId", item.messageId);
	return {
		category: notificationCategory,
		title: title(item).slice(0, 180),
		body: item.text.slice(0, 240),
		url: url.toString(),
		sound: settings.sound,
	};
}

export function createDesktopNotifier(): DesktopNotifier {
	let center: NotificationCenterInstance | undefined;
	return async (notification) => {
		if (center === undefined) {
			const loaded: NodeNotifierModule = moduleRequire("node-notifier");
			center = new loaded.NotificationCenter({ withFallback: true });
		}
		await new Promise<void>((resolve, reject) => {
			center?.notify(
				{
					title: notification.title,
					subtitle: "Commonspace",
					message: notification.body,
					open: notification.url,
					sound: notification.sound ? "Glass" : false,
					timeout: 10,
				},
				(error) => {
					if (error === null || error === undefined) resolve();
					else reject(error);
				},
			);
		});
	};
}
