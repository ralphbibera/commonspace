import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Toggle as SingleToggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const meta = {
	title: "Foundations/UI Primitives",
	parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ControlsAndStates: Story = {
	render: () => (
		<div className="grid w-[680px] max-w-full gap-6 rounded-md border bg-background p-5 text-foreground">
			<section className="grid gap-3">
				<strong>Buttons and badges</strong>
				<div className="flex flex-wrap items-center gap-2">
					<Button>Primary action</Button>
					<Button variant="outline">Secondary</Button>
					<Button variant="destructive">Destructive</Button>
					<Badge>Running</Badge>
					<Badge variant="secondary">2 agents</Badge>
				</div>
			</section>
			<section className="grid gap-3">
				<strong>Toggle controls</strong>
				<div className="flex flex-wrap items-center gap-3">
					<SingleToggle aria-label="Pin item">Pin</SingleToggle>
					<ToggleGroup defaultValue={["all"]} aria-label="Filter">
						<ToggleGroupItem value="all">All</ToggleGroupItem>
						<ToggleGroupItem value="unread">Unread</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</section>
			<Empty className="min-h-52 border">
				<EmptyHeader>
					<EmptyMedia variant="icon">⌁</EmptyMedia>
					<EmptyTitle>No more results</EmptyTitle>
					<EmptyDescription>
						Change the filter to see another state.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	),
};
