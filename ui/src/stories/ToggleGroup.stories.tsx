import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const meta = {
	title: "Foundations/ToggleGroup",
	component: ToggleGroup,
	parameters: { layout: "centered" },
	args: {
		defaultValue: ["all"],
		variant: "outline",
		spacing: 0,
		orientation: "horizontal",
		"aria-label": "Inbox filter",
	},
	argTypes: {
		variant: { control: "inline-radio", options: ["default", "outline"] },
		size: { control: "inline-radio", options: ["sm", "default", "lg"] },
		orientation: {
			control: "inline-radio",
			options: ["horizontal", "vertical"],
		},
		spacing: { control: { type: "range", min: 0, max: 4, step: 1 } },
	},
	render: (args) => (
		<ToggleGroup {...args}>
			<ToggleGroupItem value="all">All</ToggleGroupItem>
			<ToggleGroupItem value="unread">Unread</ToggleGroupItem>
			<ToggleGroupItem value="saved">Saved</ToggleGroupItem>
		</ToggleGroup>
	),
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};
export const Spaced: Story = { args: { spacing: 2 } };
export const Multiple: Story = {
	args: { multiple: true, defaultValue: ["unread", "saved"] },
};
export const Disabled: Story = { args: { disabled: true } };
export const Vertical: Story = {
	args: { orientation: "vertical" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "All" }));
		await userEvent.keyboard("{ArrowDown}");
		await expect(canvas.getByRole("button", { name: "Unread" })).toHaveFocus();
		await userEvent.keyboard(" ");
		await expect(
			canvas.getByRole("button", { name: "Unread" }),
		).toHaveAttribute("aria-pressed", "true");
	},
};
