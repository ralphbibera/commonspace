import type { Preview } from "@storybook/react-vite";
import "../src/index.css";

const preview: Preview = {
	globalTypes: {
		appearance: {
			description: "Preview appearance",
			toolbar: {
				icon: "circlehollow",
				dynamicTitle: true,
				items: [
					{ value: "light", title: "Light" },
					{ value: "dark", title: "Dark" },
				],
			},
		},
	},
	initialGlobals: { appearance: "light" },
	decorators: [
		(Story, context) => (
			<Story key={context.globals.appearance === "dark" ? "dark" : "light"} />
		),
	],
	beforeEach: ({ globals }) => {
		const root = document.documentElement;
		const previousClasses = root.className;
		const previousMode = window.localStorage.getItem("commonspace-color-mode");
		const mode = globals.appearance === "dark" ? "dark" : "light";
		root.classList.remove("light", "dark", "system");
		root.classList.add(mode);
		window.localStorage.setItem("commonspace-color-mode", mode);
		return () => {
			root.className = previousClasses;
			if (previousMode === null)
				window.localStorage.removeItem("commonspace-color-mode");
			else window.localStorage.setItem("commonspace-color-mode", previousMode);
		};
	},
	parameters: {
		layout: "fullscreen",
		controls: {
			matchers: {
				color: /(background|color)$/iu,
				date: /Date$/iu,
			},
		},
		a11y: {
			test: "error",
		},
	},
};

export default preview;
