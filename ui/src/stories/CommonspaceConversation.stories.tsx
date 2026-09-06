import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommonspaceConversation } from "../CommonspaceConversation";
import type { CommonspaceStore } from "../commonspace-store";
import { COMMONSPACE_RESIZABLE_PANEL } from "../design-system/useResizablePanel";
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

function ChannelSettingsPreview() {
	const [settingsOpen, setSettingsOpen] = useState(true);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const store = useMemo(
		() =>
			createStoryStore(storyBootstrap, {
				activeConversation: channel,
				activeProjectId: primaryProject.id,
				activeThreadId,
			}),
		[activeThreadId],
	);
	return (
		<CommonspaceConversation
			store={store}
			settingsRequest={
				settingsOpen
					? { kind: "channel", id: "channel-design", token: 1 }
					: null
			}
			onOpenSettings={() => {
				setSettingsOpen(true);
			}}
			onThreadChange={setActiveThreadId}
			onSettingsClosed={() => {
				setSettingsOpen(false);
			}}
		/>
	);
}

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
	render: () => <ChannelSettingsPreview />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const settings = await canvas.findByRole("complementary", {
			name: "Channel settings",
		});
		await expect(settings).toBeVisible();
		const resizer = canvas.queryByRole("separator", {
			name: "Resize settings",
		});
		if (resizer === null) {
			return;
		}
		const initial = Number(resizer.getAttribute("aria-valuenow"));
		resizer.focus();
		await userEvent.keyboard("{ArrowLeft}");
		await expect(resizer).toHaveAttribute(
			"aria-valuenow",
			String(
				Math.min(
					COMMONSPACE_RESIZABLE_PANEL.max,
					initial + COMMONSPACE_RESIZABLE_PANEL.step,
				),
			),
		);
		const resizedWidth = await resizer.getAttribute("aria-valuenow");
		await userEvent.click(
			canvas.getByRole("button", { name: "Close channel settings" }),
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "1 reply, 1 unread" }),
		);
		const threadResizer = await canvas.findByRole("separator", {
			name: "Resize thread",
		});
		await expect(threadResizer).toHaveAttribute(
			"aria-valuenow",
			resizedWidth ?? String(COMMONSPACE_RESIZABLE_PANEL.defaultValue),
		);
		await userEvent.click(canvas.getByRole("button", { name: "Close thread" }));
		await userEvent.click(
			canvas.getByRole("button", { name: "Open channel settings" }),
		);
		const reopenedSettingsResizer = await canvas.findByRole("separator", {
			name: "Resize settings",
		});
		await expect(reopenedSettingsResizer).toHaveAttribute(
			"aria-valuenow",
			resizedWidth ?? String(COMMONSPACE_RESIZABLE_PANEL.defaultValue),
		);
		await userEvent.dblClick(reopenedSettingsResizer);
		await expect(reopenedSettingsResizer).toHaveAttribute(
			"aria-valuenow",
			String(COMMONSPACE_RESIZABLE_PANEL.defaultValue),
		);
	},
};

export const AgentSettings: Story = {
	args: {
		store: createStoryStore(storyBootstrap, {
			activeConversation: directMessage,
			activeProjectId: primaryProject.id,
		}),
		settingsRequest: { kind: "agent", id: "agent-hermes", token: 1 },
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
