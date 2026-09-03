import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ResourceActionMenu } from "../design-system/ResourceActionMenu";

const meta = {
	title: "Design System/ResourceActionMenu",
	component: ResourceActionMenu,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div className="group [&_[data-slot=dropdown-menu-trigger]]:opacity-100 flex w-[520px] items-center justify-between rounded-md border bg-background p-3 text-foreground">
				<div>
					<strong className="block text-sm">CommonspaceApp.tsx</strong>
					<span className="text-xs text-muted-foreground">File · 18 KB</span>
				</div>
				<Story />
			</div>
		),
	],
	args: {
		kind: "file",
		label: "CommonspaceApp.tsx",
		meta: "File · 18 KB",
		onOpen: fn(),
		onCopy: fn(),
	},
} satisfies Meta<typeof ResourceActionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const File: Story = {};
export const Folder: Story = {
	args: { kind: "folder", label: "ui", meta: "Folder" },
};
export const Thread: Story = {
	args: {
		kind: "thread",
		label: "Review the visual baseline",
		meta: "#design-review · 4 replies",
		onToggleFollow: fn(),
		onMarkUnread: fn(),
	},
};
export const FollowedUnreadThread: Story = {
	args: {
		kind: "thread",
		label: "Review the visual baseline",
		meta: "#design-review · 4 replies",
		following: true,
		unread: true,
		onToggleFollow: fn(),
		onMarkRead: fn(),
	},
};

export const OpenMenu: Story = {
	args: {
		defaultOpen: true,
		kind: "thread",
		onToggleFollow: fn(),
		onMarkUnread: fn(),
	},
};
