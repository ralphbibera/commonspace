import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsIcon, XIcon } from "lucide-react";
import { fn } from "storybook/test";
import { WorkspaceHeader } from "../design-system/WorkspaceHeader";

const meta = {
	title: "Design System/WorkspaceHeader",
	component: WorkspaceHeader,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="min-h-screen bg-sidebar text-foreground">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof WorkspaceHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		title: "Workspace settings",
		mark: <SettingsIcon className="size-4" aria-hidden="true" />,
	},
};

export const WithVisibleCloseAction: Story = {
	args: {
		title: "Workspace settings",
		subtitle: "Defaults used for new conversations",
		mark: <SettingsIcon className="size-4" aria-hidden="true" />,
		actions: (
			<button
				type="button"
				aria-label="Close settings"
				onClick={fn()}
				className="grid size-10 place-items-center rounded-sm border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				<XIcon className="size-4" aria-hidden="true" />
			</button>
		),
	},
};

export const LongTitle: Story = {
	args: {
		title:
			"Workspace settings for local agent routing and conversation defaults",
		subtitle: "Long labels must remain legible without breaking the shell",
		mark: <SettingsIcon className="size-4" aria-hidden="true" />,
	},
};
