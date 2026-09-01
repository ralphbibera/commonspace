import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CommonspaceConversation } from "@/CommonspaceConversation";
import { createStoryStore } from "@/storybook-fixtures";

type ConversationView =
	| "channel"
	| "thread"
	| "channel-settings"
	| "agent-profile";

function ConversationPreview({
	view = "channel",
}: {
	view?: ConversationView;
}) {
	const store = createStoryStore();
	if (view === "agent-profile")
		store.selectConversation({ kind: "dm", id: "agentops" });
	else store.selectConversation({ kind: "channel", id: "general" });
	if (view === "thread") store.selectThread("thread-attention");
	const settingsRequest =
		view === "channel-settings"
			? { kind: "channel" as const, id: "general", token: 1 }
			: view === "agent-profile"
				? { kind: "agent" as const, id: "agentops", token: 1 }
				: null;
	return (
		<div className="h-screen">
			<CommonspaceConversation
				store={store}
				settingsRequest={settingsRequest}
			/>
		</div>
	);
}

const meta = {
	title: "Screens/Conversation",
	component: ConversationPreview,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
} satisfies Meta<typeof ConversationPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Channel: Story = { args: { view: "channel" } };
export const ThreadOpen: Story = {
	args: { view: "thread" },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole("button", { name: "Follow thread" }),
		).toBeInTheDocument();
	},
};
export const ChannelSettings: Story = {
	args: { view: "channel-settings" },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole("complementary", {
				name: "Channel settings",
			}),
		).toBeInTheDocument();
	},
};
export const AgentProfile: Story = {
	args: { view: "agent-profile" },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole("complementary", {
				name: "Agent profile",
			}),
		).toBeInTheDocument();
	},
};
export const MessageActions: Story = {
	args: { view: "channel" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const first = canvas.getAllByRole("button", {
			name: "More actions for message from Ralph",
		})[0];
		await expect(first).toBeDefined();
		if (first === undefined) return;
		await userEvent.click(first);
		const menu = await within(document.body).findByRole("menu");
		await expect(
			within(menu).getByRole("menuitem", { name: "Save for later" }),
		).toBeInTheDocument();
	},
};
