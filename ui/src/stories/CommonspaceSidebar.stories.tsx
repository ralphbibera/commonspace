import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { CommonspaceSidebar } from "../CommonspaceSidebar";
import { sidebarPreferencesStore } from "../sidebar-preferences";
import {
	buildChannel,
	createStoryBootstrap,
	createStoryStore,
	designChannel,
	storyBootstrap,
} from "./story-fixtures";

const apiRoutingBootstrap = createStoryBootstrap({
	routing: {
		provider: "openai-compatible",
		model: "gpt-5.6-sol",
		harnessAgentId: "",
		baseUrl: "https://api.openai.com/v1",
		apiKeyConfigured: true,
	},
});

const meta = {
	title: "Pages/CommonspaceSidebar",
	component: CommonspaceSidebar,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
	args: {
		wide: true,
		expandSidebar: fn(),
		store: createStoryStore(storyBootstrap),
		colorMode: "light",
		onSetColorMode: fn(),
		inboxActive: true,
		onOpenSearch: fn(),
		onOpenInbox: fn(),
		onOpenThreads: fn(),
		onOpenDirectory: fn(),
		onOpenContextSettings: fn(),
		onMentionAgent: fn(),
		onOpenAgentSessions: fn(),
		onOpenProject: fn(),
		onOpenConversation: fn(),
	},
} satisfies Meta<typeof CommonspaceSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const sortingChannels = [
	{
		...designChannel,
		createdAt: "2026-09-04T10:00:00.000Z",
	},
	{
		...buildChannel,
		createdAt: "2026-09-01T10:00:00.000Z",
	},
	{
		...designChannel,
		id: "channel-announcements",
		name: "announcements",
		createdAt: "2026-09-02T10:00:00.000Z",
	},
	{
		...buildChannel,
		id: "channel-triage",
		name: "triage",
		createdAt: "2026-09-03T10:00:00.000Z",
	},
];

const channelSortingBootstrap = createStoryBootstrap({
	state: {
		...storyBootstrap.state,
		channels: sortingChannels,
		messages: {
			...storyBootstrap.state.messages,
			[`channel:${designChannel.id}`]: [],
			[`channel:${buildChannel.id}`]: [],
			"channel:channel-announcements": [],
			"channel:channel-triage": [],
		},
	},
});

function channelNames(canvasElement: HTMLElement): string[] {
	return within(canvasElement)
		.getAllByRole("button", { name: /^Open channel /u })
		.map((button) =>
			(button.getAttribute("aria-label") ?? "")
				.replace(/^Open channel /u, "")
				.replace(/, \d+ unread$/u, ""),
		);
}

function clearStoryFocus(canvasElement: HTMLElement) {
	const activeElement = canvasElement.ownerDocument.activeElement;
	if (activeElement instanceof HTMLElement) activeElement.blur();
}

async function prepareChannelSorting(canvasElement: HTMLElement) {
	const canvas = within(canvasElement);
	const page = within(canvasElement.ownerDocument.body);
	await userEvent.selectOptions(
		canvas.getByLabelText("Sort channels"),
		"recent",
	);
	sidebarPreferencesStore.setChannelCustomOrder([]);
	await userEvent.click(
		canvas.getByRole("button", { name: "More actions for builds" }),
	);
	const pinAction = page.queryByText("Pin to sidebar");
	if (pinAction !== null) await userEvent.click(pinAction);
	else await userEvent.keyboard("{Escape}");
	await waitFor(() => {
		expect(page.queryByRole("menu")).not.toBeInTheDocument();
	});
}

export const Expanded: Story = {};

export const ChannelsByRecentActivity: Story = {
	args: {
		...meta.args,
		store: createStoryStore(channelSortingBootstrap),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await prepareChannelSorting(canvasElement);
		await expect(canvas.getByLabelText("Sort channels")).toHaveValue("recent");
		await expect(channelNames(canvasElement)).toEqual([
			"design-review",
			"builds",
			"triage",
			"announcements",
		]);
		clearStoryFocus(canvasElement);
	},
};

export const ChannelsAlphabetically: Story = {
	args: {
		...meta.args,
		store: createStoryStore(channelSortingBootstrap),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await prepareChannelSorting(canvasElement);
		await userEvent.selectOptions(
			canvas.getByLabelText("Sort channels"),
			"alphabetical",
		);
		await expect(canvas.getByLabelText("Sort channels")).toHaveValue(
			"alphabetical",
		);
		await expect(channelNames(canvasElement)).toEqual([
			"builds",
			"design-review",
			"announcements",
			"triage",
		]);
		clearStoryFocus(canvasElement);
	},
};

export const ChannelsInCustomOrder: Story = {
	args: {
		...meta.args,
		store: createStoryStore(channelSortingBootstrap),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await prepareChannelSorting(canvasElement);
		await userEvent.selectOptions(
			canvas.getByLabelText("Sort channels"),
			"custom",
		);
		await expect(canvas.getByLabelText("Sort channels")).toHaveValue("custom");
		const design = canvas.getByRole("button", {
			name: "Open channel design-review",
		});
		await userEvent.click(design);
		await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
		await expect(channelNames(canvasElement)).toEqual([
			"builds",
			"design-review",
			"triage",
			"announcements",
		]);
		await expect(design).toHaveFocus();
		await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
		await expect(channelNames(canvasElement)).toEqual([
			"builds",
			"design-review",
			"triage",
			"announcements",
		]);
		const triage = canvas.getByRole("button", { name: "Open channel triage" });
		await userEvent.click(triage);
		await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
		await expect(channelNames(canvasElement)).toEqual([
			"builds",
			"design-review",
			"triage",
			"announcements",
		]);
		await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
		await expect(channelNames(canvasElement)).toEqual([
			"builds",
			"design-review",
			"announcements",
			"triage",
		]);
		await expect(triage).toHaveFocus();
		await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
		await expect(channelNames(canvasElement)).toEqual([
			"builds",
			"design-review",
			"triage",
			"announcements",
		]);
		await expect(triage).toHaveFocus();
		clearStoryFocus(canvasElement);
	},
};

export const ChannelsRestoreCustomOrder: Story = {
	args: {
		...meta.args,
		store: createStoryStore(channelSortingBootstrap),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await prepareChannelSorting(canvasElement);
		await userEvent.selectOptions(
			canvas.getByLabelText("Sort channels"),
			"custom",
		);
		await expect(channelNames(canvasElement)).toEqual([
			"design-review",
			"builds",
			"triage",
			"announcements",
		]);
		await userEvent.click(
			canvas.getByRole("button", { name: "Open channel design-review" }),
		);
		await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
		await userEvent.selectOptions(
			canvas.getByLabelText("Sort channels"),
			"recent",
		);
		sidebarPreferencesStore.reload();
		await userEvent.selectOptions(
			canvas.getByLabelText("Sort channels"),
			"custom",
		);
		await expect(channelNames(canvasElement)).toEqual([
			"builds",
			"design-review",
			"triage",
			"announcements",
		]);
		clearStoryFocus(canvasElement);
	},
};

export const Collapsed: Story = {
	args: { wide: false },
};

export const ThreadsActive: Story = {
	args: {
		inboxActive: false,
		threadsActive: true,
	},
};

export const DirectoryActive: Story = {
	args: {
		inboxActive: false,
		directoryActive: true,
	},
};

export const WorkspaceSettings: Story = {
	args: {
		store: createStoryStore(storyBootstrap),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Commonspace settings" }),
		);

		await expect(
			within(document.body).getByRole("form", { name: "Workspace settings" }),
		).toBeVisible();
	},
};

export const WorkspaceSettingsChannelTransition: Story = {
	args: {
		store: createStoryStore(storyBootstrap),
		onOpenConversation: fn(),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Commonspace settings" }),
		);
		const settings = within(document.body).getByRole("form", {
			name: "Workspace settings",
		});
		await expect(settings).toBeVisible();

		await userEvent.click(
			canvas.getByRole("button", { name: /^Open channel design-review/ }),
		);

		await expect(args.onOpenConversation).toHaveBeenCalledOnce();
		await expect(settings).not.toBeInTheDocument();
	},
};

export const WorkspaceSettingsApiInference: Story = {
	args: {
		store: createStoryStore(apiRoutingBootstrap),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Commonspace settings" }),
		);

		const page = within(document.body);
		const connectionHeading = page.getByRole("heading", { name: "Connection" });
		connectionHeading.scrollIntoView({ block: "start" });

		await expect(page.getByLabelText("Routing model")).toHaveValue(
			"gpt-5.6-sol",
		);
		const clearApiKey = page.getByRole("checkbox", {
			name: "Clear routing API key",
		});
		await expect(clearApiKey).not.toBeChecked();
		await userEvent.click(clearApiKey);
		await expect(clearApiKey).toBeChecked();
	},
};

export const WorkspaceSettingsNotifications: Story = {
	args: {
		store: createStoryStore(storyBootstrap),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Commonspace settings" }),
		);

		const page = within(document.body);
		const notificationsHeading = page.getByRole("heading", {
			name: "OS notifications",
		});
		notificationsHeading.scrollIntoView({ block: "start" });

		const masterSwitch = page.getByRole("switch", {
			name: "Allow native notifications",
		});
		const soundSwitch = page.getByRole("switch", {
			name: "Notification sound",
		});
		await expect(masterSwitch).not.toBeChecked();
		await expect(soundSwitch).toBeDisabled();

		await userEvent.click(masterSwitch);
		await expect(masterSwitch).toBeChecked();
		await expect(soundSwitch).toBeEnabled();
		await userEvent.click(soundSwitch);
		await expect(soundSwitch).toBeChecked();

		await userEvent.click(
			page.getByRole("button", { name: "Save notification settings" }),
		);
		await expect(page.getByRole("status")).toHaveTextContent(
			"Notification settings saved.",
		);
		await userEvent.click(
			page.getByRole("button", { name: "Send test notification" }),
		);
		await expect(
			page.getByText(
				"Test notification delivered. Click it to verify Commonspace opens.",
			),
		).toBeVisible();
	},
};

export const WorkspaceSettingsNotificationFallback: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			notificationVerification: {
				status: "failed",
				message:
					"Native alert delivery failed. Inbox notifications remain available; check System Settings > Notifications for Commonspace.",
			},
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Commonspace settings" }),
		);
		const page = within(document.body);
		await userEvent.click(
			page.getByRole("button", { name: "Send test notification" }),
		);
		await expect(
			page.getByText(/Inbox notifications remain available/iu),
		).toBeVisible();
	},
};

export const WorkspaceSettingsOperations: Story = {
	args: {
		store: createStoryStore(storyBootstrap),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Commonspace settings" }),
		);

		const page = within(document.body);
		const diagnostics = page.getByRole("region", {
			name: "Runtime diagnostics",
		});
		diagnostics.scrollIntoView({ block: "start" });

		await expect(diagnostics).toBeVisible();
		await expect(
			page.getByRole("region", { name: "Workspace data management" }),
		).toBeVisible();
		await expect(
			page.getByRole("region", { name: "Conversation retention" }),
		).toBeVisible();
	},
};

export const CreateChannelRequest: Story = {
	args: {
		createRequest: { kind: "channel", token: 1 },
	},
};
