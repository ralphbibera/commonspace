import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceSidebar } from "../CommonspaceSidebar";
import { createStoryStore, storyBootstrap } from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceSidebar",
	component: CommonspaceSidebar,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
	args: {
		wide: true,
		expandSidebar: fn(),
		store: createStoryStore(storyBootstrap),
		colorMode: "light",
		onSetColorMode: fn(),
		inboxActive: true,
		onOpenSearch: fn(),
		onOpenInbox: fn(),
		onOpenThreads: fn(),
		onOpenDirectory: fn(),
		onOpenContextSettings: fn(),
		onMentionAgent: fn(),
		onOpenAgentSessions: fn(),
		onOpenProject: fn(),
		onOpenConversation: fn(),
	},
} satisfies Meta<typeof CommonspaceSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

export const Collapsed: Story = {
	args: { wide: false },
};

export const ThreadsActive: Story = {
	args: {
		inboxActive: false,
		threadsActive: true,
	},
};

export const DirectoryActive: Story = {
	args: {
		inboxActive: false,
		directoryActive: true,
	},
};

export const CreateChannelRequest: Story = {
	args: {
		createRequest: { kind: "channel", token: 1 },
	},
};
