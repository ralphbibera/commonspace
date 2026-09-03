import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { RunAttribution } from "../RunAttribution";
import { runAttribution } from "./story-fixtures";

const meta = {
	title: "Components/RunAttribution",
	component: RunAttribution,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div className="w-[720px] max-w-full">
				<Story />
			</div>
		),
	],
	args: {
		attribution: runAttribution,
		authorName: "Review Bot",
		messageId: "message-reply",
		projectId: "project-commonspace",
	},
} satisfies Meta<typeof RunAttribution>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", {
			name: "Show run evidence for Review Bot",
		});
		await userEvent.click(button);
		await expect(button).toHaveAttribute("aria-expanded", "true");
		await expect(
			canvas.getByRole("region", { name: "Review Bot run evidence" }),
		).toBeVisible();
	},
};

export const NoAvailableFolders: Story = {
	args: {
		attribution: {
			...runAttribution,
			roots: [
				{
					available: false,
					rootIndex: 0,
					reason: "The project folder was not available.",
				},
			],
		},
	},
};
