import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommonspaceProjectFiles } from "../CommonspaceProjectFiles";
import {
	emptyProjectFetcher,
	errorProjectFetcher,
	primaryProject,
	storyProjectFetcher,
} from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceProjectFiles",
	component: CommonspaceProjectFiles,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen min-h-[720px] w-full">
				<Story />
			</div>
		),
	],
	args: {
		projectId: primaryProject.id,
		roots: primaryProject.paths,
		fetcher: storyProjectFetcher,
	},
} satisfies Meta<typeof CommonspaceProjectFiles>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrowseWorkspace: Story = {};

export const OpenTextFile: Story = {
	args: { targetFile: { rootIndex: 0, path: "README.md" } },
};

export const EmptyFolder: Story = {
	args: { fetcher: emptyProjectFetcher },
};

export const NoProjectFolder: Story = {
	args: { roots: [] },
};

export const RequestFailed: Story = {
	args: { fetcher: errorProjectFetcher },
};
