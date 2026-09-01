import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommonspaceLogo } from "@/design-system/CommonspaceLogo";

function BrandPreview() {
	const colors = [
		["Workspace", "#4a154b"],
		["Deep shell", "#350d36"],
		["Canvas", "#ffffff"],
		["Surface", "#f8f8f8"],
		["Success", "#2eb67d"],
		["Attention", "#ecb22e"],
		["Danger", "#e01e5a"],
	] as const;
	return (
		<main className="min-h-screen bg-background p-10 text-foreground">
			<section className="mx-auto max-w-[920px]">
				<div className="flex items-center gap-5">
					<span className="grid size-24 place-items-center rounded-xl bg-sidebar-deep">
						<CommonspaceLogo decorative className="size-16" />
					</span>
					<div>
						<h1 className="font-heading text-3xl font-bold tracking-[-0.025em]">
							Commonspace
						</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							Local-first agent conversation workspace.
						</p>
					</div>
				</div>
				<div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
					{colors.map(([name, value]) => (
						<div key={name} className="overflow-hidden rounded-md border">
							<span className="block h-20" style={{ background: value }} />
							<span className="block p-3">
								<strong className="block text-sm">{name}</strong>
								<code className="mt-1 block text-xs text-muted-foreground">
									{value}
								</code>
							</span>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}

const meta = {
	title: "Foundation/Brand",
	component: BrandPreview,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
} satisfies Meta<typeof BrandPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReferenceTokens: Story = {};
