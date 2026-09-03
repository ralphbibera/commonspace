import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceTopbar } from "../CommonspaceTopbar";

const meta = {
	title: "Pages/CommonspaceTopbar",
	component: CommonspaceTopbar,
	parameters: { layout: "fullscreen" },
	args: { onOpenSearch: fn() },
} satisfies Meta<typeof CommonspaceTopbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const NarrowViewport: Story = {
	parameters: { viewport: { defaultViewport: "mobile1" } },
};
