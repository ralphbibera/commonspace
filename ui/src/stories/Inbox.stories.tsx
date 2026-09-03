import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceInbox } from "@/CommonspaceInbox";
import { createStoryStore } from "@/storybook-fixtures";

const meta = {
	title: "Screens/Inbox",
	component: CommonspaceInbox,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
} satisfies Meta<typeof CommonspaceInbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Attention: Story = {
	tags: ["smoke"],
	args: { store: createStoryStore(), onOpenItem: fn() },
};
