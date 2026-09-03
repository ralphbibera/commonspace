import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceProjectView } from "../CommonspaceProjectView";
import {
	createStoryStore,
	emptyBootstrap,
	primaryProject,
	storyBootstrap,
	storyProjectFetcher,
} from "./story-fixtures";

const meta = {
	title: "Pages/CommonspaceProjectView",
	component: CommonspaceProjectView,
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
		store: createStoryStore(storyBootstrap),
		onBack: fn(),
		onOpenConversation: fn(),
		fetcher: storyProjectFetcher,
	},
} satisfies Meta<typeof CommonspaceProjectView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectFiles: Story = {};

export const FocusedFile: Story = {
	args: { targetFile: { rootIndex: 0, path: "README.md" } },
};

export const ProjectSettings: Story = {
	args: { settingsRequest: 1 },
};

export const UnavailableProject: Story = {
	args: {
		projectId: "missing-project",
		store: createStoryStore(emptyBootstrap),
	},
};
