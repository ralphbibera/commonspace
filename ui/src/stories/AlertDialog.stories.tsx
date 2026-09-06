import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

function RemovalDialog({
	defaultOpen = false,
	size = "default",
	long = false,
}: {
	defaultOpen?: boolean;
	size?: "default" | "sm";
	long?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline" />}>
				Remove channel
			</AlertDialogTrigger>
			<AlertDialogContent size={size}>
				<AlertDialogHeader>
					<AlertDialogTitle>Remove design-review?</AlertDialogTitle>
					<AlertDialogDescription>
						This removes the channel and its conversations from your workspace.
						{long &&
							Array.from(
								{ length: 16 },
								(_, index) =>
									` Related thread ${index + 1} includes messages, attachments, and shared context that will also be removed.`,
							).join("")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => setOpen(false)}
					>
						Remove channel
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

const meta = {
	title: "Foundations/AlertDialog",
	component: RemovalDialog,
	parameters: { layout: "centered" },
	args: { defaultOpen: true, size: "default", long: false },
	argTypes: { size: { control: "inline-radio", options: ["default", "sm"] } },
} satisfies Meta<typeof RemovalDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Compact: Story = { args: { size: "sm" } };
export const Closed: Story = { args: { defaultOpen: false } };
export const LongContent: Story = {
	args: { long: true },
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const dialog = await page.findByRole("alertdialog");
		const bounds = dialog.getBoundingClientRect();
		const viewport = canvasElement.ownerDocument.documentElement.clientHeight;
		await expect(bounds.top).toBeGreaterThanOrEqual(16);
		await expect(bounds.bottom).toBeLessThanOrEqual(viewport - 16);
	},
};
