import type { Meta, StoryObj } from "@storybook/react-vite";
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
