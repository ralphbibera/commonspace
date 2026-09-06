import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { SidebarSortControl } from "../design-system/SidebarSortControl";

function SortPreview(args: ComponentProps<typeof SidebarSortControl>) {
	const [mode, setMode] = useState(args.mode);
	return (
		<div className="flex w-[260px] items-center gap-2 bg-sidebar p-3 text-sidebar-foreground">
			<span className="flex-1 text-xs font-semibold">
				{args.kind === "channel"
					? "Channels"
					: args.kind === "project"
						? "Projects"
						: "Agents"}
			</span>
			<SidebarSortControl
				{...args}
				mode={mode}
				onModeChange={(next) => {
					setMode(next);
					args.onModeChange(next);
				}}
			/>
		</div>
	);
}

const meta = {
	title: "Design System/SidebarSortControl",
	component: SidebarSortControl,
	parameters: { layout: "centered" },
	args: { kind: "channel", mode: "recent", onModeChange: fn() },
	argTypes: {
		kind: { control: "inline-radio", options: ["project", "channel", "agent"] },
		mode: {
			control: "inline-radio",
			options: ["recent", "alphabetical", "custom"],
		},
	},
	render: (args) => <SortPreview key={args.mode} {...args} />,
} satisfies Meta<typeof SidebarSortControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recent: Story = {};
export const Alphabetical: Story = { args: { mode: "alphabetical" } };
export const Custom: Story = { args: { mode: "custom" } };
export const Open: Story = {
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: /^Sort channels:/u }),
		);
		await expect(
			await within(canvasElement.ownerDocument.body).findByRole(
				"menuitemradio",
				{
					name: "Recent activity",
				},
			),
		).toHaveAttribute("aria-checked", "true");
	},
};
export const SelectOrder: Story = {
	tags: ["smoke"],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: /^Sort channels:/u }),
		);
		await userEvent.click(
			within(canvasElement.ownerDocument.body).getByRole("menuitemradio", {
				name: "Alphabetical",
			}),
		);
		await expect(
			canvas.getByRole("button", { name: "Sort channels: Alphabetical" }),
		).toBeVisible();
	},
};
