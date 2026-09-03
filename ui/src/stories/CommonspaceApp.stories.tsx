import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CommonspaceApp } from "../CommonspaceApp";
import {
	createStoryStore,
	emptyBootstrap,
	storyBootstrap,
} from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceApp",
	component: CommonspaceApp,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof CommonspaceApp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkspaceInbox: Story = {
	args: { store: createStoryStore(storyBootstrap) },
};

export const WorkspaceNavigationFlow: Story = {
	args: { store: createStoryStore(storyBootstrap) },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole("button", { name: /Open Inbox/iu }));
		await expect(canvas.getByRole("main", { name: "Inbox" })).toBeVisible();

		await userEvent.click(
			canvas.getByRole("button", { name: /Open Threads/iu }),
		);
		await expect(canvas.getByRole("main", { name: "Threads" })).toBeVisible();

		await userEvent.click(
			canvas.getByRole("button", { name: "Select project Commonspace" }),
		);
		await expect(
			canvas.getByRole("main", { name: "Project Commonspace" }),
		).toBeVisible();

		await userEvent.click(canvas.getByRole("button", { name: "Workspace" }));
		await expect(canvas.getByRole("main", { name: "Inbox" })).toBeVisible();
	},
};

export const KeyboardSearchFlow: Story = {
	args: { store: createStoryStore(storyBootstrap) },
	play: async ({ canvasElement }) => {
		const document = within(canvasElement.ownerDocument.body);

		await userEvent.keyboard("{Control>}k{/Control}");
		await expect(
			document.getByRole("searchbox", { name: "Search Commonspace" }),
		).toBeVisible();
	},
};

export const EmptyWorkspace: Story = {
	args: { store: createStoryStore(emptyBootstrap) },
};

export const Loading: Story = {
	args: { store: createStoryStore(null, { loading: true }) },
};

export const ErrorBanner: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			error: "Live updates disconnected; retrying…",
		}),
	},
};
