import { describe, expect, it } from "vitest";
import { applyProjectMutation } from "../server/src/state/project-mutations.ts";
import { createInitialState } from "../server/src/state.ts";

const dependencies = {
	ids: () => "project-1",
	now: () => "2026-08-25T00:00:00.000Z",
};

function stateWithProject() {
	return applyProjectMutation(
		createInitialState(),
		{
			action: "create-project",
			name: "Checkout App",
			paths: [" /tmp/checkout-a ", "/tmp/checkout-a"],
		},
		dependencies,
	);
}

describe("project mutations", () => {
	it("normalizes and deduplicates filesystem roots when creating a project", () => {
		const state = stateWithProject();

		expect(state.projects).toEqual([
			{
				id: "project-1",
				name: "Checkout App",
				paths: ["/tmp/checkout-a"],
				createdAt: "2026-08-25T00:00:00.000Z",
			},
		]);
		expect(state.revision).toBe(1);
	});

	it("rejects project names that resolve to the same tag", () => {
		const state = stateWithProject();

		expect(() =>
			applyProjectMutation(
				state,
				{
					action: "create-project",
					name: "checkout-app",
					paths: ["/tmp/checkout-b"],
				},
				dependencies,
			),
		).toThrow("project name already exists");
	});

	it("adds a new normalized path exactly once", () => {
		const state = stateWithProject();
		const changed = applyProjectMutation(
			state,
			{
				action: "add-project-path",
				projectId: "project-1",
				path: " /tmp/checkout-b ",
			},
			dependencies,
		);

		expect(changed.projects[0]?.paths).toEqual([
			"/tmp/checkout-a",
			"/tmp/checkout-b",
		]);
		expect(changed.revision).toBe(2);
		expect(
			applyProjectMutation(
				changed,
				{
					action: "add-project-path",
					projectId: "project-1",
					path: " /tmp/checkout-b ",
				},
				dependencies,
			),
		).toBe(changed);
	});

	it("rejects a path mutation for an unknown project", () => {
		expect(() =>
			applyProjectMutation(
				createInitialState(),
				{
					action: "add-project-path",
					projectId: "missing",
					path: "/tmp/missing",
				},
				dependencies,
			),
		).toThrow("unknown project");
	});
});
