import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function PrimitivePreview() {
	return (
		<main className="min-h-screen bg-muted p-10">
			<section className="mx-auto grid max-w-[760px] gap-8 rounded-lg border bg-background p-8">
				<div>
					<h2 className="font-heading text-lg font-bold">Actions</h2>
					<div className="mt-4 flex flex-wrap gap-3">
						<Button>Primary</Button>
						<Button variant="outline">Secondary</Button>
						<Button variant="destructive">Stop</Button>
						<Button variant="ghost">Quiet</Button>
					</div>
				</div>
				<div>
					<h2 className="font-heading text-lg font-bold">
						Identity and status
					</h2>
					<div className="mt-4 flex items-center gap-3">
						<Avatar className="rounded-sm">
							<AvatarFallback className="rounded-sm">A</AvatarFallback>
						</Avatar>
						<Badge>Working</Badge>
						<Badge variant="outline">Read only</Badge>
						<Badge variant="destructive">Needs input</Badge>
					</div>
				</div>
				<div>
					<h2 className="font-heading text-lg font-bold">Project navigation</h2>
					<Tabs defaultValue="files" className="mt-4">
						<TabsList variant="project">
							<TabsTrigger value="conversations">Conversations</TabsTrigger>
							<TabsTrigger value="files">Files</TabsTrigger>
							<TabsTrigger value="changes">Changes</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</section>
		</main>
	);
}

const meta = {
	title: "Foundation/Primitives",
	component: PrimitivePreview,
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"],
} satisfies Meta<typeof PrimitivePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CoreStates: Story = {};
