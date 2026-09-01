import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const first = canvas.getAllByRole("button", {
			name: /More actions for/u,
		})[0];
		await expect(first).toBeDefined();
		if (first === undefined) return;
		await userEvent.click(first);
		const menu = await within(document.body).findByRole("menu");
		await expect(
			within(menu).getByRole("menuitem", {
				name: /Follow thread|Unfollow thread/u,
			}),
		).toBeInTheDocument();
	},
};
