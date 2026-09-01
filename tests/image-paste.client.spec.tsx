// @vitest-environment jsdom

import {
	COMMONSPACE_STATE_VERSION,
	type CommonspaceMessage,
} from "@commonspace/shared";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommonspaceConversation } from "../ui/src/CommonspaceConversation.tsx";

function renderDirectMessage(messages: CommonspaceMessage[] = []) {
	const send = vi.fn(async () => undefined);
	const snapshot = {
		bootstrap: {
			agents: [
				{
					id: "codex-review-bot",
					displayName: "Review Bot",
					adapter: "codex" as const,
					model: null,
					status: "unknown" as const,
				},
			],
			discoveredAgents: [],
			state: {
				version: COMMONSPACE_STATE_VERSION,
				revision: 1,
				inboxReadAt: null,
				inboxReadMessageIds: [],
				defaults: {
					model: null,
					reasoning: "max" as const,
					maxAgentsPerTurn: 4,
					memoryThreads: 12,
				},
				agents: [],
				dmSessions: {},
				agentSessions: {},
				projects: [],
				channels: [],
				threads: [],
				messages: { "dm:codex-review-bot": messages },
			},
		},
		loading: false,
		sending: false,
		error: null,
		activeConversation: { kind: "dm" as const, id: "codex-review-bot" },
		activeProjectId: null,
		activeThreadId: null,
	};
	const store = {
		subscribe: () => () => undefined,
		getSnapshot: () => snapshot,
		messages: () => messages,
		send,
		mutate: vi.fn(async () => undefined),
		selectThread: vi.fn(),
	};
	render(<CommonspaceConversation store={store} />);
	return { send };
}

afterEach(cleanup);
beforeEach(() => {
	HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("chat image paste", () => {
	it("attaches and sends a normal local file without requiring a caption", async () => {
		const { send } = renderDirectMessage();
		const file = new File(["notes"], "notes.txt", { type: "text/plain" });
		const input = screen.getByLabelText("Attach files");

		fireEvent.change(input, { target: { files: [file] } });

		expect(await screen.findByText("notes.txt")).toBeTruthy();
		const sendButton = screen.getByRole<HTMLButtonElement>("button", {
			name: "Send message",
		});
		expect(sendButton.disabled).toBe(false);
		fireEvent.click(sendButton);

		await waitFor(() => {
			expect(send).toHaveBeenCalledWith(
				"",
				undefined,
				[],
				undefined,
				undefined,
				[
					{
						name: "notes.txt",
						mimeType: "text/plain",
						data: "bm90ZXM=",
					},
				],
			);
		});
	});

	it("attaches a pasted raster image and sends it without requiring a caption", async () => {
		const { send } = renderDirectMessage();
		const composer = screen.getByRole("textbox", {
			name: "Message Review Bot",
		});
		const image = new File(
			[Uint8Array.from([137, 80, 78, 71])],
			"clipboard.png",
			{ type: "image/png" },
		);

		fireEvent.paste(composer, { clipboardData: { files: [image] } });

		expect(
			await screen.findByRole("img", {
				name: "Pasted attachment clipboard.png",
			}),
		).toBeTruthy();
		const sendButton = screen.getByRole<HTMLButtonElement>("button", {
			name: "Send message",
		});
		expect(sendButton.disabled).toBe(false);
		fireEvent.click(sendButton);

		await waitFor(() => {
			expect(send).toHaveBeenCalledWith("", undefined, [
				{
					name: "clipboard.png",
					mimeType: "image/png",
					data: "iVBORw==",
				},
			]);
		});
	});

	it("renders persisted pasted images from the trusted local attachment endpoint", () => {
		renderDirectMessage([
			{
				id: "message-1",
				conversation: { kind: "dm", id: "codex-review-bot" },
				authorType: "user",
				authorId: "user",
				authorName: "Ralph",
				text: "",
				createdAt: "2026-08-27T00:00:00.000Z",
				attachments: [
					{
						id: "123e4567-e89b-42d3-a456-426614174000",
						name: "clipboard.png",
						mimeType: "image/png",
						size: 4,
					},
				],
			},
		]);

		const image = screen.getByRole("img", { name: "clipboard.png" });
		expect(image.getAttribute("src")).toBe(
			"/api/attachments/123e4567-e89b-42d3-a456-426614174000",
		);
	});

	it("renders persisted files as safe local downloads", () => {
		renderDirectMessage([
			{
				id: "message-file",
				conversation: { kind: "dm", id: "codex-review-bot" },
				authorType: "user",
				authorId: "user",
				authorName: "Ralph",
				text: "Attached notes.",
				createdAt: "2026-08-31T00:00:00.000Z",
				files: [
					{
						id: "123e4567-e89b-42d3-a456-426614174001",
						name: "notes.txt",
						mimeType: "text/plain",
						size: 18,
					},
				],
			},
		]);

		const download = screen.getByRole("link", { name: "Download notes.txt" });
		expect(download.getAttribute("href")).toBe(
			"/api/files/123e4567-e89b-42d3-a456-426614174001",
		);
		expect(screen.getByText("text/plain · 18 B")).toBeTruthy();
	});
});
