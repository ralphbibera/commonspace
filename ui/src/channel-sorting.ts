export type ChannelSortMode = "alphabetical" | "custom" | "recent";

interface SortableChannel {
	id: string;
	name: string;
	createdAt: string;
}

interface SortableSidebarItem {
	id: string;
}

interface SortSidebarSectionsOptions<Item extends SortableSidebarItem> {
	items: readonly Item[];
	pinnedIds: ReadonlySet<string>;
	mode: ChannelSortMode;
	customOrder: readonly string[];
	recentOrder: readonly string[];
	getName: (item: Item) => string;
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
	const recentOrder = [...channels]
		.sort((left, right) => {
			const leftActive = lastActiveAt.get(left.id) ?? left.createdAt;
			const rightActive = lastActiveAt.get(right.id) ?? right.createdAt;
			return rightActive.localeCompare(leftActive);
		})
		.map((channel) => channel.id);
	return sortSidebarSections({
		items: channels,
		pinnedIds,
		mode,
		customOrder,
		recentOrder,
		getName: (channel) => channel.name,
	});
}

export function sortSidebarSections<Item extends SortableSidebarItem>({
	items,
	pinnedIds,
	mode,
	customOrder,
	recentOrder,
	getName,
}: SortSidebarSectionsOptions<Item>): {
	pinned: Item[];
	unpinned: Item[];
} {
	const allIds = items.map((item) => item.id);
	const customRank = new Map(
		completeChannelOrder(customOrder, allIds).map((id, index) => [id, index]),
	);
	const recentRank = new Map(
		completeChannelOrder(recentOrder, allIds).map((id, index) => [id, index]),
	);
	const sorted = [...items].sort((left, right) => {
		if (mode === "alphabetical")
			return getName(left).localeCompare(getName(right), undefined, {
				sensitivity: "base",
				numeric: true,
			});
		if (mode === "custom")
			return (customRank.get(left.id) ?? 0) - (customRank.get(right.id) ?? 0);
		return (recentRank.get(left.id) ?? 0) - (recentRank.get(right.id) ?? 0);
	});

	return {
		pinned: sorted.filter((channel) => pinnedIds.has(channel.id)),
		unpinned: sorted.filter((channel) => !pinnedIds.has(channel.id)),
	};
}
