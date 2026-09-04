import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { CommonspaceWorkspace } from "./app-shell/CommonspaceWorkspace.tsx";
import { useCommonspaceNavigation } from "./app-shell/useCommonspaceNavigation.ts";
import { useCommonspaceTheme } from "./app-shell/useCommonspaceTheme.ts";
import { CommonspaceSearchDialog } from "./CommonspaceSearch.tsx";
import { CommonspaceSidebar } from "./CommonspaceSidebar.tsx";
import { CommonspaceTopbar } from "./CommonspaceTopbar.tsx";
import type { CommonspaceStore } from "./commonspace-store.ts";

export interface CommonspaceAppProps {
	store: CommonspaceStore;
	projectFetcher?: typeof globalThis.fetch;
	searchFetcher?: typeof globalThis.fetch;
}

export function CommonspaceApp({
	store,
	projectFetcher,
	searchFetcher,
}: CommonspaceAppProps) {
	const snapshot = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
	const { colorMode, setColorMode } = useCommonspaceTheme();
	const navigation = useCommonspaceNavigation(store, snapshot);
	const {
		activeDestination,
		activeProjectViewId,
		closeNavigation,
		closeSearch,
		createRequest,
		mentionAgent,
		navigationOpen,
		openContextSettings,
		openConversation,
		openDirectory,
		openInbox,
		openProject,
		openSearch,
		openSearchResult,
		openThreads,
		searchOpen,
		toggleNavigation,
	} = navigation;

	useEffect(() => {
		store.connectEvents();
		return () => {
			store.disconnectEvents();
		};
	}, [store]);

	return (
		<div className="relative flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar">
			<CommonspaceTopbar onOpenSearch={openSearch} />
			<div className="relative grid min-h-0 min-w-0 flex-1 grid-cols-[260px_minmax(0,1fr)] bg-sidebar max-[780px]:grid-cols-1">
				<button
					type="button"
					aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
					aria-expanded={navigationOpen}
					className="absolute top-2 left-3 z-30 hidden size-11 place-items-center rounded-sm border-0 bg-transparent text-foreground hover:bg-muted max-[780px]:grid"
					onClick={toggleNavigation}
				>
					{navigationOpen ? (
						<XIcon aria-hidden="true" />
					) : (
						<MenuIcon aria-hidden="true" />
					)}
				</button>
				<button
					type="button"
					className={cn(
						"pointer-events-none absolute inset-0 z-10 hidden border-0 bg-black/30 opacity-0 transition-opacity max-[780px]:block",
						navigationOpen && "pointer-events-auto max-[780px]:opacity-100",
					)}
					aria-label="Close navigation"
					aria-hidden={!navigationOpen}
					tabIndex={navigationOpen ? 0 : -1}
					onClick={closeNavigation}
				/>
				<aside
					className={cn(
						"relative z-20 min-h-0 min-w-0 overflow-hidden bg-sidebar text-sidebar-foreground max-[780px]:absolute max-[780px]:inset-y-0 max-[780px]:left-0 max-[780px]:w-[min(88vw,320px)] max-[780px]:-translate-x-full max-[780px]:pt-12 max-[780px]:shadow-2xl max-[780px]:transition-transform",
						navigationOpen && "max-[780px]:translate-x-0",
					)}
				>
					<CommonspaceSidebar
						wide
						expandSidebar={() => undefined}
						store={store}
						colorMode={colorMode}
						onSetColorMode={setColorMode}
						inboxActive={activeDestination === "inbox"}
						threadsActive={activeDestination === "threads"}
						conversationActive={activeDestination === "conversation"}
						directoryActive={activeDestination === "directory"}
						activeProjectViewId={activeProjectViewId}
						createRequest={createRequest}
						onOpenSearch={openSearch}
						onOpenInbox={() => openInbox()}
						onOpenThreads={openThreads}
						onOpenDirectory={openDirectory}
						onOpenContextSettings={openContextSettings}
						onOpenAgentSessions={() => openInbox("sessions")}
						onMentionAgent={mentionAgent}
						onOpenProject={openProject}
						onOpenConversation={(messageId) => {
							openConversation(undefined, messageId);
						}}
					/>
				</aside>
				<section className="min-h-0 min-w-0 overflow-hidden bg-background">
					<CommonspaceWorkspace
						navigation={navigation}
						snapshot={snapshot}
						store={store}
						{...(projectFetcher === undefined ? {} : { projectFetcher })}
					/>
				</section>
			</div>
			{searchOpen && snapshot.bootstrap !== null && (
				<CommonspaceSearchDialog
					projects={snapshot.bootstrap.state.projects}
					onClose={closeSearch}
					onSelect={openSearchResult}
					{...(searchFetcher === undefined ? {} : { fetcher: searchFetcher })}
				/>
			)}
			{snapshot.error !== null && (
				<div
					className="fixed right-4 bottom-4 z-50 max-w-sm rounded-md border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
					role="alert"
				>
					{snapshot.error}
				</div>
			)}
		</div>
	);
}
