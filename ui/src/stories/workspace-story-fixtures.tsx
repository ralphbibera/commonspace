import { useEffect, useState } from "react";
import { CommonspaceApp } from "../CommonspaceApp";
import { CommonspaceClientStore } from "../commonspace-store";
import {
	storyBootstrap,
	storyProjectFetcher,
	storySearchFetcher,
} from "./story-fixtures";

// Keep navigation and refresh behavior real; only the HTTP/event boundary is local.
export function RoutedWorkspace({ initialPath }: { initialPath: string }) {
	const [store] = useState(() => {
		const client = new CommonspaceClientStore();
		client.connectEvents = () => undefined;
		client.disconnectEvents = () => undefined;
		return client;
	});
	useEffect(() => {
		void store.refresh();
	}, [store]);
	return (
		<CommonspaceApp
			store={store}
			initialPath={initialPath}
			projectFetcher={storyProjectFetcher}
			searchFetcher={storySearchFetcher}
		/>
	);
}

export function installWorkspaceStoryApi(failedLoads = 0) {
	const originalFetch = globalThis.fetch;
	let loads = 0;
	globalThis.fetch = async (input, init) => {
		const url = new URL(
			input instanceof Request ? input.url : input.toString(),
			window.location.origin,
		);
		if (url.pathname === "/api/bootstrap") {
			loads += 1;
			const failed = loads <= failedLoads;
			return new Response(
				JSON.stringify(
					failed
						? { error: "Could not reach the local Commonspace service." }
						: storyBootstrap,
				),
				{
					status: failed ? 503 : 200,
					headers: { "content-type": "application/json" },
				},
			);
		}
		if (url.pathname.startsWith("/api/"))
			throw new Error(`Unexpected workspace story request: ${url.pathname}`);
		return originalFetch(input, init);
	};
	return () => {
		globalThis.fetch = originalFetch;
	};
}
