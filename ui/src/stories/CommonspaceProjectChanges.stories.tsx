import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CommonspaceProjectChanges } from "../CommonspaceProjectChanges";
import {
	emptyProjectFetcher,
	errorProjectFetcher,
	primaryProject,
	storyProjectFetcher,
} from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceProjectChanges",
	component: CommonspaceProjectChanges,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
	args: {
		projectId: primaryProject.id,
		fetcher: storyProjectFetcher,
	},
} satisfies Meta<typeof CommonspaceProjectChanges>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkingTree: Story = {};

export const SelectedTextDiff: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole("button", {
				name: /Open change ui\/src\/CommonspaceApp\.tsx/iu,
			}),
		);
		await expect(await canvas.findByText(/Conversation-first startup/iu)).toBeVisible();
	},
};

export const CleanWorkingTree: Story = {
	args: { fetcher: emptyProjectFetcher },
};
export const RequestFailed: Story = { args: { fetcher: errorProjectFetcher } };
