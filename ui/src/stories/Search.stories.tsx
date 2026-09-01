import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CommonspaceSearchDialog } from "@/CommonspaceSearch";
import { storyBootstrap } from "@/storybook-fixtures";

const fetcher = async () =>
	new Response(
		JSON.stringify({
			query: "",
			results: [],
			appliedFilters: { kinds: [], projectId: null },
			truncated: false,
		}),
		{ headers: { "content-type": "application/json" } },
	);
const meta = {
	title: "Overlays/Search",
	component: CommonspaceSearchDialog,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
	args: {
		projects: storyBootstrap.state.projects,
		onClose: fn(),
		onSelect: fn(),
		fetcher,
	},
} satisfies Meta<typeof CommonspaceSearchDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EmptyQuery: Story = {};
