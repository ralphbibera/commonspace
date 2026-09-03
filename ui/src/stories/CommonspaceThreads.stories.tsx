import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceThreads } from "../CommonspaceThreads";
import {
	createStoryStore,
	emptyBootstrap,
	storyBootstrap,
} from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceThreads",
	component: CommonspaceThreads,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
	args: {
		bootstrap: storyBootstrap,
		store: createStoryStore(storyBootstrap),
		onOpenThread: fn(),
	},
} satisfies Meta<typeof CommonspaceThreads>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllThreads: Story = {};
export const Empty: Story = {
	args: {
		bootstrap: emptyBootstrap,
		store: createStoryStore(emptyBootstrap),
	},
};

export const Loading: Story = {
	args: { bootstrap: null, store: createStoryStore(null, { loading: true }) },
};
