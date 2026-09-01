// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionActionMenu } from "../ui/src/design-system/CollectionActionMenu.tsx";
import { ResourceActionMenu } from "../ui/src/design-system/ResourceActionMenu.tsx";

afterEach(cleanup);

describe("collection context actions", () => {
	it("exposes the complete agent workflow menu", async () => {
		const startFresh = vi.fn();
		const mention = vi.fn();
		const viewSessions = vi.fn();
		const copyMention = vi.fn();
		render(
			<CollectionActionMenu
				kind="agent"
				label="AgentOps"
				meta="Hermes · online"
				onOpen={vi.fn()}
				onStartFreshChat={startFresh}
				onMention={mention}
				mentionLabel="Mention in #general"
				onViewSessions={viewSessions}
				onCopy={copyMention}
				copyLabel="Copy mention"
				onSettings={vi.fn()}
				onRemove={vi.fn()}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "More actions for AgentOps" }),
		);
		const menu = await screen.findByRole("menu");
		expect(
			within(menu).getByRole("menuitem", { name: /Start fresh chat/u }),
		).toBeTruthy();
		expect(
			within(menu).getByRole("menuitem", { name: /Mention in #general/u }),
		).toBeTruthy();
		expect(
			within(menu).getByRole("menuitem", { name: /View sessions/u }),
		).toBeTruthy();
		expect(
			within(menu).getByRole("menuitem", { name: /Copy mention/u }),
		).toBeTruthy();
		fireEvent.click(
			within(menu).getByRole("menuitem", { name: /Start fresh chat/u }),
		);
		const confirmation = await screen.findByRole("alertdialog", {
			name: "Start a new chat with AgentOps?",
		});
		expect(startFresh).not.toHaveBeenCalled();
		fireEvent.click(
			within(confirmation).getByRole("button", { name: "Start fresh" }),
		);
		expect(startFresh).toHaveBeenCalledOnce();
	});

	it("wires channel read state and project copying", async () => {
		const markRead = vi.fn();
		const { unmount } = render(
			<CollectionActionMenu
				kind="channel"
				label="general"
				meta="2 unread"
				unread
				onOpen={vi.fn()}
				onMarkRead={markRead}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "More actions for general" }),
		);
		fireEvent.click(
			within(await screen.findByRole("menu")).getByRole("menuitem", {
				name: "Mark read",
			}),
		);
		expect(markRead).toHaveBeenCalledOnce();

		const copyProject = vi.fn();
		unmount();
		render(
			<CollectionActionMenu
				kind="project"
				label="Commonspace"
				meta="1 folder"
				onOpen={vi.fn()}
				onCopy={copyProject}
				copyLabel="Copy project name"
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "More actions for Commonspace" }),
		);
		fireEvent.click(
			within(await screen.findByRole("menu")).getByRole("menuitem", {
				name: "Copy project name",
			}),
		);
		expect(copyProject).toHaveBeenCalledOnce();
	});

	it("covers thread and file context actions", async () => {
		const follow = vi.fn();
		const markRead = vi.fn();
		const copy = vi.fn();
		const { unmount } = render(
			<ResourceActionMenu
				kind="thread"
				label="Investigate release"
				meta="#general"
				following={false}
				unread
				onOpen={vi.fn()}
				onToggleFollow={follow}
				onMarkRead={markRead}
				onCopy={copy}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "More actions for Investigate release",
			}),
		);
		let menu = await screen.findByRole("menu");
		expect(
			within(menu).getByRole("menuitem", { name: "Follow thread" }),
		).toBeTruthy();
		expect(
			within(menu).getByRole("menuitem", { name: "Mark read" }),
		).toBeTruthy();

		unmount();
		render(
			<ResourceActionMenu
				kind="file"
				label="README.md"
				meta="File"
				onOpen={vi.fn()}
				onCopy={copy}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "More actions for README.md" }),
		);
		menu = await screen.findByRole("menu");
		expect(
			within(menu).getByRole("menuitem", { name: "Copy name" }),
		).toBeTruthy();
	});
});
