import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommonspaceProjectView } from "../CommonspaceProjectView";
import { COMMONSPACE_RESIZABLE_PANEL } from "../design-system/useResizablePanel";
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
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const settings = await canvas.findByRole("complementary", {
			name: "Project settings",
		});
		await expect(settings).toBeVisible();
		const resizer = canvas.queryByRole("separator", {
			name: "Resize settings",
		});
		if (resizer === null) {
			return;
		}
		const initial = Number(resizer.getAttribute("aria-valuenow"));
		resizer.focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect(resizer).toHaveAttribute(
			"aria-valuenow",
			String(
				Math.max(
					COMMONSPACE_RESIZABLE_PANEL.min,
					initial - COMMONSPACE_RESIZABLE_PANEL.step,
				),
			),
		);
		await userEvent.dblClick(resizer);
		await expect(resizer).toHaveAttribute(
			"aria-valuenow",
			String(COMMONSPACE_RESIZABLE_PANEL.defaultValue),
		);
	},
};

export const UnavailableProject: Story = {
	args: {
		projectId: "missing-project",
		store: createStoryStore(emptyBootstrap),
	},
};
