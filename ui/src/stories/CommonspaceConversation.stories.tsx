import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommonspaceConversation } from "../CommonspaceConversation";
import {
	createStoryStore,
	primaryProject,
	runtimeStoryBootstrap,
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

const activeRunSend = fn();
const activeRunStore = new Proxy(
	createStoryStore(runtimeStoryBootstrap, {
		activeConversation: directMessage,
		activeProjectId: primaryProject.id,
	}),
	{
		get(target, property, receiver) {
			if (property === "send") return activeRunSend;
			return Reflect.get(target, property, receiver);
		},
	},
);

export const NarrowActiveRunComposer: Story = {
	args: { store: activeRunStore },
	decorators: [
		(Story) => (
			<div className="h-[720px] w-[320px] overflow-hidden border">
				<Story />
			</div>
		),
	],
	play: async ({ canvasElement }) => {
		activeRunSend.mockClear();
		const canvas = within(canvasElement);
		const composer = canvas.getByRole("textbox", { name: "Message Review Bot" });
		await userEvent.type(composer, "Use the new direction instead.");
		await userEvent.click(canvas.getByRole("button", { name: "Stop and send" }));
		await expect(activeRunSend).toHaveBeenNthCalledWith(
			1,
			"Use the new direction instead.",
			undefined,
			[],
			"stop-and-send",
		);

		await userEvent.type(composer, "Wait for the current run.");
		await userEvent.click(canvas.getByRole("button", { name: "Queue" }));
		await expect(activeRunSend).toHaveBeenNthCalledWith(
			2,
			"Wait for the current run.",
			undefined,
			[],
			"queue",
		);

		await userEvent.type(composer, "Adjust the current direction.");
		await userEvent.click(canvas.getByRole("button", { name: "Steer" }));
		await expect(activeRunSend).toHaveBeenNthCalledWith(
			3,
			"Adjust the current direction.",
			undefined,
			[],
			"steer",
		);
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

export const EditingDeliveredMessage: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			activeConversation: channel,
			activeProjectId: primaryProject.id,
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Edit message from Ralph" }),
		);
		await expect(
			canvas.getByRole("form", { name: "Edit delivered message" }),
		).toBeVisible();
		await expect(canvas.getByRole("textbox", { name: "Edited message" })).toHaveValue(
			"Review the visual baseline and document the next component states.",
		);
	},
};
