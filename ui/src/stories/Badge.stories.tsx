import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const meta = {
	title: "Foundations/Badge",
	component: Badge,
	parameters: { layout: "centered" },
	args: { children: "Running", variant: "default" },
	argTypes: {
		variant: {
			control: "select",
			options: [
				"default",
				"secondary",
				"outline",
				"ghost",
				"destructive",
				"link",
			],
		},
	},
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Variants: Story = {
	render: () => (
		<div className="flex flex-wrap gap-3">
			{(
				[
					"default",
					"secondary",
					"outline",
					"ghost",
					"destructive",
					"link",
				] as const
			).map((variant) => (
				<Badge key={variant} variant={variant}>
					{variant}
				</Badge>
			))}
		</div>
	),
};
export const RuntimeStates: Story = {
	render: () => (
		<div className="flex flex-wrap gap-3">
			<Badge>
				<LoaderCircleIcon
					data-icon="inline-start"
					aria-hidden="true"
					className="motion-safe:animate-spin"
				/>
				Running
			</Badge>
			<Badge variant="secondary">
				<CheckIcon data-icon="inline-start" aria-hidden="true" />
				Completed
			</Badge>
			<Badge variant="destructive">
				<CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
				Needs attention
			</Badge>
			<Badge variant="outline">3 agents</Badge>
		</div>
	),
};
export const LongLabel: Story = {
	args: { variant: "outline", children: "Waiting for workspace permission" },
};
