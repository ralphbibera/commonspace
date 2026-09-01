import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommonspaceSidebar } from "@/CommonspaceSidebar";
import { createStoryStore } from "@/storybook-fixtures";

function SidebarPreview() {
	return (
		<div className="h-screen w-[260px] bg-sidebar">
			<CommonspaceSidebar
				wide
				expandSidebar={fn()}
				store={createStoryStore()}
				homeActive
				onOpenHome={fn()}
				onOpenSearch={fn()}
				onOpenInbox={fn()}
				onOpenThreads={fn()}
				onOpenProject={fn()}
				onOpenConversation={fn()}
			/>
		</div>
	);
}

const meta = {
	title: "Workspace/Sidebar",
	component: SidebarPreview,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
} satisfies Meta<typeof SidebarPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const AddProjectDialog: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Add project" }));
		await expect(
			within(document.body).getByRole("dialog", { name: "Add a project" }),
		).toBeInTheDocument();
	},
};
export const AddChannelDialog: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Add channel" }));
		await expect(
			within(document.body).getByRole("dialog", { name: "Add a channel" }),
		).toBeInTheDocument();
	},
};
export const AddAgentDialog: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Add agent" }));
		await expect(
			within(document.body).getByRole("dialog", { name: "Add an agent" }),
		).toBeInTheDocument();
	},
};
export const WorkspaceSettings: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Commonspace settings" }),
		);
		await expect(
			within(document.body).getByRole("heading", {
				name: "Choose how the workspace thinks",
			}),
		).toBeInTheDocument();
	},
};
