import type { Preview } from "@storybook/react-vite";
import "../src/index.css";

const preview: Preview = {
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
