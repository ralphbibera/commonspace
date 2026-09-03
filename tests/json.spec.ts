import { describe, expect, it } from "vitest";
import { parseJsonObject } from "../server/src/json.ts";

describe("parseJsonObject", () => {
	it("returns a validated JSON object", () => {
		expect(parseJsonObject('{"name":"Commonspace","revision":25}')).toEqual({
			name: "Commonspace",
			revision: 25,
		});
	});

	it("returns null for malformed JSON and non-object JSON values", () => {
		expect(parseJsonObject("not-json")).toBeNull();
		expect(parseJsonObject("[]")).toBeNull();
		expect(parseJsonObject("null")).toBeNull();
	});
});
