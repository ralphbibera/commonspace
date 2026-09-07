import type {
	CommonspaceBootstrap,
	SendMessageResponse,
} from "@commonspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommonspaceClientStore } from "../ui/src/commonspace-store.ts";
import { storyBootstrap } from "../ui/src/stories/story-fixtures.ts";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: Error) => void;
	const promise = new Promise<T>((onResolve, onReject) => {
		resolve = onResolve;
		reject = (reason) => onReject(reason);
	});
	return { promise, resolve, reject };
}

function jsonResponse(
	value: CommonspaceBootstrap | SendMessageResponse,
): Response {
	return new Response(JSON.stringify(value), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("CommonspaceClientStore message admission", () => {
	it("keeps the composer queue open and projects concurrent sends optimistically", async () => {
		const admissions = [deferred<Response>(), deferred<Response>()];
		const fetch = vi.fn((input: RequestInfo | URL) => {
			if (String(input) === "/api/bootstrap")
				return Promise.resolve(jsonResponse(storyBootstrap));
			return (
				admissions[fetch.mock.calls.length - 2]?.promise ?? Promise.reject()
			);
		});
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		store.selectConversation({ kind: "dm", id: "agent-hermes" });

		const first = store.send("First follow-up").catch(() => undefined);
		const second = store
			.send("Second follow-up", undefined, [], "queue")
			.catch(() => undefined);

		expect(fetch).toHaveBeenCalledTimes(3);
		expect(store.getSnapshot().sending).toBe(true);
		expect(store.getSnapshot().pendingSubmissions).toMatchObject([
			{ text: "First follow-up", status: "admitting" },
			{ text: "Second follow-up", status: "admitting", delivery: "queue" },
		]);

		admissions[1]?.reject(new Error("second failed"));
		await vi.waitFor(() => {
			expect(store.getSnapshot().pendingSubmissions[1]).toMatchObject({
				text: "Second follow-up",
				status: "failed",
				error: "second failed",
			});
		});
		expect(store.getSnapshot().sending).toBe(true);

		admissions[0]?.reject(new Error("first failed"));
		await Promise.all([first, second]);
		expect(store.getSnapshot().sending).toBe(false);
		expect(store.getSnapshot().pendingSubmissions).toHaveLength(2);
	});

	it("removes only the settled optimistic admission", async () => {
		const admission = deferred<Response>();
		const fetch = vi.fn((input: RequestInfo | URL) => {
			if (String(input) === "/api/bootstrap")
				return Promise.resolve(jsonResponse(storyBootstrap));
			return admission.promise;
		});
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		store.selectConversation({ kind: "dm", id: "agent-hermes" });
		const sending = store.send("Admit me");
		const pending = store.getSnapshot().pendingSubmissions[0];
		if (pending === undefined) throw new Error("pending submission missing");
		const state: CommonspaceBootstrap["state"] = {
			...structuredClone(storyBootstrap.state),
			revision: storyBootstrap.state.revision + 1,
		};
		const accepted = {
			id: "accepted-admission",
			conversation: { kind: "dm" as const, id: "agent-hermes" },
			authorType: "user" as const,
			authorId: "user",
			authorName: "Ralph",
			text: "Admit me",
			createdAt: "2026-09-07T12:00:00.000Z",
			replyStatus: "queued" as const,
		};
		state.messages["dm:agent-hermes"] = [
			...(state.messages["dm:agent-hermes"] ?? []),
			accepted,
		];
		admission.resolve(jsonResponse({ accepted, state }));

		await sending;
		expect(store.getSnapshot().pendingSubmissions).toEqual([]);
		expect(store.messages().at(-1)).toMatchObject({ id: "accepted-admission" });
		expect(store.getSnapshot().sending).toBe(false);
		expect(pending.id).toMatch(/^submission-/u);
	});

	it("dismisses a failed admission without affecting other pending sends", async () => {
		const admissions = [deferred<Response>(), deferred<Response>()];
		const fetch = vi.fn((input: RequestInfo | URL) => {
			if (String(input) === "/api/bootstrap")
				return Promise.resolve(jsonResponse(storyBootstrap));
			return (
				admissions[fetch.mock.calls.length - 2]?.promise ?? Promise.reject()
			);
		});
		vi.stubGlobal("fetch", fetch);
		const store = new CommonspaceClientStore();
		await store.refresh();
		store.selectConversation({ kind: "dm", id: "agent-hermes" });
		const first = store.send("Restore this").catch(() => undefined);
		const second = store.send("Keep pending").catch(() => undefined);
		admissions[0]?.reject(new Error("offline"));
		await vi.waitFor(() => {
			expect(store.getSnapshot().pendingSubmissions[0]?.status).toBe("failed");
		});
		const failedId = store.getSnapshot().pendingSubmissions[0]?.id;
		if (failedId === undefined) throw new Error("failed submission missing");

		store.dismissPendingSubmission(failedId);
		expect(store.getSnapshot().pendingSubmissions).toMatchObject([
			{ text: "Keep pending", status: "admitting" },
		]);

		admissions[1]?.reject(new Error("cleanup"));
		await Promise.all([first, second]);
	});
});
