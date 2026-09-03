import { describe, expect, it } from "vitest";
import {
	parseActivityEventData,
	parseRevisionEventData,
} from "../ui/src/commonspace-store.ts";

const validActivity = {
	id: "activity-1",
	sourceMessageId: "message-1",
	agentId: "agent-1",
	agentName: "Review Bot",
	adapter: "hermes",
	conversation: { kind: "channel", id: "channel-1" },
	startedAt: "2026-09-03T10:00:00.000Z",
	entries: [
		{
			type: "reasoning",
			id: "reasoning-1",
			text: "Inspecting the requested change.",
			createdAt: "2026-09-03T10:00:01.000Z",
			updatedAt: "2026-09-03T10:00:02.000Z",
		},
	],
};

const validQueuedFollowup = {
	messageId: "message-2",
	conversation: { kind: "dm", id: "agent-1" },
	agentIds: ["agent-1"],
	text: "Run the focused checks next.",
	position: 0,
	createdAt: "2026-09-03T10:00:03.000Z",
	delivery: "queue",
};

const validActivityEvent = {
	activities: [validActivity],
	queuedFollowups: [validQueuedFollowup],
};

describe("Commonspace live event decoding", () => {
	it("accepts a non-negative integer revision and rejects malformed frames", () => {
		expect(parseRevisionEventData('{"revision":42}')).toBe(42);
		expect(parseRevisionEventData('{"revision":4.2}')).toBeNull();
		expect(parseRevisionEventData("not-json")).toBeNull();
	});

	it("accepts complete live activities and queued follow-ups", () => {
		expect(parseActivityEventData(JSON.stringify(validActivityEvent))).toEqual(
			validActivityEvent,
		);
	});

	it("rejects an activity event when a nested contract is malformed", () => {
		const invalidActivity = {
			...validActivityEvent,
			activities: [{ ...validActivity, startedAt: null }],
		};
		expect(parseActivityEventData(JSON.stringify(invalidActivity))).toBeNull();

		const invalidFollowup = {
			...validActivityEvent,
			queuedFollowups: [{ ...validQueuedFollowup, delivery: "later" }],
		};
		expect(parseActivityEventData(JSON.stringify(invalidFollowup))).toBeNull();
	});
});
