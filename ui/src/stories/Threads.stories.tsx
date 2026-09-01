import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceThreads } from "@/CommonspaceThreads";
import { createStoryStore, storyBootstrap } from "@/storybook-fixtures";

const meta = {
	title: "Screens/Threads",
	component: CommonspaceThreads,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
} satisfies Meta<typeof CommonspaceThreads>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
	args: {
		bootstrap: storyBootstrap,
		store: createStoryStore(),
		onOpenThread: fn(),
	},
};
