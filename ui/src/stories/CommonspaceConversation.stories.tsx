import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceConversation } from "../CommonspaceConversation";
import {
	createStoryStore,
	primaryProject,
	storyBootstrap,
} from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceConversation",
	component: CommonspaceConversation,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof CommonspaceConversation>;

export default meta;
type Story = StoryObj<typeof meta>;

const channel = { kind: "channel" as const, id: "channel-design" };
const directMessage = { kind: "dm" as const, id: "agent-hermes" };

export const ChannelConversation: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			activeConversation: channel,
			activeProjectId: primaryProject.id,
		}),
	},
};

export const DirectMessage: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			activeConversation: directMessage,
			activeProjectId: primaryProject.id,
		}),
	},
};

export const FocusedReply: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			activeConversation: channel,
			activeProjectId: primaryProject.id,
		}),
		targetMessageId: "message-reply",
		onTargetMessageHandled: fn(),
	},
};

export const ChannelSettings: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			activeConversation: channel,
			activeProjectId: primaryProject.id,
		}),
		settingsRequest: { kind: "channel", id: "channel-design", token: 1 },
	},
};
