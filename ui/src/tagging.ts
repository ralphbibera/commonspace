import type { CommonspaceBootstrap } from "@commonspace/shared";
import { agentMentionName, projectTagName } from "@commonspace/shared";

export type TagKind = "agent" | "project" | "channel" | "text";

export interface TagReferencePart {
	text: string;
	kind: TagKind;
}

export interface TagSuggestion {
	kind: Exclude<TagKind, "text">;
	id: string;
	label: string;
	token: string;
	channelMembership?: "member" | "outside";
}

const referencePattern =
	/(^|[^\p{L}\p{N}_@])(@@|@|#)([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
const activeTokenPattern = /(^|\s)(@@|@|#)([\p{L}\p{N}][\p{L}\p{N}_-]*)?$/u;

export function tagReferenceParts(
	text: string,
	bootstrap?: CommonspaceBootstrap,
): TagReferencePart[] {
	const parts: TagReferencePart[] = [];
	const pushPart = (part: TagReferencePart) => {
		const previous = parts.at(-1);
		if (part.kind === "text" && previous?.kind === "text")
			previous.text += part.text;
		else parts.push(part);
	};
	let cursor = 0;
	for (const match of text.matchAll(referencePattern)) {
		const lead = match[1] ?? "";
		const marker = match[2] ?? "";
		const value = match[3] ?? "";
		if (match.index === undefined) continue;
		const start = match.index + lead.length;
		if (start > cursor)
			pushPart({ text: text.slice(cursor, start), kind: "text" });
		const kind: Exclude<TagKind, "text"> =
			marker === "@@" ? "project" : marker === "@" ? "agent" : "channel";
		const normalizedValue = value.toLocaleLowerCase();
		const known =
			bootstrap === undefined ||
			(kind === "agent" &&
				(normalizedValue === "all" ||
					bootstrap.agents.some(
						(agent) => agentMentionName(agent) === normalizedValue,
					))) ||
			(kind === "project" &&
				bootstrap.state.projects.some(
					(project) =>
						project.id.toLocaleLowerCase() === normalizedValue ||
						projectTagName(project.name) === normalizedValue,
				)) ||
			(kind === "channel" &&
				bootstrap.state.channels.some(
					(channel) =>
						channel.id.toLocaleLowerCase() === normalizedValue ||
						channel.name.toLocaleLowerCase() === normalizedValue,
				));
		pushPart({ text: marker + value, kind: known ? kind : "text" });
		cursor = start + marker.length + value.length;
	}
	if (cursor < text.length)
		pushPart({ text: text.slice(cursor), kind: "text" });
	return parts.length === 0 ? [{ text, kind: "text" }] : parts;
}

export function tagSuggestions(
	text: string,
	bootstrap: CommonspaceBootstrap,
	channelAgentIds?: readonly string[],
): TagSuggestion[] {
	const match = text.match(activeTokenPattern);
	if (match === null) return [];
	const prefix = match[2];
	const query = (match[3] ?? "").toLocaleLowerCase();
	if (prefix === "@") {
		const agents = bootstrap.agents
			.map((agent) => ({ agent, tagName: agentMentionName(agent) }))
			.filter(
				({ agent, tagName }) =>
					tagName.startsWith(query) ||
					agent.displayName.toLocaleLowerCase().startsWith(query),
			)
			.map(({ agent, tagName }) => ({
				kind: "agent" as const,
				id: agent.id,
				label: agent.displayName,
				token: `@${tagName}`,
				...(channelAgentIds === undefined
					? {}
					: {
							channelMembership: channelAgentIds.includes(agent.id)
								? ("member" as const)
								: ("outside" as const),
						}),
			}))
			.sort((left, right) =>
				left.channelMembership === right.channelMembership ||
				left.channelMembership === undefined
					? 0
					: left.channelMembership === "member"
						? -1
						: 1,
			);
		const all = "all".startsWith(query)
			? [
					{
						kind: "agent" as const,
						id: "all",
						label: "All agents",
						token: "@all",
						...(channelAgentIds === undefined
							? {}
							: { channelMembership: "member" as const }),
					},
				]
			: [];
		return [...all, ...agents].slice(0, 6);
	}
	if (prefix === "@@") {
		return bootstrap.state.projects
			.map((project) => ({ project, tagName: projectTagName(project.name) }))
			.filter(
				({ project, tagName }) =>
					tagName.startsWith(query) ||
					project.name.toLocaleLowerCase().startsWith(query),
			)
			.slice(0, 6)
			.map(({ project, tagName }) => ({
				kind: "project" as const,
				id: project.id,
				label: project.name,
				token: `@@${tagName}`,
			}));
	}
	return bootstrap.state.channels
		.filter(
			(channel) =>
				channel.id.toLocaleLowerCase().startsWith(query) ||
				channel.name.toLocaleLowerCase().startsWith(query),
		)
		.slice(0, 6)
		.map((channel) => ({
			kind: "channel" as const,
			id: channel.id,
			label: channel.name,
			token: `#${channel.name}`,
		}));
}

export function insertTag(text: string, token: string): string {
	return text.replace(
		activeTokenPattern,
		(_whole, whitespace: string) => `${whitespace}${token} `,
	);
}
