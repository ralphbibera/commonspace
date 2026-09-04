import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommonspaceConversation } from "../CommonspaceConversation";
import type { CommonspaceStore } from "../commonspace-store";
import {
	createStoryStore,
	denseStoryBootstrap,
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

function FocusTransitionPreview() {
	const [conversationKind, setConversationKind] = useState<"channel" | "dm">(
		"channel",
	);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(
		"thread-review",
	);
	const [targetMessageId, setTargetMessageId] = useState<string | null>(
		"message-reply",
	);
	const store = useMemo(
		() =>
			createStoryStore(denseStoryBootstrap, {
				activeConversation:
					conversationKind === "channel" ? channel : directMessage,
				activeProjectId: primaryProject.id,
				activeThreadId,
			}),
		[activeThreadId, conversationKind],
	);
	return (
		<div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
			<div>
				<button
					type="button"
					disabled={targetMessageId !== null}
					onClick={() => {
						setActiveThreadId("thread-dense-1");
					}}
				>
					Switch to another thread
				</button>
				<button
					type="button"
					onClick={() => {
						setConversationKind((current) => {
							if (current === "channel") {
								setActiveThreadId(null);
								return "dm";
							}
							return "channel";
						});
					}}
				>
					{conversationKind === "channel"
						? "Open direct message"
						: "Return to channel"}
				</button>
			</div>
			<CommonspaceConversation
				store={store}
				targetMessageId={targetMessageId}
				onTargetMessageHandled={() => {
					setTargetMessageId(null);
				}}
			/>
		</div>
	);
}

export const ChannelConversation: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			activeConversation: channel,
			activeProjectId: primaryProject.id,
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(
				"Review the visual baseline and document the next component states.",
			),
		).toBeVisible();
		await expect(
			canvas.queryByText("Inspect only the desktop UI boundary."),
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByText("Design review matches Hermes."),
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByRole("list", { name: "Routing assignments" }),
		).not.toBeInTheDocument();
	},
};

export const FocusClearsOnThreadChange: Story = {
	args: {
		store: createStoryStore(denseStoryBootstrap, {
			activeConversation: channel,
			activeProjectId: primaryProject.id,
			activeThreadId: "thread-review",
		}),
	},
	render: () => <FocusTransitionPreview />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const switchThread = canvas.getByRole("button", {
			name: "Switch to another thread",
		});
		await expect(switchThread).toBeEnabled();
		await expect(
			canvasElement.querySelector("#commonspace-message-message-root"),
		).toHaveAttribute("aria-current", "true");

		await userEvent.click(switchThread);

		await expect(
			canvasElement.querySelector("#commonspace-message-message-dense-root-1"),
		).toHaveAttribute("aria-current", "true");
		await expect(
			canvasElement.querySelector("#commonspace-message-message-root"),
		).not.toHaveAttribute("aria-current");
	},
};

export const FocusClearsOnConversationChange: Story = {
	args: {
		store: createStoryStore(denseStoryBootstrap, {
			activeConversation: channel,
			activeProjectId: primaryProject.id,
			activeThreadId: "thread-review",
		}),
	},
	render: () => <FocusTransitionPreview />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Switch to another thread" }),
		).toBeEnabled();
		await expect(
			canvasElement.querySelector("#commonspace-message-message-root"),
		).toHaveAttribute("aria-current", "true");

		await userEvent.click(
			canvas.getByRole("button", { name: "Open direct message" }),
		);
		await expect(
			canvas.getByRole("textbox", { name: "Message Review Bot" }),
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: "Return to channel" }),
		);

		await expect(
			canvasElement.querySelector("#commonspace-message-message-root"),
		).not.toHaveAttribute("aria-current");
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

const activeRunSend = fn<CommonspaceStore["send"]>();
const activeRunStore = createStoryStore(runtimeStoryBootstrap, {
	activeConversation: directMessage,
	activeProjectId: primaryProject.id,
	send: activeRunSend,
});

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
		const composer = canvas.getByRole("textbox", {
			name: "Message Review Bot",
		});
		await userEvent.type(composer, "Use the new direction instead.");
		await userEvent.click(
			canvas.getByRole("button", { name: "Stop and send" }),
		);
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
		await expect(
			canvas.getByRole("textbox", { name: "Edited message" }),
		).toHaveValue(
			"Review the visual baseline and document the next component states.",
		);
	},
};
