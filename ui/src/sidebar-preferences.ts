import { useSyncExternalStore } from "react";
import type { ChannelSortMode } from "./channel-sorting.ts";

export type SidebarCollectionKind = "project" | "channel" | "agent";

export interface SidebarPreferencesSnapshot {
	pinnedKeys: string[];
	recentKeys: Record<SidebarCollectionKind, string[]>;
	collapsedSections: SidebarCollectionKind[];
	channelSortMode: ChannelSortMode;
	channelCustomOrder: string[];
	hasStoredPins: boolean;
}

type StoredValue =
	| null
	| string
	| string[]
	| Partial<Record<SidebarCollectionKind, string[]>>;

const PINNED_STORAGE_KEY = "commonspace-pins";
const RECENT_STORAGE_KEY = "commonspace-recent";
const COLLAPSED_STORAGE_KEY = "commonspace-collapsed-sections";
const CHANNEL_SORT_MODE_STORAGE_KEY = "commonspace-channel-sort-mode";
const CHANNEL_CUSTOM_ORDER_STORAGE_KEY = "commonspace-channel-custom-order";
const COLLECTION_KINDS: readonly SidebarCollectionKind[] = [
	"project",
	"channel",
	"agent",
];

function emptyRecentKeys(): Record<SidebarCollectionKind, string[]> {
	return { project: [], channel: [], agent: [] };
}

function storage(): Storage | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

function parseStoredValue(value: string): StoredValue | null {
	try {
		const parsed = JSON.parse(value);
		if (parsed === null || typeof parsed === "string") return parsed;
		if (
			Array.isArray(parsed) &&
			parsed.every((entry) => typeof entry === "string")
		)
			return parsed;
		if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
		const record: Partial<Record<SidebarCollectionKind, string[]>> = {};
		for (const kind of COLLECTION_KINDS) {
			const entries = parsed[kind];
			if (entries === undefined) continue;
			if (
				!Array.isArray(entries) ||
				!entries.every((entry) => typeof entry === "string")
			)
				return null;
			record[kind] = entries;
		}
		return record;
	} catch {
		return null;
	}
}

function readJson(key: string): StoredValue | null {
	const target = storage();
	if (target === null) return null;
	try {
		const value = target.getItem(key);
		return value === null ? null : parseStoredValue(value);
	} catch {
		return null;
	}
}

function writeJson(key: string, value: StoredValue): void {
	const target = storage();
	if (target === null) return;
	try {
		target.setItem(key, JSON.stringify(value));
	} catch {
		// UI preferences remain session-local when storage is unavailable.
	}
}

function isCollectionKind(value: string): value is SidebarCollectionKind {
	return COLLECTION_KINDS.some((kind) => kind === value);
}

function validCollectionKey(
	value: string,
	kind?: SidebarCollectionKind,
): boolean {
	if (typeof value !== "string" || value.length < 3 || value.length > 260)
		return false;
	const separator = value.indexOf(":");
	if (separator < 1 || separator === value.length - 1) return false;
	const prefix = value.slice(0, separator);
	return isCollectionKind(prefix) && (kind === undefined || prefix === kind);
}

function validKeys(
	value: StoredValue | null,
	kind?: SidebarCollectionKind,
): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter((entry) => validCollectionKey(entry, kind)))];
}

function readSnapshot(): SidebarPreferencesSnapshot {
	const pinnedValue = readJson(PINNED_STORAGE_KEY);
	const recentValue = readJson(RECENT_STORAGE_KEY);
	const collapsedValue = readJson(COLLAPSED_STORAGE_KEY);
	const channelSortModeValue = readJson(CHANNEL_SORT_MODE_STORAGE_KEY);
	const channelCustomOrderValue = readJson(CHANNEL_CUSTOM_ORDER_STORAGE_KEY);
	const recentKeys = emptyRecentKeys();
	const recentRecord =
		typeof recentValue === "object" &&
		recentValue !== null &&
		!Array.isArray(recentValue)
			? recentValue
			: null;
	if (recentRecord !== null) {
		for (const kind of COLLECTION_KINDS) {
			recentKeys[kind] = validKeys(recentRecord[kind] ?? null, kind).slice(
				0,
				50,
			);
		}
	}
	return {
		pinnedKeys: validKeys(pinnedValue),
		recentKeys,
		collapsedSections: Array.isArray(collapsedValue)
			? collapsedValue.filter(isCollectionKind)
			: [],
		channelSortMode:
			channelSortModeValue === "alphabetical" ||
			channelSortModeValue === "custom" ||
			channelSortModeValue === "recent"
				? channelSortModeValue
				: "recent",
		channelCustomOrder: validKeys(channelCustomOrderValue, "channel"),
		hasStoredPins: Array.isArray(pinnedValue),
	};
}

function updateStorage(snapshot: SidebarPreferencesSnapshot): void {
	writeJson(PINNED_STORAGE_KEY, snapshot.pinnedKeys);
	writeJson(RECENT_STORAGE_KEY, snapshot.recentKeys);
	writeJson(COLLAPSED_STORAGE_KEY, snapshot.collapsedSections);
	writeJson(CHANNEL_SORT_MODE_STORAGE_KEY, snapshot.channelSortMode);
	writeJson(CHANNEL_CUSTOM_ORDER_STORAGE_KEY, snapshot.channelCustomOrder);
}

export function collectionKey(kind: SidebarCollectionKind, id: string): string {
	return `${kind}:${id}`;
}

class SidebarPreferencesStore {
	private snapshot = readSnapshot();
	private readonly listeners = new Set<() => void>();

	getSnapshot = (): SidebarPreferencesSnapshot => this.snapshot;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	reload = (): void => {
		this.snapshot = readSnapshot();
		this.emit();
	};

	ensurePinnedDefaults = (keys: readonly string[]): void => {
		if (this.snapshot.hasStoredPins || keys.length === 0) return;
		this.commit({
			pinnedKeys: [...new Set(keys.filter((key) => validCollectionKey(key)))],
			hasStoredPins: true,
		});
	};

	togglePin = (
		kind: SidebarCollectionKind,
		id: string,
		defaultPinnedKeys: readonly string[] = [],
	): void => {
		const key = collectionKey(kind, id);
		const current = this.snapshot.hasStoredPins
			? this.snapshot.pinnedKeys
			: [...defaultPinnedKeys];
		const pinnedKeys = current.includes(key)
			? current.filter((candidate) => candidate !== key)
			: [...current, key];
		this.commit({ pinnedKeys, hasStoredPins: true });
	};

	touchRecent = (
		kind: SidebarCollectionKind,
		id: string,
		defaultPinnedKeys: readonly string[] = [],
	): void => {
		const key = collectionKey(kind, id);
		const pinnedKeys = this.snapshot.hasStoredPins
			? this.snapshot.pinnedKeys
			: defaultPinnedKeys;
		if (pinnedKeys.includes(key)) return;
		const recentKeys = {
			...this.snapshot.recentKeys,
			[kind]: [
				key,
				...this.snapshot.recentKeys[kind].filter(
					(candidate) => candidate !== key,
				),
			].slice(0, 50),
		};
		this.commit({ recentKeys });
	};

	setSectionCollapsed = (
		kind: SidebarCollectionKind,
		collapsed: boolean,
	): void => {
		const sections = new Set(this.snapshot.collapsedSections);
		if (collapsed) sections.add(kind);
		else sections.delete(kind);
		this.commit({ collapsedSections: [...sections] });
	};

	setChannelSortMode = (channelSortMode: ChannelSortMode): void => {
		this.commit({ channelSortMode });
	};

	setChannelCustomOrder = (channelIds: readonly string[]): void => {
		this.commit({
			channelCustomOrder: [
				...new Set(channelIds.map((id) => collectionKey("channel", id))),
			],
		});
	};

	private commit(changes: Partial<SidebarPreferencesSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...changes };
		updateStorage(this.snapshot);
		this.emit();
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

export const sidebarPreferencesStore = new SidebarPreferencesStore();

export function useSidebarPreferences(): SidebarPreferencesSnapshot {
	return useSyncExternalStore(
		sidebarPreferencesStore.subscribe,
		sidebarPreferencesStore.getSnapshot,
		sidebarPreferencesStore.getSnapshot,
	);
}

if (typeof window !== "undefined")
	window.addEventListener("storage", () => sidebarPreferencesStore.reload());
