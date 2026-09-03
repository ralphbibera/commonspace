import { z } from "zod";

const jsonValueSchema = z.json();
const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

export type JsonValue = z.infer<typeof jsonValueSchema>;
export type JsonObject = z.infer<typeof jsonObjectSchema>;

export function parseJsonObject(text: string): JsonObject | null {
	try {
		const value: unknown = JSON.parse(text);
		const parsed = jsonObjectSchema.safeParse(value);
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function jsonObject(value: JsonValue | undefined): JsonObject | null {
	const parsed = jsonObjectSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}
