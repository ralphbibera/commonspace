import type { Meta, StoryObj } from "@storybook/react-vite";
import { PinIcon } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

const meta = {
	title: "Foundations/Toggle",
	component: Toggle,
	parameters: { layout: "centered" },
	args: {
		"aria-label": "Pin channel",
		children: (
			<>
				<PinIcon data-icon="inline-start" aria-hidden="true" />
				Pin
			</>
		),
	},
	argTypes: {
		variant: { control: "inline-radio", options: ["default", "outline"] },
		size: { control: "inline-radio", options: ["sm", "default", "lg"] },
		disabled: { control: "boolean" },
		defaultPressed: { control: "boolean" },
	},
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { defaultPressed: true } };
export const Outline: Story = { args: { variant: "outline" } };
export const Disabled: Story = { args: { disabled: true } };
export const IconOnly: Story = {
	args: { children: <PinIcon aria-hidden="true" /> },
};
