/** @vitest-environment jsdom */

import type { CommonspaceTraceEntry } from "@commonspace/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AgentTraceTimeline } from "../ui/src/AgentTrace.tsx";

afterEach(cleanup);

describe("AgentTraceTimeline", () => {
	it("shows the most recently updated harness activity first", () => {
		const entries: CommonspaceTraceEntry[] = [
			{
				type: "tool",
				id: "oldest",
				title: "Inspect the workspace",
				toolName: "read_file",
				toolKind: "read",
				status: "completed",
				input: "read",
				createdAt: "2026-09-07T10:00:00.000Z",
				updatedAt: "2026-09-07T10:00:01.000Z",
			},
			{
				type: "tool",
				id: "newest",
				title: "Run the checks",
				toolName: "terminal",
				toolKind: "terminal",
				status: "in_progress",
				input: "pnpm check:fast",
				createdAt: "2026-09-07T10:00:02.000Z",
				updatedAt: "2026-09-07T10:00:03.000Z",
			},
		];

		render(<AgentTraceTimeline entries={entries} />);

		const items = screen.getAllByRole("listitem");
		expect(items.map((item) => item.textContent)).toEqual([
			expect.stringContaining("Run the checks"),
			expect.stringContaining("Inspect the workspace"),
		]);
		expect(entries.map((entry) => entry.id)).toEqual(["oldest", "newest"]);
	});
});
