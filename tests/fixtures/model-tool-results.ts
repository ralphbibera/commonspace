import type { ModelRequest } from "./anthropic-model-server.ts";

type ModelJson = ModelRequest["messages"][number];

function* objects(value: ModelJson): Generator<Record<string, ModelJson>> {
	if (value === null || typeof value !== "object") return;
	if (Array.isArray(value)) {
		for (const item of value) yield* objects(item);
		return;
	}
	yield value;
	for (const item of Object.values(value)) yield* objects(item);
}

/** Recognize actual Anthropic or Gemini tool results, including provider-specific prefixes. */
export function hasModelToolResult(
	request: ModelRequest,
	name: string,
): boolean {
	const entries = [...objects(request.messages)];
	const ids = new Set(
		entries
			.filter(
				(entry) =>
					entry.type === "tool_use" &&
					typeof entry.name === "string" &&
					entry.name.endsWith(name),
			)
			.flatMap((entry) => (typeof entry.id === "string" ? [entry.id] : [])),
	);
	return entries.some((entry) => {
		if (
			entry.type === "tool_result" &&
			typeof entry.tool_use_id === "string" &&
			ids.has(entry.tool_use_id)
		)
			return true;
		const result = entry.functionResponse;
		return (
			result !== null &&
			typeof result === "object" &&
			!Array.isArray(result) &&
			typeof result.name === "string" &&
			result.name.endsWith(name)
		);
	});
}
