import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommonspaceLogo } from "../design-system/CommonspaceLogo";

const meta = {
	title: "Design System/CommonspaceLogo",
	component: CommonspaceLogo,
	parameters: { layout: "centered" },
} satisfies Meta<typeof CommonspaceLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accessible: Story = {
	args: { className: "size-20" },
};

export const Decorative: Story = {
	args: { decorative: true, className: "size-12" },
};
