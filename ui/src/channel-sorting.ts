export type ChannelSortMode = "alphabetical" | "custom" | "recent";

interface SortableChannel {
	id: string;
	name: string;
	createdAt: string;
}

interface SortChannelSectionsOptions<Channel extends SortableChannel> {
	channels: readonly Channel[];
	pinnedIds: ReadonlySet<string>;
	mode: ChannelSortMode;
	customOrder: readonly string[];
	lastActiveAt: ReadonlyMap<string, string>;
}

function completeChannelOrder(
	customOrder: readonly string[],
	allIds: readonly string[],
): string[] {
	const validIds = new Set(allIds);
	return [...new Set([...customOrder, ...allIds])].filter((id) =>
		validIds.has(id),
	);
}

export function moveChannelBefore(
	customOrder: readonly string[],
	sourceId: string,
	targetId: string,
	allIds: readonly string[],
): string[] {
	const order = completeChannelOrder(customOrder, allIds);
	if (
		sourceId === targetId ||
		!order.includes(sourceId) ||
		!order.includes(targetId)
	)
		return order;
	const withoutSource = order.filter((id) => id !== sourceId);
	const targetIndex = withoutSource.indexOf(targetId);
	withoutSource.splice(targetIndex, 0, sourceId);
	return withoutSource;
}

export function moveChannelAfter(
	customOrder: readonly string[],
	sourceId: string,
	targetId: string,
	allIds: readonly string[],
): string[] {
	const order = completeChannelOrder(customOrder, allIds);
	if (
		sourceId === targetId ||
		!order.includes(sourceId) ||
		!order.includes(targetId)
	)
		return order;
	const withoutSource = order.filter((id) => id !== sourceId);
	const targetIndex = withoutSource.indexOf(targetId);
	withoutSource.splice(targetIndex + 1, 0, sourceId);
	return withoutSource;
}

export function sortChannelSections<Channel extends SortableChannel>({
	channels,
	pinnedIds,
	mode,
	customOrder,
	lastActiveAt,
}: SortChannelSectionsOptions<Channel>): {
	pinned: Channel[];
	unpinned: Channel[];
} {
	const customRank = new Map(
		completeChannelOrder(
			customOrder,
			channels.map((channel) => channel.id),
		).map((id, index) => [id, index]),
	);
	const sorted = [...channels].sort((left, right) => {
		if (mode === "alphabetical")
			return left.name.localeCompare(right.name, undefined, {
				sensitivity: "base",
				numeric: true,
			});
		if (mode === "custom")
			return (customRank.get(left.id) ?? 0) - (customRank.get(right.id) ?? 0);
		const leftActive = lastActiveAt.get(left.id) ?? left.createdAt;
		const rightActive = lastActiveAt.get(right.id) ?? right.createdAt;
		return rightActive.localeCompare(leftActive);
	});

	return {
		pinned: sorted.filter((channel) => pinnedIds.has(channel.id)),
		unpinned: sorted.filter((channel) => !pinnedIds.has(channel.id)),
	};
}
