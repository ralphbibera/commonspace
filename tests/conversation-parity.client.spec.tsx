// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommonspaceConversation } from "../ui/src/CommonspaceConversation.tsx";
import { createStoryStore } from "../ui/src/storybook-fixtures.ts";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});
beforeEach(() => {
	Element.prototype.scrollIntoView = vi.fn();
});

describe("desktop conversation parity", () => {
	it("opens full channel settings and persists visible member choices", async () => {
		const base = createStoryStore();
		const mutate = vi.fn(async () => undefined);
		const store = { ...base, mutate };
		store.selectConversation({ kind: "channel", id: "general" });
		render(
			<CommonspaceConversation
				store={store}
				settingsRequest={{ kind: "channel", id: "general", token: 1 }}
			/>,
		);

		const settings = screen.getByRole("complementary", {
			name: "Channel settings",
		});
		expect(within(settings).getByText("1 of 4 included")).toBeTruthy();
		fireEvent.change(
			within(settings).getByRole("searchbox", { name: "Search agents" }),
			{ target: { value: "backend" } },
		);
		fireEvent.click(
			within(settings).getByRole("button", { name: "Include visible" }),
		);
		fireEvent.click(
			within(settings).getByRole("button", { name: "Save changes" }),
		);

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledTimes(1);
			expect(mutate).toHaveBeenCalledWith({
				action: "set-channel-configuration",
				channelId: "general",
				agentIds: ["agentops", "backend"],
				instructions: "",
				model: null,
				reasoning: null,
				summary: "",
				decisions: [],
				openQuestions: [],
			});
		});
	});

	it("opens the complete native agent readback pane and saves local identity", async () => {
		const base = createStoryStore();
		const mutate = vi.fn(async () => undefined);
		const store = { ...base, mutate };
		store.selectConversation({ kind: "dm", id: "agentops" });
		render(
			<CommonspaceConversation
				store={store}
				settingsRequest={{ kind: "agent", id: "agentops", token: 1 }}
			/>,
		);

		const settings = screen.getByRole("complementary", {
			name: "Agent profile",
		});
		expect(
			within(settings).getByRole("heading", { name: "Harness configuration" }),
		).toBeTruthy();
		expect(
			within(settings).getByRole("heading", { name: "Capabilities" }),
		).toBeTruthy();
		fireEvent.change(within(settings).getByLabelText("Workspace name"), {
			target: { value: "Navigator" },
		});
		fireEvent.click(
			within(settings).getByRole("button", { name: "Save and verify" }),
		);

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith(
				expect.objectContaining({
					action: "update-agent-profile",
					agentId: "agentops",
					displayName: "Navigator",
				}),
			);
		});
	});

	it("shows date and unread boundaries and follows the active thread", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
		const base = createStoryStore();
		const mutate = vi.fn(async () => undefined);
		const store = { ...base, mutate };
		store.selectConversation({ kind: "channel", id: "general" });
		store.selectThread("thread-attention");
		render(<CommonspaceConversation store={store} />);

		expect(screen.getByText(/^Today ·/u)).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /new messages, mark read/u }),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Follow thread" }));

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith({
				action: "set-session-followed",
				sessionId: "root-attention:backend",
				followed: true,
			});
		});
	});

	it("offers the reference message context actions from each delivered post", async () => {
		const base = createStoryStore();
		const mutate = vi.fn(async () => undefined);
		const store = { ...base, mutate };
		store.selectConversation({ kind: "channel", id: "general" });
		render(<CommonspaceConversation store={store} />);

		const more = screen.getAllByRole("button", {
			name: "More actions for message from Ralph",
		})[0];
		expect(more).toBeDefined();
		if (more === undefined) return;
		fireEvent.click(more);
		const menu = await screen.findByRole("menu");
		expect(
			within(menu).getByRole("menuitem", { name: "Reply in thread" }),
		).toBeTruthy();
		expect(
			within(menu).getByRole("menuitem", { name: "Save for later" }),
		).toBeTruthy();
		expect(
			within(menu).getByRole("menuitem", { name: "Copy link" }),
		).toBeTruthy();
		fireEvent.click(
			within(menu).getByRole("menuitem", { name: "Save for later" }),
		);

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith({
				action: "set-inbox-item-saved",
				messageId: "root-running",
				saved: true,
			});
		});
	});
});
