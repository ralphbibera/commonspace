import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ConfirmActionDialog } from "../design-system/ConfirmActionDialog";

function ControlledConfirmActionDialog(
	props: ComponentProps<typeof ConfirmActionDialog>,
) {
	const [open, setOpen] = useState(props.open);
	return <ConfirmActionDialog {...props} open={open} onOpenChange={setOpen} />;
}

const meta = {
	title: "Design System/ConfirmActionDialog",
	component: ConfirmActionDialog,
	parameters: { layout: "centered" },
	args: {
		open: true,
		title: "Remove this channel?",
		description:
			"This removes the channel from the workspace. Existing messages remain in local history.",
		actionLabel: "Remove channel",
		onOpenChange: fn(),
		onConfirm: fn(),
	},
} satisfies Meta<typeof ConfirmActionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const CustomDangerAction: Story = {
	args: {
		title: "Remove Build Smith?",
		description: "The agent will no longer be available for new conversations.",
		actionLabel: "Remove agent",
	},
};

export const CancelAction: Story = {
	render: (args) => <ControlledConfirmActionDialog {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement.ownerDocument.body);
		await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
		await waitFor(() => {
			expect(canvas.queryByRole("alertdialog")).toBeNull();
		});
	},
};
