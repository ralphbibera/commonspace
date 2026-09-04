import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommonspaceSidebar } from "../CommonspaceSidebar";
import {
	createStoryBootstrap,
	createStoryStore,
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

export const Expanded: Story = {};

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
