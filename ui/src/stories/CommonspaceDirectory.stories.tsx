import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceDirectory } from "../CommonspaceDirectory";
import {
	createStoryStore,
	emptyBootstrap,
	storyBootstrap,
} from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceDirectory",
	component: CommonspaceDirectory,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
	args: {
		bootstrap: storyBootstrap,
		store: createStoryStore(storyBootstrap),
		onAdd: fn(),
		onOpenProject: fn(),
		onOpenConversation: fn(),
		onOpenSettings: fn(),
		onOpenSessions: fn(),
	},
} satisfies Meta<typeof CommonspaceDirectory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Projects: Story = { args: { kind: "projects" } };
export const Channels: Story = { args: { kind: "channels" } };
export const Agents: Story = { args: { kind: "agents" } };

export const Empty: Story = {
	args: {
		kind: "projects",
		bootstrap: emptyBootstrap,
		store: createStoryStore(emptyBootstrap),
	},
};
