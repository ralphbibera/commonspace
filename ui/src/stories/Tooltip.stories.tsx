import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListOrderedIcon } from "lucide-react";
import { userEvent, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

const meta = {
	title: "Foundations/Tooltip",
	component: Tooltip,
	parameters: { layout: "centered" },
	render: (args) => (
		<Tooltip {...args}>
			<TooltipTrigger
				render={<Button variant="ghost" size="icon-xs" />}
				aria-label="Sort channels"
			>
				<ListOrderedIcon aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent>Sort channels · Custom order</TooltipContent>
		</Tooltip>
	),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};
export const Open: Story = { args: { open: true } };
export const KeyboardFocus: Story = {
	play: async ({ canvasElement }) => {
		await userEvent.tab();
		within(canvasElement)
			.getByRole("button", { name: "Sort channels" })
			.focus();
	},
};
