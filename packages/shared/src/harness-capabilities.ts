/** Browser-safe native inventory metadata. Never includes configuration or memory contents. */
export interface HarnessCapabilityItem {
	name: string;
	description?: string;
	status: "configured" | "enabled" | "disabled" | "unknown";
}

export interface HarnessCapabilityGroup {
	id: "tools" | "mcp" | "skills" | "plugins" | "memory" | "agents";
	status: "available" | "unavailable" | "error";
	source: string;
	notice: string;
	items: HarnessCapabilityItem[];
}

/** Ephemeral inspection; separate from profiles, bootstrap, and portable exports. */
export interface HarnessCapabilityInventory {
	agentId: string;
	checkedAt: string;
	groups: HarnessCapabilityGroup[];
}
