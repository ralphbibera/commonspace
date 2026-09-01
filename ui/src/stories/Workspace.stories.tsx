import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CommonspaceApp } from "@/CommonspaceApp";
import { createStoryStore } from "@/storybook-fixtures";

const meta = {
	title: "Workspace/Complete App",
	component: CommonspaceApp,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
	args: { store: createStoryStore() },
} satisfies Meta<typeof CommonspaceApp>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {
	render: () => <CommonspaceApp store={createStoryStore()} />,
};
export const NavigationFlow: Story = {
	render: () => <CommonspaceApp store={createStoryStore()} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Dashboard" }),
		).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: /Open Inbox/u }));
		await expect(
			canvas.getByRole("heading", { name: "Inbox" }),
		).toBeInTheDocument();
	},
};
export const DirectoryFlow: Story = {
	render: () => <CommonspaceApp store={createStoryStore()} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Browse all projects" }),
		);
		await expect(
			canvas.getByRole("heading", { name: "All projects" }),
		).toBeInTheDocument();
		await userEvent.click(
			within(
				canvas.getByRole("main", { name: "Projects directory" }),
			).getByRole("button", { name: "Add project" }),
		);
		await expect(
			within(document.body).getByRole("dialog", { name: "Add a project" }),
		).toBeInTheDocument();
	},
};
