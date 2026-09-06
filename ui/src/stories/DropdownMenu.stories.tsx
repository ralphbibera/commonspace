import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	BellOffIcon,
	MoreHorizontalIcon,
	PinIcon,
	SettingsIcon,
	Trash2Icon,
} from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function ChannelMenu({
	defaultOpen = false,
	edge = false,
}: {
	defaultOpen?: boolean;
	edge?: boolean;
}) {
	return (
		<div className={edge ? "fixed right-4 bottom-4" : "p-6"}>
			<DropdownMenu defaultOpen={defaultOpen}>
				<DropdownMenuTrigger
					render={<Button variant="outline" size="icon" />}
					aria-label="Channel actions"
				>
					<MoreHorizontalIcon aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuGroup>
						<DropdownMenuLabel>design-review</DropdownMenuLabel>
						<DropdownMenuItem>
							<PinIcon aria-hidden="true" />
							Pin channel
						</DropdownMenuItem>
						<DropdownMenuItem>
							<SettingsIcon aria-hidden="true" />
							Channel settings
						</DropdownMenuItem>
						<DropdownMenuItem disabled>
							<BellOffIcon aria-hidden="true" />
							Mute notifications
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem variant="destructive">
							<Trash2Icon aria-hidden="true" />
							Remove channel
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

const meta = {
	title: "Foundations/DropdownMenu",
	component: ChannelMenu,
	parameters: { layout: "centered" },
	args: { defaultOpen: true, edge: false },
} satisfies Meta<typeof ChannelMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Closed: Story = { args: { defaultOpen: false } };
export const ViewportEdge: Story = {
	args: { edge: true },
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const menu = await page.findByRole("menu");
		const bounds = menu.getBoundingClientRect();
		await expect(bounds.left).toBeGreaterThanOrEqual(0);
		await expect(bounds.bottom).toBeLessThanOrEqual(
			canvasElement.ownerDocument.documentElement.clientHeight,
		);
	},
};
export const KeyboardNavigation: Story = {
	args: { defaultOpen: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const page = within(canvasElement.ownerDocument.body);
		const trigger = canvas.getByRole("button", { name: "Channel actions" });
		trigger.focus();
		await userEvent.keyboard("{ArrowDown}");
		await waitFor(() =>
			expect(page.getByRole("menuitem", { name: "Pin channel" })).toHaveFocus(),
		);
		await userEvent.keyboard("{ArrowDown}");
		await expect(
			page.getByRole("menuitem", { name: "Channel settings" }),
		).toHaveFocus();
		await userEvent.keyboard("{Escape}");
		await expect(trigger).toHaveFocus();
	},
};
