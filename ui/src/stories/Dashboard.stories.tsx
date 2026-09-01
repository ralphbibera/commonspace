import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceHome } from "@/CommonspaceHome";
import { storyBootstrap } from "@/storybook-fixtures";

const meta = {
	title: "Screens/Dashboard",
	component: CommonspaceHome,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
	args: {
		bootstrap: storyBootstrap,
		onOpenSession: fn(),
		onOpenConversation: fn(),
		onStopSession: fn(async () => undefined),
	},
} satisfies Meta<typeof CommonspaceHome>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = {
	args: {
		bootstrap: {
			...storyBootstrap,
			liveActivities: [],
			state: { ...storyBootstrap.state, messages: {}, threads: [] },
		},
	},
};
