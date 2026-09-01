// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommonspaceDirectory } from "../ui/src/CommonspaceDirectory.tsx";
import {
	createStoryStore,
	storyBootstrap,
} from "../ui/src/storybook-fixtures.ts";

afterEach(cleanup);

describe("Commonspace collection directory", () => {
	it("filters and opens the complete desktop project directory", () => {
		const store = createStoryStore();
		const onOpenProject = vi.fn();
		render(
			<CommonspaceDirectory
				kind="projects"
				bootstrap={storyBootstrap}
				store={store}
				onAdd={vi.fn()}
				onOpenProject={onOpenProject}
				onOpenConversation={vi.fn()}
				onOpenSettings={vi.fn()}
			/>,
		);

		expect(screen.getByRole("heading", { name: "All projects" })).toBeTruthy();
		expect(screen.getByText("2 projects")).toBeTruthy();
		fireEvent.change(
			screen.getByRole("searchbox", { name: "Filter projects" }),
			{ target: { value: "platform" } },
		);
		expect(
			screen.queryByRole("button", { name: "Open project Commonspace" }),
		).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Open project platform" }),
		);

		expect(store.getSnapshot().activeProjectId).toBe("platform");
		expect(onOpenProject).toHaveBeenCalledWith("platform");
	});

	it("uses a shadcn action menu and confirmation before removal", async () => {
		const mutate = vi.fn(async () => undefined);
		const store = { ...createStoryStore(), mutate };
		render(
			<CommonspaceDirectory
				kind="channels"
				bootstrap={storyBootstrap}
				store={store}
				onAdd={vi.fn()}
				onOpenProject={vi.fn()}
				onOpenConversation={vi.fn()}
				onOpenSettings={vi.fn()}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "More actions for general" }),
		);
		const menu = await screen.findByRole("menu");
		fireEvent.click(
			within(menu).getByRole("menuitem", { name: "Remove channel" }),
		);
		const dialog = await screen.findByRole("alertdialog", {
			name: "Remove general?",
		});
		expect(
			within(dialog).getByText(
				"This can be added again later. Existing local agent credentials stay untouched.",
			),
		).toBeTruthy();
		expect(mutate).not.toHaveBeenCalled();
		fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith({
				action: "remove-channel",
				channelId: "general",
			});
		});
	});
});
