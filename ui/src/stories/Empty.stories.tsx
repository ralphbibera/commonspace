import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderIcon, SearchIcon, UnplugIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

const meta = {
	title: "Foundations/Empty",
	component: Empty,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div className="w-[520px] max-w-full">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstProject: Story = {
	render: () => (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FolderIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No projects yet</EmptyTitle>
				<EmptyDescription>
					Add a local folder to give your agents project context.
				</EmptyDescription>
			</EmptyHeader>
			<Button variant="outline">Add project</Button>
		</Empty>
	),
};
export const NoResults: Story = {
	render: () => (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SearchIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No matching conversations</EmptyTitle>
				<EmptyDescription>
					Try a different search or clear the filters.
				</EmptyDescription>
			</EmptyHeader>
			<Button variant="outline">Clear filters</Button>
		</Empty>
	),
};
export const Unavailable: Story = {
	render: () => (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<UnplugIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>Files unavailable</EmptyTitle>
				<EmptyDescription>
					The project folder could not be opened. Check its location in project
					settings.
				</EmptyDescription>
			</EmptyHeader>
			<Button variant="outline">Project settings</Button>
		</Empty>
	),
};
