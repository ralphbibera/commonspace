import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentAvatar } from "../design-system/AgentAvatar";

const reviewBot = {
	displayName: "Review Bot",
	avatarEmoji: "🔎",
	accentColor: "#635bff",
	status: "running" as const,
};

const designCritic = {
	displayName: "Design Critic",
	accentColor: "#e07a5f",
	status: "stopped" as const,
};

const meta = {
	title: "Design System/AgentAvatar",
	component: AgentAvatar,
	parameters: { layout: "centered" },
} satisfies Meta<typeof AgentAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {
	args: {
		agent: designCritic,
		size: "md",
		ariaLabel: "Design Critic",
	},
};

export const EmojiWithRunningStatus: Story = {
	args: {
		agent: reviewBot,
		size: "lg",
		showStatus: true,
		ariaLabel: "Review Bot, running",
	},
};

export const SizeAndStatusMatrix: Story = {
	render: () => (
		<div className="flex items-end gap-5 text-xs text-muted-foreground">
			{(["sm", "md", "lg", "activity", "stack"] as const).map((size) => (
				<div className="grid justify-items-center gap-2" key={size}>
					<AgentAvatar
						agent={reviewBot}
						size={size}
						showStatus
						ariaLabel={`Review Bot ${size}`}
					/>
					<span>{size}</span>
				</div>
			))}
		</div>
	),
};
