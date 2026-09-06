import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileTextIcon, GitBranchIcon, SettingsIcon } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const meta = {
	title: "Foundations/Tabs",
	component: Tabs,
	parameters: { layout: "centered" },
	args: { defaultValue: "files", orientation: "horizontal" },
	argTypes: {
		orientation: {
			control: "inline-radio",
			options: ["horizontal", "vertical"],
		},
	},
	render: (args) => (
		<Tabs {...args} className="w-[560px] max-w-full">
			<TabsList aria-label="Project views">
				<TabsTrigger value="files">
					<FileTextIcon aria-hidden="true" />
					Files
				</TabsTrigger>
				<TabsTrigger value="changes">
					<GitBranchIcon aria-hidden="true" />
					Changes
				</TabsTrigger>
				<TabsTrigger value="settings" disabled>
					<SettingsIcon aria-hidden="true" />
					Settings
				</TabsTrigger>
			</TabsList>
			<TabsContent value="files" className="rounded-md border p-5">
				Browse the files shared with this project.
			</TabsContent>
			<TabsContent value="changes" className="rounded-md border p-5">
				Review changes before continuing the conversation.
			</TabsContent>
		</Tabs>
	),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = {
	args: { orientation: "vertical" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const files = canvas.getByRole("tab", { name: "Files" });
		await userEvent.click(files);
		await userEvent.keyboard("{ArrowDown}");
		await expect(canvas.getByRole("tab", { name: "Changes" })).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(
			canvas.getByRole("tabpanel", { name: "Changes" }),
		).toBeVisible();
	},
};

export const Variants: Story = {
	render: () => (
		<div className="flex w-[560px] max-w-full flex-col gap-8">
			{(["default", "line", "project"] as const).map((variant) => (
				<Tabs key={variant} defaultValue="files">
					<TabsList variant={variant} aria-label={`${variant} project views`}>
						<TabsTrigger value="files">Files</TabsTrigger>
						<TabsTrigger value="changes">Changes</TabsTrigger>
					</TabsList>
					<TabsContent value="files" className="rounded-md border p-5">
						Project files · {variant} tabs
					</TabsContent>
					<TabsContent value="changes" className="rounded-md border p-5">
						Working tree changes
					</TabsContent>
				</Tabs>
			))}
		</div>
	),
};
