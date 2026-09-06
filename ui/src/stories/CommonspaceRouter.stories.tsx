import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
	installWorkspaceStoryApi,
	RoutedWorkspace,
} from "./workspace-story-fixtures";

const meta = {
	title: "Shell/Routing",
	component: RoutedWorkspace,
	parameters: { layout: "fullscreen" },
	args: { initialPath: "/" },
	beforeEach: ({ parameters }) =>
		installWorkspaceStoryApi(parameters.bootstrapFailures === 1 ? 1 : 0),
} satisfies Meta<typeof RoutedWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inbox = {
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByRole("main", { name: "Inbox" }),
		).toBeVisible();
	},
} satisfies Story;
export const Sessions: Story = {
	args: { initialPath: "/inbox/sessions" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByRole("button", { name: /^Sessions/u }),
		).toHaveAttribute("aria-pressed", "true");
	},
};
export const ChannelDeepLink: Story = {
	args: { initialPath: "/channels/channel-design" },
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByRole("main", {
				name: "Commonspace conversation",
			}),
		).toBeVisible();
	},
};
export const ThreadReplyDeepLink: Story = {
	args: {
		initialPath:
			"/channels/channel-design/threads/thread-review?message=message-reply",
	},
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByRole("complementary", {
				name: "Thread replies",
			}),
		).toBeVisible();
	},
};
export const ProjectFileDeepLink: Story = {
	args: { initialPath: "/projects/project-commonspace/files/0/README.md" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByRole("main", { name: "Project Commonspace" }),
		).toBeVisible();
		await expect(
			await canvas.findByText("README.md", { selector: "strong" }),
		).toBeVisible();
	},
};
export const UnknownRoute: Story = {
	tags: ["smoke"],
	args: { initialPath: "/a-route-that-does-not-exist" },
	play: Inbox.play,
};
export const MissingProject: Story = {
	args: { initialPath: "/projects/removed-project" },
	play: Inbox.play,
};
export const MissingThread: Story = {
	args: { initialPath: "/channels/channel-design/threads/removed-thread" },
	play: Inbox.play,
};
export const ConnectionRecovery: Story = {
	tags: ["smoke"],
	parameters: { bootstrapFailures: 1 },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"Workspace unavailable",
		);
		await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
		await expect(
			await canvas.findByRole("main", { name: "Inbox" }),
		).toBeVisible();
		await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
	},
};
