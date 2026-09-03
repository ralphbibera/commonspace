import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CommonspaceProjectView } from "@/CommonspaceProjectView";
import { createStoryStore, storyBootstrap } from "@/storybook-fixtures";

const projectWithoutFolders = {
	...storyBootstrap,
	state: {
		...storyBootstrap.state,
		projects: storyBootstrap.state.projects.map((project) =>
			project.id === "commonspace" ? { ...project, paths: [] } : project,
		),
	},
};

function json<Body>(body: Body) {
	return new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
	});
}
async function projectFetch(input: RequestInfo | URL) {
	const url = new URL(String(input), window.location.origin);
	if (url.pathname.endsWith("/files"))
		return json({
			projectId: "commonspace",
			rootIndex: 0,
			path: "",
			truncated: false,
			entries: [
				{ name: "ui", path: "ui", kind: "directory" },
				{ name: "server", path: "server", kind: "directory" },
				{ name: "packages", path: "packages", kind: "directory" },
				{
					name: "README.md",
					path: "README.md",
					kind: "file",
					size: 4700,
					preview: "text",
					contentType: "text/markdown; charset=utf-8",
				},
			],
		});
	if (url.pathname.endsWith("/file"))
		return new Response(
			"# Commonspace\n\nA local-first workspace for durable conversations with coding agents.\n",
			{ headers: { "content-type": "text/markdown; charset=utf-8" } },
		);
	if (url.pathname.endsWith("/changes"))
		return json({
			available: true,
			branch: "main",
			head: "09d535dc4c",
			clean: false,
			truncated: false,
			files: [
				{
					path: "ui/src/CommonspaceSidebar.tsx",
					status: "modified",
					indexStatus: " ",
					worktreeStatus: "M",
					additions: 29,
					deletions: 26,
					preview: "text",
				},
			],
		});
	if (url.pathname.endsWith("/diff"))
		return json({
			path: "ui/src/CommonspaceSidebar.tsx",
			binary: false,
			truncated: false,
			patch:
				"--- a/ui/src/CommonspaceSidebar.tsx\n+++ b/ui/src/CommonspaceSidebar.tsx\n@@ -1 +1 @@\n-legacy shell\n+storybook-owned shell\n",
		});
	throw new Error(`Unexpected project story request: ${url.toString()}`);
}

function ProjectPreview({ empty = false }: { empty?: boolean }) {
	return (
		<div className="h-screen">
			<CommonspaceProjectView
				projectId="commonspace"
				store={createStoryStore(empty ? projectWithoutFolders : storyBootstrap)}
				onBack={fn()}
				onOpenConversation={fn()}
				fetcher={projectFetch}
			/>
		</div>
	);
}

const meta = {
	title: "Screens/Project",
	component: ProjectPreview,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
} satisfies Meta<typeof ProjectPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Files: Story = {
	tags: ["smoke"],
	args: { empty: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole("button", { name: "Open file README.md" }),
		);
		await expect(
			await canvas.findByText(/^# Commonspace/u),
		).toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole("button", { name: "More actions for README.md" }),
		);
		const menu = await within(document.body).findByRole("menu");
		await expect(
			within(menu).getByRole("menuitem", { name: "Copy name" }),
		).toBeInTheDocument();
	},
};
export const Changes: Story = {
	args: { empty: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("tab", { name: "Changes" }));
		await expect(await canvas.findByText("main")).toBeInTheDocument();
		await expect(await canvas.findByText("+29")).toBeInTheDocument();
	},
};
export const EmptyFolder: Story = { args: { empty: true } };
export const SettingsPanel: Story = {
	args: { empty: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Open project settings" }),
		);
		await expect(
			canvas.getByRole("complementary", { name: "Project settings" }),
		).toBeInTheDocument();
	},
};
