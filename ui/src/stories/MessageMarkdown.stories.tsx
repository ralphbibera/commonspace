import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageMarkdown } from "../MessageMarkdown";

const meta = {
	title: "Components/MessageMarkdown",
	component: MessageMarkdown,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div className="w-[720px] max-w-full rounded-md border bg-background p-5">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof MessageMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainText: Story = {
	args: {
		text: "A short message with **bold** and a [workspace link](/workspace).",
	},
};

export const RichMarkdown: Story = {
	args: {
		text: `# Verification notes\n\nThe rendered message keeps links safe and tables readable.\n\n> Keep evidence attached to the visible work record.\n\n| Surface | State |\n| --- | --- |\n| Inbox | Attention |\n| Project files | Selected |\n\n\`\`\`ts\nconst verified = true;\n\`\`\`\n\n![baseline](https://example.com/baseline.png)`,
	},
};

export const Empty: Story = { args: { text: "" } };
