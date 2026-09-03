import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { AgentTrace, AgentTraceTimeline } from "../AgentTrace";
import { trace, traceEntries } from "./story-fixtures";

const meta = {
	title: "Components/AgentTrace",
	component: AgentTrace,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div className="w-[720px] max-w-full">
				<Story />
			</div>
		),
	],
	args: { authorName: "Review Bot", trace },
} satisfies Meta<typeof AgentTrace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Show Hermes activity for Review Bot",
			}),
		);
		await expect(
			canvas.getByRole("region", { name: "Review Bot activity trace" }),
		).toBeVisible();
	},
};

export const TimelineOnly: Story = {
	render: () => (
		<section
			aria-label="Trace timeline"
			className="w-[720px] max-w-full rounded-md border bg-background p-4"
		>
			<strong className="mb-3 block">Timeline states</strong>
			<AgentTraceTimeline entries={traceEntries} />
		</section>
	),
};

export const NoActivity: Story = {
	args: { trace: { ...trace, entries: [] } },
};
