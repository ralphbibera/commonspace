import { stripVTControlCharacters } from "node:util";
import type {
	HarnessCapabilityGroup,
	HarnessCapabilityItem,
} from "@commonspace/shared";
import { z } from "zod";
import { readHarnessCommand } from "./discovery.js";

export type CapabilityId = HarnessCapabilityGroup["id"];

interface CapabilityProbe {
	id: CapabilityId;
	args: readonly string[];
	source: string;
	notice: string;
	parse: (output: string) => HarnessCapabilityItem[];
}

const SAFE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._:@()+-]{0,119}$/u;
const inventoryEntrySchema = z.looseObject({
	name: z.string().optional(),
	id: z.string().optional(),
	enabled: z.boolean().optional(),
	installed: z.boolean().optional(),
});
const inventorySchema = z.union([
	z.array(inventoryEntrySchema),
	z.object({ installed: z.array(inventoryEntrySchema) }),
]);

function safeItem(
	name: string | undefined,
	status: HarnessCapabilityItem["status"],
): HarnessCapabilityItem | undefined {
	if (typeof name !== "string") return undefined;
	const clean = name.trim();
	if (!SAFE_NAME.test(clean)) return undefined;
	return { name: clean, status };
}

export function parseNamedJsonInventory(
	output: string,
): HarnessCapabilityItem[] {
	const value = inventorySchema.parse(JSON.parse(output));
	const entries = Array.isArray(value) ? value : value.installed;
	return entries.flatMap((entry) => {
		const status =
			entry.enabled === true
				? "enabled"
				: entry.enabled === false
					? "disabled"
					: entry.installed === true
						? "configured"
						: "unknown";
		const item = safeItem(entry.name ?? entry.id, status);
		return item === undefined ? [] : [item];
	});
}

export function parseTerminalInventory(
	output: string,
): HarnessCapabilityItem[] {
	const items = new Map<string, HarnessCapabilityItem>();
	for (const rawLine of stripVTControlCharacters(output).split(/\r?\n/u)) {
		const line = rawLine.trim();
		const parsed = parseTerminalLine(line);
		if (parsed === undefined) continue;
		const { name, marker } = parsed;
		if (
			/^(name|source|status|installed skills|mcp servers|built-in toolsets|plugin toolsets|memory status)$/iu.test(
				name,
			)
		)
			continue;
		const status = terminalStatus(marker);
		const item = safeItem(name, status);
		if (item !== undefined) items.set(item.name, item);
	}
	if (
		items.size === 0 &&
		output.trim() !== "" &&
		!/(?:^|\n)\s*(?:no\s+|0\s+)[^\n]*(?:configured|installed|discovered|found|declare)/iu.test(
			output,
		)
	)
		throw new Error("Unsupported native inventory format");
	return [...items.values()];
}

function terminalStatus(
	marker: string | undefined,
): HarnessCapabilityItem["status"] {
	if (marker === "✗" || marker === "disabled" || marker === "failed")
		return "disabled";
	if (marker === "✓" || marker === "enabled" || marker === "connected")
		return "enabled";
	return "configured";
}

function terminalItem(name: string, marker: string | undefined) {
	return marker === undefined ? { name } : { name, marker };
}

function parseTerminalLine(
	line: string,
): { name: string; marker?: string } | undefined {
	const hermes = line.match(
		/^[✓✗]\s+(enabled|disabled)\s{2,}([\p{L}\p{N}][\p{L}\p{N}._:@()+-]*)/iu,
	);
	if (hermes !== null && hermes[2] !== undefined)
		return terminalItem(hermes[2], hermes[1]?.toLowerCase());
	const bullet = line.match(
		/^[●•*-]\s*([✓✗])?\s*([\p{L}\p{N}][\p{L}\p{N}._:@()+-]*)(?:\s+(enabled|disabled|connected|failed))?/iu,
	);
	if (bullet !== null && bullet[2] !== undefined)
		return terminalItem(bullet[2], bullet[1] ?? bullet[3]?.toLowerCase());
	const agent = line.match(/^([\p{L}\p{N}][\p{L}\p{N} ._:@()+-]*?)\s+·\s+/u);
	if (agent?.[1] !== undefined) return { name: agent[1] };
	const bracket = line.match(
		/^([\p{L}\p{N}][\p{L}\p{N} ._:@()+-]*?)\s+\[(Enabled|Disabled)\]/iu,
	);
	if (bracket?.[1] !== undefined)
		return terminalItem(bracket[1], bracket[2]?.toLowerCase());
	const table = line.match(
		/^│\s*([\p{L}\p{N}][\p{L}\p{N} ._:@()+-]*?)\s*│.*│\s*(enabled|disabled)\s*│$/iu,
	);
	if (table?.[1] !== undefined)
		return terminalItem(table[1], table[2]?.toLowerCase());
	const columns = line.match(
		/^([\p{L}\p{N}][\p{L}\p{N}._:@()+-]*)\s{2,}.*\s{2,}[✓✗]?\s*(enabled|disabled)$/iu,
	);
	if (columns?.[1] !== undefined)
		return terminalItem(columns[1], columns[2]?.toLowerCase());
	const labeled = line.match(
		/^([\p{L}\p{N}][\p{L}\p{N} ._:@()+-]*):\s+(enabled|disabled)\s*[✓✗]?$/iu,
	);
	return labeled?.[1] === undefined
		? undefined
		: terminalItem(labeled[1], labeled[2]?.toLowerCase());
}

export function unavailableGroup(
	id: CapabilityId,
	source: string,
	notice: string,
): HarnessCapabilityGroup {
	return { id, status: "unavailable", source, notice, items: [] };
}

export async function inspectCommandCapabilities(
	command: string,
	probes: readonly CapabilityProbe[],
	fallbacks: readonly HarnessCapabilityGroup[],
): Promise<HarnessCapabilityGroup[]> {
	const inspected = await Promise.all(
		probes.map(async (probe): Promise<HarnessCapabilityGroup> => {
			try {
				return {
					id: probe.id,
					status: "available",
					source: probe.source,
					notice: probe.notice,
					items: probe.parse(
						await readHarnessCommand(command, probe.args, undefined, {
							COLUMNS: "240",
							NO_COLOR: "1",
						}),
					),
				};
			} catch {
				return {
					id: probe.id,
					status: "error",
					source: probe.source,
					notice:
						"Native metadata inspection failed; no command output was exposed.",
					items: [],
				};
			}
		}),
	);
	const byId = new Map(
		[...fallbacks, ...inspected].map((group) => [group.id, group]),
	);
	return (
		["tools", "mcp", "skills", "plugins", "memory", "agents"] as const
	).map((id) => {
		const group = byId.get(id);
		if (group === undefined) throw new Error(`Missing capability group: ${id}`);
		return group;
	});
}
