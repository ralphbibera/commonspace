import type {
	CommonspaceProject,
	CommonspaceSearchResponse,
	CommonspaceSearchResult,
} from "@commonspace/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommonspaceSearchDialog } from "../CommonspaceSearch";

const project: CommonspaceProject = {
	id: "platform",
	name: "Platform",
	paths: ["/workspace/platform"],
	createdAt: "2026-09-03T00:00:00.000Z",
};

const results: CommonspaceSearchResult[] = [
	{
		id: "channel-verification",
		kind: "channel",
		title: "#verification",
		detail: "Channel",
		receipt: "Channel",
		occurredAt: "2026-09-03T10:00:00.000Z",
		highlights: [],
		target: {
			kind: "conversation",
			conversation: { kind: "channel", id: "verification" },
		},
	},
	{
		id: "message-review",
		kind: "message",
		title: "Review the visual baseline",
		detail: "Ralph · verification",
		receipt: "verification",
		occurredAt: "2026-09-03T10:02:00.000Z",
		highlights: [],
		target: {
			kind: "conversation",
			conversation: { kind: "channel", id: "verification" },
			messageId: "message-review",
		},
	},
	{
		id: "file-baseline",
		kind: "file",
		title: "visual-baseline.png",
		detail: "image/png · 128 KB",
		receipt: "Platform",
		highlights: [],
		target: {
			kind: "project-file",
			projectId: "platform",
			rootIndex: 0,
			path: "visual-baseline.png",
		},
	},
];

const fetcher: typeof globalThis.fetch = async (input) => {
	const url = new URL(String(input), "http://storybook.local");
	const query = url.searchParams.get("q")?.trim().toLocaleLowerCase() ?? "";
	const filtered =
		query === ""
			? results
			: results.filter((result) =>
					`${result.title} ${result.detail}`
						.toLocaleLowerCase()
						.includes(query),
				);
	const response: CommonspaceSearchResponse = {
		query,
		results: filtered,
		appliedFilters: { kinds: [], projectId: null },
		truncated: false,
	};
	return new Response(JSON.stringify(response), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
};

const meta = {
	title: "Workspace/CommonspaceSearch",
	component: CommonspaceSearchDialog,
	parameters: { layout: "fullscreen" },
	args: {
		projects: [project],
		fetcher,
		onClose: fn(),
		onSelect: fn(),
	},
} satisfies Meta<typeof CommonspaceSearchDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Browse: Story = {};

export const QueryAndKeyboardSelection: Story = {
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		const input = body.getByRole("searchbox", { name: "Search Commonspace" });
		await userEvent.type(input, "verification");
		await expect(
			body.getByRole("option", { name: /Open Channel: #verification/iu }),
		).toBeVisible();
		await expect(
			body.getByRole("option", { name: /Open Channel: #verification/iu }),
		).not.toHaveTextContent(/Channel[\s\S]*Channel/iu);
		await userEvent.keyboard("{ArrowDown}");
		await expect(
			body.getByRole("option", {
				name: /Open Message: Review the visual baseline/iu,
			}),
		).toHaveAttribute("aria-selected", "true");
	},
};
