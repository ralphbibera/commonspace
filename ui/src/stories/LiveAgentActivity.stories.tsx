import type { CommonspaceLiveAgentActivity } from "@commonspace/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { LiveAgentActivity } from "../LiveAgentActivity";
import { hermesAgent, traceEntries } from "./story-fixtures";

const agent = {
	...hermesAgent,
	displayName: "Hermes",
	avatarEmoji: "H",
	accentColor: "#dc7a3d",
};

const activity: CommonspaceLiveAgentActivity = {
	id: "activity-hermes",
	sourceMessageId: "message-audit",
	agentId: agent.id,
	agentName: agent.displayName,
	adapter: "hermes",
	conversation: { kind: "channel", id: "channel-design" },
	startedAt: "2026-09-03T10:00:00.000Z",
	entries: [
		{
			type: "reasoning",
			id: "reasoning-live",
			text: "Planning a focused codebase audit and cleanup before making changes.",
			createdAt: "2026-09-03T10:00:01.000Z",
			updatedAt: "2026-09-03T10:00:05.000Z",
		},
	],
};

const meta = {
	title: "Components/LiveAgentActivity",
	component: LiveAgentActivity,
	parameters: {
		layout: "centered",
	},
	decorators: [
		(Story) => (
			<div className="w-[860px] max-w-[calc(100vw-32px)] py-8">
				<Story />
			</div>
		),
	],
	args: {
		activities: [activity],
		fallbackAgents: [],
		agents: [agent],
		phase: "running",
		onStop: fn(),
	},
} satisfies Meta<typeof LiveAgentActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reasoning: Story = {};

export const ExpandedTimeline: Story = {
	args: {
		activities: [{ ...activity, entries: traceEntries }],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Hermes activity" }),
		);
		await expect(
			canvas.getByRole("region", { name: "Hermes live activity" }),
		).toBeVisible();
	},
};

export const WaitingForProvider: Story = {
	args: {
		activities: [{ ...activity, entries: [] }],
	},
};

export const Queued: Story = {
	args: {
		activities: [],
		fallbackAgents: [agent],
		phase: "queued",
	},
};

export const StopAction: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Stop Hermes" }));
		await expect(args.onStop).toHaveBeenCalledOnce();
		await expect(args.onStop).toHaveBeenCalledWith(activity);
	},
};
