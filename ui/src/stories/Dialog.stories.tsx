import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

const contextSections = [
	"Project overview",
	"Working agreements",
	"Architecture",
	"Current decisions",
	"Review checklist",
	"Local verification",
	"Open questions",
	"Next steps",
];

function ContextDialog({
	defaultOpen = false,
	long = false,
}: {
	defaultOpen?: boolean;
	long?: boolean;
}) {
	const titleRef = useRef<HTMLHeadingElement>(null);
	return (
		<Dialog defaultOpen={defaultOpen}>
			<DialogTrigger render={<Button variant="outline" />}>
				Inspect shared context
			</DialogTrigger>
			<DialogContent closeLabel="Close shared context" initialFocus={titleRef}>
				<DialogHeader className="border-b p-5 pr-16">
					<DialogTitle ref={titleRef} tabIndex={-1}>
						Shared context
					</DialogTitle>
					<DialogDescription>
						What agents can refer to in this conversation.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-6 p-5">
					{(long ? contextSections : contextSections.slice(0, 2)).map(
						(title) => (
							<section key={title} className="flex flex-col gap-2">
								<h3 className="font-medium">{title}</h3>
								<p className="text-sm leading-relaxed text-muted-foreground">
									Keep conversations readable, preserve the exact agent session,
									and include the project context needed for the next step.
									Record decisions where the next person can find them.
								</p>
							</section>
						),
					)}
				</div>
				<div className="flex justify-end border-t bg-muted/50 px-5 py-3">
					<DialogClose render={<Button variant="outline" />}>Done</DialogClose>
				</div>
			</DialogContent>
		</Dialog>
	);
}

const meta = {
	title: "Foundations/Dialog",
	component: ContextDialog,
	parameters: { layout: "centered" },
	args: { defaultOpen: true, long: false },
} satisfies Meta<typeof ContextDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Closed: Story = { args: { defaultOpen: false } };
export const LongContent: Story = { args: { long: true } };
export const KeyboardDismissal: Story = {
	args: { defaultOpen: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const page = within(canvasElement.ownerDocument.body);
		const trigger = canvas.getByRole("button", {
			name: "Inspect shared context",
		});
		await userEvent.click(trigger);
		const dialog = await page.findByRole("dialog", { name: "Shared context" });
		await waitFor(() => expect(dialog).toBeVisible());
		await waitFor(() =>
			expect(
				within(dialog).getByRole("heading", { name: "Shared context" }),
			).toHaveFocus(),
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(dialog).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};
