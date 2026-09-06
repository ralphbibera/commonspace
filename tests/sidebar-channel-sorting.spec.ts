import { describe, expect, it } from "vitest";
import {
	moveChannelAfter,
	moveChannelBefore,
	sortChannelSections,
	sortSidebarSections,
} from "../ui/src/channel-sorting.ts";

const channels = [
	{ id: "bravo", name: "Bravo", createdAt: "2026-09-01T10:00:00.000Z" },
	{ id: "alpha", name: "alpha", createdAt: "2026-09-01T11:00:00.000Z" },
	{ id: "delta", name: "Delta", createdAt: "2026-09-01T12:00:00.000Z" },
	{ id: "charlie", name: "charlie", createdAt: "2026-09-01T13:00:00.000Z" },
];
const pinnedIds = new Set(["bravo", "alpha"]);
const lastActiveAt = new Map([
	["bravo", "2026-09-03T10:00:00.000Z"],
	["alpha", "2026-09-02T10:00:00.000Z"],
	["delta", "2026-09-01T10:00:00.000Z"],
	["charlie", "2026-09-04T10:00:00.000Z"],
]);

describe("shared channel sorting", () => {
	it("sorts any sidebar collection alphabetically within pinned sections", () => {
		const projects = [
			{ id: "platform", name: "Platform" },
			{ id: "commonspace", name: "Commonspace" },
			{ id: "agents", name: "Agents" },
		];

		const result = sortSidebarSections({
			items: projects,
			pinnedIds: new Set(["platform"]),
			mode: "alphabetical",
			customOrder: [],
			recentOrder: [],
			getName: (project) => project.name,
		});

		expect(result.pinned.map((project) => project.id)).toEqual(["platform"]);
		expect(result.unpinned.map((project) => project.id)).toEqual([
			"agents",
			"commonspace",
		]);
	});

	it("applies A–Z to pinned and unpinned sections", () => {
		const result = sortChannelSections({
			channels,
			pinnedIds,
			mode: "alphabetical",
			customOrder: [],
			lastActiveAt,
		});

		expect(result.pinned.map((channel) => channel.id)).toEqual([
			"alpha",
			"bravo",
		]);
		expect(result.unpinned.map((channel) => channel.id)).toEqual([
			"charlie",
			"delta",
		]);
	});

	it("applies last-active ordering to pinned and unpinned sections", () => {
		const result = sortChannelSections({
			channels,
			pinnedIds,
			mode: "recent",
			customOrder: [],
			lastActiveAt,
		});

		expect(result.pinned.map((channel) => channel.id)).toEqual([
			"bravo",
			"alpha",
		]);
		expect(result.unpinned.map((channel) => channel.id)).toEqual([
			"charlie",
			"delta",
		]);
	});

	it("applies one custom order while preserving pinned section membership", () => {
		const result = sortChannelSections({
			channels,
			pinnedIds,
			mode: "custom",
			customOrder: ["alpha", "bravo", "delta", "charlie"],
			lastActiveAt,
		});

		expect(result.pinned.map((channel) => channel.id)).toEqual([
			"alpha",
			"bravo",
		]);
		expect(result.unpinned.map((channel) => channel.id)).toEqual([
			"delta",
			"charlie",
		]);
	});

	it("moves a dragged channel before its target without losing new channels", () => {
		expect(
			moveChannelBefore(
				["alpha", "bravo", "delta"],
				"delta",
				"alpha",
				channels.map((channel) => channel.id),
			),
		).toEqual(["delta", "alpha", "bravo", "charlie"]);
	});

	it("moves a dragged channel after its target so it can reach the end", () => {
		expect(
			moveChannelAfter(
				["alpha", "bravo", "delta"],
				"alpha",
				"charlie",
				channels.map((channel) => channel.id),
			),
		).toEqual(["bravo", "delta", "charlie", "alpha"]);
	});
});
