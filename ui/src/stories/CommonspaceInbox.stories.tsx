import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceInbox } from "../CommonspaceInbox";
import {
	createStoryStore,
	emptyBootstrap,
	storyBootstrap,
} from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceInbox",
	component: CommonspaceInbox,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
	args: {
		store: createStoryStore(storyBootstrap),
		onOpenItem: fn(),
	},
} satisfies Meta<typeof CommonspaceInbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Attention: Story = {};

export const Sessions: Story = {
	args: { viewRequest: { view: "sessions", token: 1 } },
};

export const Empty: Story = {
	args: {
		store: createStoryStore(emptyBootstrap),
	},
};

export const Loading: Story = {
	args: {
		store: createStoryStore(null, { loading: true }),
	},
};
