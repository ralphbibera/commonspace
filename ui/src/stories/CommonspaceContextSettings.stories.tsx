import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
	AgentSettingsPane,
	ChannelSettingsPane,
} from "../CommonspaceContextSettings";
import { createStoryStore, storyBootstrap } from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceContextSettings",
	component: ChannelSettingsPane,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="min-h-screen w-full bg-background">
				<Story />
			</div>
		),
	],
	args: {
		bootstrap: storyBootstrap,
		id: "channel-design",
		store: createStoryStore(storyBootstrap),
		onClose: fn(),
	},
} satisfies Meta<typeof ChannelSettingsPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChannelSettings: Story = {};

export const AgentSettings: Story = {
	render: () => (
		<AgentSettingsPane
			bootstrap={storyBootstrap}
			id="agent-hermes"
			store={createStoryStore(storyBootstrap)}
			onClose={fn()}
		/>
	),
};

export const MissingChannel: Story = {
	args: { id: "missing-channel" },
};
