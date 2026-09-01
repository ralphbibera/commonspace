import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { CommonspaceApp } from "./CommonspaceApp.tsx";
import { CommonspaceClientStore } from "./commonspace-store.ts";
import tailwindStyles from "./index.css?inline";

export interface MountedCommonspace {
	store: CommonspaceClientStore;
	unmount(): void;
}

export function mountCommonspace(
	container: HTMLElement,
	store = new CommonspaceClientStore(),
): MountedCommonspace {
	const style = document.createElement("style");
	style.dataset.commonspace = "standalone";
	style.textContent = tailwindStyles;
	document.head.append(style);

	const root: Root = createRoot(container);
	flushSync(() => {
		root.render(<CommonspaceApp store={store} />);
	});
	let mounted = true;
	return {
		store,
		unmount() {
			if (!mounted) return;
			mounted = false;
			root.unmount();
			style.remove();
		},
	};
}

const container =
	typeof document === "undefined" ? null : document.getElementById("root");
if (container !== null) mountCommonspace(container);
