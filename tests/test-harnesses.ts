import type {
	AgentAdapterKind,
	CommonspaceAgentProfile,
} from "@commonspace/shared";
import type { CommonspaceHostService } from "../server/src/service.ts";
import { mustExist } from "./test-helpers.ts";

export async function discoverTestHarnesses(
	adapter: AgentAdapterKind,
): Promise<CommonspaceAgentProfile[]> {
	const displayName = adapter === "codex" ? "Codex" : "Hermes";
	return [
		{
			id: adapter,
			displayName,
			adapter,
			model: null,
			status: "stopped",
			description: `Installed ${displayName} harness.`,
		},
	];
}

export async function addTestHarness(
	service: CommonspaceHostService,
	adapter: AgentAdapterKind,
	displayName?: string,
): Promise<CommonspaceAgentProfile> {
	const discovered = (await service.discoverAgents(adapter)).discoveredAgents;
	const harness = discovered.find((candidate) => candidate.adapter === adapter);
	if (harness === undefined) throw new Error(`missing ${adapter} test harness`);
	await service.mutate({ action: "add-discovered-agent", agentId: harness.id });
	if (displayName !== undefined && displayName !== harness.displayName) {
		await service.mutate({
			action: "update-agent-profile",
			agentId: harness.id,
			displayName,
		});
	}
	return mustExist(
		(await service.bootstrap()).agents.find(
			(candidate) => candidate.id === harness.id,
		),
	);
}
